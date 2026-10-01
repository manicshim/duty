import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DutyMonthQueryDto } from './dto/duty-month-query.dto';
import { DutyService } from './duty.service';

@Controller('duties')
export class DutyController {
  constructor(private readonly dutyService: DutyService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('file 필드는 필수입니다.');
    }
    return this.dutyService.uploadExcel(file);
  }

  @Get()
  findByMonth(@Query() query: DutyMonthQueryDto) {
    return this.dutyService.findByMonth(query.year, query.month);
  }

  @Get('calendar')
  findCalendarByMonth(@Query() query: DutyMonthQueryDto) {
    return this.dutyService.findCalendarByMonth(query.year, query.month);
  }

  @Get('logs')
  findLogs() {
    return this.dutyService.findLogs();
  }

  @Patch('member/:memberId')
  updateMemberDuties(
    @Param('memberId') memberId: string,
    @Body('duties') duties: Array<{ date: string; dutyCode: string }>,
  ) {
    return this.dutyService.updateMemberDuties(Number(memberId), duties);
  }

  @Patch('members/order')
  updateMemberOrders(@Body('orders') orders: Array<{ memberId: number; sortOrder: number | string | null }>) {
    return this.dutyService.updateMemberOrders(orders);
  }

  @Patch(':memberId/:date')
  updateDuty(@Param('memberId') memberId: string, @Param('date') date: string, @Body('dutyCode') dutyCode: string) {
    return this.dutyService.updateDuty(Number(memberId), date, dutyCode);
  }
}
