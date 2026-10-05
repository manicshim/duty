import { BadRequestException, Injectable } from '@nestjs/common';
import { extname } from 'node:path';
import type { Sharp, SharpOptions } from 'sharp';
import { createWorker, PSM, Worker } from 'tesseract.js';
import korData = require('@tesseract.js-data/kor');
import engData = require('@tesseract.js-data/eng');
import { ParsedDutyCell, ParsedDutySheet } from './duty-parser.service';

const sharp = require('sharp') as (input?: Buffer, options?: SharpOptions) => Sharp;

type Grid = { vertical: number[]; horizontal: number[]; employeeTopIndex: number };

@Injectable()
export class DutyImageParserService {
  supports(file: Express.Multer.File) {
    return ['.png', '.jpg', '.jpeg'].includes(extname(file.originalname).toLowerCase()) ||
      ['image/png', 'image/jpeg'].includes(file.mimetype);
  }

  async parse(buffer: Buffer): Promise<ParsedDutySheet> {
    let koreanWorker: Worker | undefined;
    let englishWorker: Worker | undefined;

    try {
      const image = sharp(buffer, { failOn: 'error' });
      const metadata = await image.metadata();
      if (!metadata.width || !metadata.height || metadata.width < 600 || metadata.height < 200) {
        throw new BadRequestException('근무표 이미지는 가로 600px, 세로 200px 이상이어야 합니다.');
      }

      const grid = await this.findGrid(buffer);
      koreanWorker = await createWorker('kor', undefined, { langPath: korData.langPath, gzip: korData.gzip, cacheMethod: 'none' });
      englishWorker = await createWorker('eng', undefined, { langPath: engData.langPath, gzip: engData.gzip, cacheMethod: 'none' });

      const title = await this.recognize(koreanWorker, buffer, 0, 0, undefined, undefined, PSM.AUTO);
      const yearMonth = title.replace(/\s/g, '').match(/(20\d{2})년?(\d{1,2})월/);
      if (!yearMonth) {
        throw new BadRequestException('이미지 제목에서 연도와 월을 인식할 수 없습니다.');
      }
      const year = Number(yearMonth[1]);
      const month = Number(yearMonth[2]);
      const daysInMonth = new Date(year, month, 0).getDate();
      const dayBoundaries = grid.vertical.slice(1, daysInMonth + 2);
      if (dayBoundaries.length !== daysInMonth + 1) {
        throw new BadRequestException(`${month}월의 ${daysInMonth}개 날짜 열을 찾지 못했습니다.`);
      }

      await englishWorker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_WORD,
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
      });

      const cells: ParsedDutyCell[] = [];
      const errors: string[] = [];
      const employeeRows = grid.horizontal.slice(grid.employeeTopIndex);
      for (let rowIndex = 0; rowIndex < employeeRows.length - 1; rowIndex += 1) {
        const top = employeeRows[rowIndex];
        const bottom = employeeRows[rowIndex + 1];
        if (bottom - top < 15 || bottom - top > 80) continue;

        const memberNameRaw = await this.recognizeCell(koreanWorker, buffer, grid.vertical[0], top, grid.vertical[1], bottom, PSM.SINGLE_LINE, true);
        const memberName = memberNameRaw.replace(/[^가-힣A-Za-z]/g, '');
        if (!memberName || this.isSummaryRow(memberName)) continue;
        if (memberName.length < 2) {
          errors.push(`${rowIndex + 1}번째 직원의 성명을 인식하지 못했습니다.`);
          continue;
        }

        for (let dayIndex = 0; dayIndex < daysInMonth; dayIndex += 1) {
          const left = dayBoundaries[dayIndex];
          const right = dayBoundaries[dayIndex + 1];
          const korean = await this.recognizeCell(koreanWorker, buffer, left, top, right, bottom, PSM.SINGLE_WORD, true);
          let dutyCode = this.normalizeKoreanDuty(korean);
          if (!dutyCode) {
            const english = await this.recognizeCell(englishWorker, buffer, left, top, right, bottom, PSM.SINGLE_WORD);
            dutyCode = this.normalizeEnglishDuty(english);
          }
          if (!dutyCode) {
            errors.push(`${memberName} ${dayIndex + 1}일 근무코드를 인식하지 못했습니다.`);
            continue;
          }
          cells.push({
            memberName,
            dutyDate: `${year}-${String(month).padStart(2, '0')}-${String(dayIndex + 1).padStart(2, '0')}`,
            dutyCode,
            row: rowIndex + 1,
            col: dayIndex + 2,
          });
        }
      }

