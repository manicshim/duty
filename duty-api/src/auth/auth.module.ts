import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MailService } from './mail.service';
import { AuthEmailCode } from '../entities/auth-email-code.entity';
import { Member } from '../entities/member.entity';
import { Master } from '../entities/master.entity';
import { MemberOauthAccount } from '../entities/member-oauth-account.entity';
import { MasterSignupRequest } from '../entities/master-signup-request.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AuthEmailCode, Member, Master, MemberOauthAccount, MasterSignupRequest])],
  controllers: [AuthController],
  providers: [AuthService, MailService],
})
export class AuthModule {}
