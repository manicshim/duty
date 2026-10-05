import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { DutyCalendar } from '../entities/duty-calendar.entity';
import { Member } from '../entities/member.entity';
import { UploadLog } from '../entities/upload-log.entity';
import { DutyParserService } from './duty-parser.service';
import { DutyImageParserService } from './duty-image-parser.service';

@Injectable()
export class DutyService {
  constructor(
    @InjectRepository(DutyCalendar)
    private readonly dutyRepository: Repository<DutyCalendar>,
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
    @InjectRepository(UploadLog)
    private readonly uploadLogRepository: Repository<UploadLog>,
    private readonly parser: DutyParserService,
    private readonly imageParser: DutyImageParserService,
  ) {}

  async uploadExcel(file: Express.Multer.File) {
    const parsed = this.imageParser.supports(file)
      ? await this.imageParser.parse(file.buffer)
      : this.parser.parse(file.buffer);
    const log = await this.uploadLogRepository.save(
      this.uploadLogRepository.create({
        originalName: file.originalname,
        storedName: null,
        targetYear: parsed.year,
        targetMonth: parsed.month,
        rowCount: parsed.cells.length,
        status: 'success',
        message: null,
      }),
    );

    const memberCache = new Map<string, Member>();
    const uniqueNames = Array.from(new Set(parsed.cells.map((cell) => cell.memberName)));
    for (const name of uniqueNames) {
      await this.findOrCreateMember(name, memberCache);
    }

    const dates = parsed.cells.map((cell) => cell.dutyDate);
    await this.dutyRepository.delete({ dutyDate: Between(dates[0], dates[dates.length - 1]) });

    const duties = parsed.cells.map((cell) => {
      const member = memberCache.get(cell.memberName.toLocaleLowerCase('ko-KR'));
      if (!member) {
        throw new Error(`member cache miss: ${cell.memberName}`);
      }
      const duty = this.dutyRepository.create({ member, dutyDate: cell.dutyDate });
      duty.dutyCode = cell.dutyCode;
      duty.dutyLabel = this.toDutyLabel(cell.dutyCode);
      duty.sourceRow = cell.row;
      duty.sourceCol = cell.col;
      duty.uploadLog = log;
      return duty;
    });

    await this.dutyRepository.save(duties, { chunk: 100 });

    return {
      uploadLogId: log.id,
      year: parsed.year,
      month: parsed.month,
      savedCount: duties.length,
    };
  }

