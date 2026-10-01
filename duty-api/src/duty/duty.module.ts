import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DutyController } from './duty.controller';
import { DutyService } from './duty.service';
import { DutyParserService } from './duty-parser.service';
import { DutyCalendar } from '../entities/duty-calendar.entity';
import { Member } from '../entities/member.entity';
import { UploadLog } from '../entities/upload-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DutyCalendar, Member, UploadLog])],
  controllers: [DutyController],
  providers: [DutyService, DutyParserService],
})
export class DutyModule {}
