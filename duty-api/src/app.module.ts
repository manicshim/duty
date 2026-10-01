import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DutyModule } from './duty/duty.module';
import { AuthModule } from './auth/auth.module';
import { Member } from './entities/member.entity';
import { Master } from './entities/master.entity';
import { MemberGrade } from './entities/member-grade.entity';
import { DutyCalendar } from './entities/duty-calendar.entity';
import { UploadLog } from './entities/upload-log.entity';
import { MemberWantedLeave } from './entities/member-wanted-leave.entity';
import { ManagerMemberDayoff } from './entities/manager-member-dayoff.entity';
import { AuthEmailCode } from './entities/auth-email-code.entity';
import { MemberOauthAccount } from './entities/member-oauth-account.entity';
import { MasterSignupRequest } from './entities/master-signup-request.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get('DB_PORT', 3306),
        username: config.get('DB_USER', 'duty_user'),
        password: config.get('DB_PASSWORD', 'duty_password'),
        database: config.get('DB_NAME', 'duty'),
        entities: [
          Member,
          Master,
          MemberGrade,
          DutyCalendar,
          UploadLog,
          MemberWantedLeave,
          ManagerMemberDayoff,
          AuthEmailCode,
          MemberOauthAccount,
          MasterSignupRequest,
        ],
        synchronize: true,
        charset: 'utf8mb4_unicode_ci',
      }),
    }),
    AuthModule,
    DutyModule,
  ],
})
export class AppModule {}