  async findByMonth(year: number, month: number) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(endDate).padStart(2, '0')}`;

    const duties = await this.dutyRepository.find({
      where: { dutyDate: Between(start, end), member: { mbHidden: false } },
      relations: { member: true },
      order: {
        member: { mbSortOrder: 'ASC', mbName: 'ASC' },
        dutyDate: 'ASC',
      },
    });

    const members = new Map<number, { id: number; name: string; department: string | null; sortOrder: number | null; duties: Record<string, string> }>();
    duties.forEach((duty) => {
      const member = members.get(duty.member.id) ?? {
        id: duty.member.id,
        name: duty.member.mbName,
        department: duty.member.mbDepartment,
        sortOrder: duty.member.mbSortOrder,
        duties: {},
      };
      member.duties[duty.dutyDate] = duty.dutyCode;
      members.set(duty.member.id, member);
    });

    return {
      year,
      month,
      days: Array.from({ length: endDate }, (_, index) => index + 1),
      members: Array.from(members.values()).sort((a, b) => {
        const sortA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
        const sortB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
        if (sortA !== sortB) return sortA - sortB;
        return a.name.localeCompare(b.name, 'ko-KR');
      }),
    };
  }

  async findCalendarByMonth(year: number, month: number) {
    const monthData = await this.findByMonth(year, month);
    const firstWeekday = new Date(year, month - 1, 1).getDay();
    const cells = [
      ...Array.from({ length: firstWeekday }, () => null),
      ...monthData.days.map((day) => {
        const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return {
          date,
          day,
          weekday: new Date(year, month - 1, day).getDay(),
          duties: monthData.members
            .map((member) => {
              const dutyCode = member.duties[date] ?? '';
              if (!dutyCode) return null;
              return {
                memberId: member.id,
                memberName: member.name,
                dutyCode,
                dutyShortCode: this.toDutyShortCode(dutyCode),
                dutyLabel: this.toDutyLabel(dutyCode),
              };
            })
            .filter(Boolean),
        };
      }),
    ];

    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    return {
      year,
      month,
      weeks: Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7)),
    };
  }

  findLogs() {
    return this.uploadLogRepository.find({
      order: { createdAt: 'DESC' },
      take: 30,
    });
  }

  async updateDuty(memberId: number, date: string, dutyCode: string) {
    if (!memberId || !this.isValidDate(date)) {
      throw new BadRequestException('memberId와 날짜 형식이 올바르지 않습니다.');
    }
    const normalizedCode = this.normalizeDutyCode(dutyCode);
    const member = await this.memberRepository.findOne({ where: { id: memberId } });
    if (!member) {
      throw new NotFoundException('근무자를 찾을 수 없습니다.');
    }

    let duty = await this.dutyRepository.findOne({
      where: { member: { id: memberId }, dutyDate: date },
      relations: { member: true },
    });
    if (!normalizedCode) {
      if (duty) {
        await this.dutyRepository.remove(duty);
      }
      return {
        memberId,
        date,
        dutyCode: '',
        dutyLabel: null,
      };
    }
    duty =
      duty ??
      this.dutyRepository.create({
        member,
        dutyDate: date,
        sourceRow: null,
        sourceCol: null,
        uploadLog: null,
      });
    duty.dutyCode = normalizedCode;
    duty.dutyLabel = this.toDutyLabel(normalizedCode);
    const saved = await this.dutyRepository.save(duty);
    return {
      id: saved.id,
      memberId,
      date,
      dutyCode: saved.dutyCode,
      dutyLabel: saved.dutyLabel,
    };
  }

  async updateMemberDuties(memberId: number, duties: Array<{ date: string; dutyCode: string }>) {
    if (!Array.isArray(duties) || duties.length === 0) {
      throw new BadRequestException('duties 배열은 필수입니다.');
    }
    const saved = [];
    for (const duty of duties) {
      saved.push(await this.updateDuty(memberId, duty.date, duty.dutyCode));
    }
    return {
      memberId,
      savedCount: saved.length,
      duties: saved,
    };
  }

  async updateMemberOrders(orders: Array<{ memberId: number; sortOrder: number | string | null }>) {
    if (!Array.isArray(orders)) {
      throw new BadRequestException('orders 배열은 필수입니다.');
    }
    const memberIds = orders.map((item) => Number(item.memberId)).filter(Boolean);
    const members = memberIds.length ? await this.memberRepository.find({ where: { id: In(memberIds) } }) : [];
    const orderMap = new Map(orders.map((item) => [Number(item.memberId), item.sortOrder === null || item.sortOrder === undefined || item.sortOrder === '' ? null : Number(item.sortOrder)]));
    const nextMembers = members.map((member) => {
      member.mbSortOrder = orderMap.get(member.id) ?? null;
      return member;
    });
    await this.memberRepository.save(nextMembers);
    return {
      savedCount: nextMembers.length,
    };
  }

  private async findOrCreateMember(name: string, cache: Map<string, Member>) {
    const cacheKey = name.toLocaleLowerCase('ko-KR');
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    let member = await this.memberRepository.findOne({ where: { mbName: name } });
    if (!member) {
      member = await this.memberRepository.save(
        this.memberRepository.create({
          mbId: null,
          mbName: name,
          mbPhone: null,
          mbLv: 1,
          mbDepartment: null,
          mbSortOrder: null,
          grade: null,
        }),
      );
    }

    cache.set(cacheKey, member);
    return member;
  }

  private normalizeDutyCode(code: string) {
    return String(code ?? '').trim();
  }

  private isValidDate(date: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(date);
  }

  private toDutyLabel(code: string) {
    const normalized = code.trim();
    const upper = normalized.toUpperCase();
    if (upper === 'OFF' || normalized === '비번') return 'OFF';
    if (normalized === '연차' || upper === 'AL' || upper === 'ANNUAL') return '연차';

    const shift = this.toShiftLabel(upper);
    const type = this.toWorkTypeLabel(upper);
    if (shift && type) return `${shift} / ${type}`;
    return shift ?? type ?? null;
  }

  private toDutyShortCode(code: string) {
    const normalized = code.trim();
    const upper = normalized.toUpperCase();
    if (!normalized) return '';
    if (upper === 'OFF' || normalized === '비번') return 'OFF';
    if (normalized === '연차' || upper === 'AL' || upper === 'ANNUAL') return '연';
    return normalized.length <= 3 ? normalized : normalized.slice(0, 3);
  }

  private toShiftLabel(upper: string) {
    if (upper.startsWith('DAY') || upper.startsWith('D')) return 'Day';
    if (upper.startsWith('EVENING') || upper.startsWith('E')) return 'Evening';
    if (upper.startsWith('MID') || upper.startsWith('M')) return 'Mid';
    if (upper.startsWith('NIGHT') || upper.startsWith('N')) return 'Night';
    return null;
  }

  private toWorkTypeLabel(upper: string) {
    if (upper.includes('CHARGE') || upper.includes('C')) return 'Charge';
    if (upper.includes('ACTING') || upper.includes('A')) return 'Acting';
    return null;
  }
}
