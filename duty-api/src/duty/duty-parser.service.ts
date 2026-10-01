import { BadRequestException, Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';

export interface ParsedDutyCell {
  memberName: string;
  dutyDate: string;
  dutyCode: string;
  row: number;
  col: number;
}

export interface ParsedDutySheet {
  year: number;
  month: number;
  cells: ParsedDutyCell[];
}

@Injectable()
export class DutyParserService {
  parse(buffer: Buffer): ParsedDutySheet {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new BadRequestException('엑셀 시트를 찾을 수 없습니다.');
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: '',
    });

    const { year, month } = this.findYearMonth(rows);
    const dateRowIndex = this.findDateRow(rows);
    const nameColIndex = this.findNameColumn(rows, dateRowIndex);
    const dateCols = this.readDateColumns(rows[dateRowIndex], year, month);

    if (dateCols.length === 0) {
      throw new BadRequestException('날짜 컬럼을 찾을 수 없습니다.');
    }

    const cells: ParsedDutyCell[] = [];
    for (let rowIndex = dateRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex] ?? [];
      const memberName = this.normalize(row[nameColIndex]);
      if (!memberName || memberName === '성명') {
        continue;
      }
      if (this.isSummaryRow(memberName)) {
        continue;
      }

      for (const dateCol of dateCols) {
        const dutyCode = this.normalize(row[dateCol.col]);
        if (!dutyCode) {
          continue;
        }
        cells.push({
          memberName,
          dutyDate: dateCol.date,
          dutyCode,
          row: rowIndex + 1,
          col: dateCol.col + 1,
        });
      }
    }

    if (cells.length === 0) {
      throw new BadRequestException('근무표 데이터를 찾을 수 없습니다.');
    }

    return { year, month, cells };
  }

  private findYearMonth(rows: unknown[][]) {
    const text = rows
      .slice(0, 5)
      .flat()
      .map((value) => this.normalize(value))
      .join(' ');
    const match = text.match(/(20\d{2})\s*년\s*(\d{1,2})\s*월/);
    if (!match) {
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth() + 1 };
    }
    return { year: Number(match[1]), month: Number(match[2]) };
  }

  private findDateRow(rows: unknown[][]) {
    let bestIndex = -1;
    let bestScore = 0;
    rows.slice(0, 15).forEach((row, index) => {
      const score = row.filter((cell) => {
        const value = Number(this.normalize(cell));
        return Number.isInteger(value) && value >= 1 && value <= 31;
      }).length;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    if (bestIndex < 0 || bestScore < 7) {
      throw new BadRequestException('날짜 행을 찾을 수 없습니다.');
    }
    return bestIndex;
  }

  private findNameColumn(rows: unknown[][], dateRowIndex: number) {
    const headerRows = rows.slice(Math.max(0, dateRowIndex - 3), dateRowIndex + 2);
    for (const row of headerRows) {
      const index = row.findIndex((cell) => this.normalize(cell) === '성명');
      if (index >= 0) {
        return index;
      }
    }
    return 0;
  }

  private readDateColumns(row: unknown[], year: number, month: number) {
    return row
      .map((cell, col) => ({ day: Number(this.normalize(cell)), col }))
      .filter(({ day }) => Number.isInteger(day) && day >= 1 && day <= 31)
      .map(({ day, col }) => ({
        col,
        date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      }));
  }

  private normalize(value: unknown) {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value).trim();
  }

  private isSummaryRow(value: string) {
    return ['D', 'E', 'DE', 'M', 'N'].includes(value.toUpperCase()) || value.includes('09:30');
  }
}