      if (!cells.length) throw new BadRequestException('이미지에서 근무표 데이터를 찾을 수 없습니다.');
      if (errors.length) {
        throw new BadRequestException(`이미지 인식 오류: ${errors.slice(0, 8).join(' / ')}${errors.length > 8 ? ` 외 ${errors.length - 8}건` : ''}`);
      }
      return { year, month, cells };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`이미지 근무표를 분석하지 못했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      await Promise.allSettled([koreanWorker?.terminate(), englishWorker?.terminate()].filter(Boolean) as Promise<unknown>[]);
    }
  }

  private async findGrid(buffer: Buffer): Promise<Grid> {
    const { data, info } = await sharp(buffer).greyscale().raw().toBuffer({ resolveWithObject: true });
    const scanHeight = Math.min(info.height, Math.floor(info.height * 0.75));
    const verticalScores = Array.from({ length: info.width }, (_, x) => {
      let score = 0;
      for (let y = 0; y < scanHeight; y += 1) if (data[y * info.width + x] < 100) score += 1;
      return score;
    });
    const vertical = this.clusterLines(verticalScores, scanHeight * 0.45);
    const runStart = this.findRegularRun(vertical, 32);
    if (runStart < 0) throw new BadRequestException('이미지에서 날짜 표의 세로 격자선을 찾지 못했습니다.');
    const dateVertical = vertical.slice(runStart, runStart + 32);
    const dayWidth = dateVertical[1] - dateVertical[0];
    const nameLeft = Math.max(0, dateVertical[0] - dayWidth * 2);
    const tableVertical = [nameLeft, ...dateVertical];

    const horizontalScores = Array.from({ length: scanHeight }, (_, y) => {
      let score = 0;
      const endX = tableVertical[tableVertical.length - 1];
      for (let x = tableVertical[0]; x <= endX; x += 1) if (data[y * info.width + x] < 225) score += 1;
      return score;
    });
    const horizontal = this.clusterLines(horizontalScores, (tableVertical.at(-1)! - tableVertical[0]) * 0.9);
    let employeeTopIndex = -1;
    for (let index = 0; index < horizontal.length - 6; index += 1) {
      const gaps = horizontal.slice(index, index + 7).slice(1).map((line, offset) => line - horizontal[index + offset]);
      const median = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
      if (median >= 20 && median <= 40 && gaps.every((gap) => Math.abs(gap - median) <= 3)) {
        employeeTopIndex = index + 1;
        break;
      }
    }
    if (employeeTopIndex < 0) throw new BadRequestException('이미지에서 직원 행의 가로 격자선을 찾지 못했습니다.');
    return { vertical: tableVertical, horizontal, employeeTopIndex };
  }

  private clusterLines(scores: number[], threshold: number) {
    const clusters: number[][] = [];
    scores.forEach((score, index) => {
      if (score < threshold) return;
      const last = clusters.at(-1);
      if (!last || index > last.at(-1)! + 1) clusters.push([index]);
      else last.push(index);
    });
    return clusters.map((cluster) => Math.round(cluster.reduce((sum, value) => sum + value, 0) / cluster.length));
  }

  private findRegularRun(lines: number[], required: number) {
    for (let start = 0; start <= lines.length - required; start += 1) {
      const gaps = lines.slice(start, start + required).slice(1).map((line, index) => line - lines[start + index]);
      const median = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
      if (median >= 15 && median <= 80 && gaps.every((gap) => Math.abs(gap - median) <= Math.max(3, median * 0.2))) return start;
    }
    return -1;
  }

  private async recognizeCell(worker: Worker, buffer: Buffer, left: number, top: number, right: number, bottom: number, psm: PSM, threshold = false) {
    const insetX = 2;
    const insetY = Math.max(2, Math.floor((bottom - top) * 0.1));
    let pipeline = sharp(buffer)
      .extract({ left: left + insetX, top: top + insetY, width: right - left - insetX * 2, height: bottom - top - insetY * 2 })
      .resize({ height: 120 }).greyscale().normalize();
    if (threshold) pipeline = pipeline.threshold(190);
    const cell = await pipeline.png().toBuffer();
    return this.recognize(worker, cell, 0, 0, undefined, undefined, psm);
  }

  private async recognize(worker: Worker, buffer: Buffer, left: number, top: number, width?: number, height?: number, psm: PSM = PSM.AUTO) {
    await worker.setParameters({ tessedit_pageseg_mode: psm });
    const options = width && height ? { rectangle: { left, top, width, height } } : undefined;
    const result = await worker.recognize(buffer, options);
    return result.data.text.trim();
  }

  private normalizeEnglishDuty(value: string) {
    const code = value.toUpperCase().replace(/[^A-Z]/g, '');
    if (['D', 'E', 'M', 'N', 'DE', 'OFF', 'ET'].includes(code)) return code === 'ET' ? 'Et' : code;
    if (/^O?FF$/.test(code)) return 'OFF';
    if (['DP', 'DB', 'IP', 'PT'].includes(code)) return 'D';
    if (['MM', 'MO'].includes(code)) return 'M';
    if (code === 'EE') return 'E';
    if (['NO', 'HN', 'NE', 'IH', 'NH', 'NF', 'EH', 'HE', 'IN', 'LG'].includes(code)) return 'N';
    return '';
  }

  private normalizeKoreanDuty(value: string) {
    const compact = value.replace(/\s/g, '');
    return /연.?차/.test(compact) ? '연차' : '';
  }

  private isSummaryRow(value: string) {
    return ['D', 'E', 'DE', 'M', 'N'].includes(value.toUpperCase()) || value.includes('근무');
  }
}
