import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { LoginDto } from './dto/login.dto';
import { SendCodeDto } from './dto/send-code.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('oauth/:provider/start')
  startOAuth(
    @Param('provider') provider: 'google' | 'naver' | 'kakao',
    @Query('mode') mode: 'login' | 'signup' = 'login',
    @Query('role') role: 'member' | 'master' = 'member',
    @Query('level') level = '1',
    @Res() response: Response,
  ) {
    response.redirect(this.authService.getOAuthStartUrl(provider, mode, role, Number(level)));
  }

  @Get('oauth/:provider/callback')
  async oauthCallback(
    @Param('provider') provider: 'google' | 'naver' | 'kakao',
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() response: Response,
  ) {
    const result = await this.authService.handleOAuthCallback(provider, code, state);
    response.redirect(this.authService.toFrontendOAuthRedirect(result));
  }

  @Post('oauth/:provider/callback')
  async oauthPostCallback(
    @Param('provider') provider: 'google' | 'naver' | 'kakao',
    @Body('code') code: string,
    @Body('state') state: string,
    @Res() response: Response,
  ) {
    const result = await this.authService.handleOAuthCallback(provider, code, state);
    response.redirect(this.authService.toFrontendOAuthRedirect(result));
  }

  @Post('send-code')
  sendCode(@Body() dto: SendCodeDto) {
    return this.authService.sendCode(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('verify-code')
  verifyCode(@Body() dto: VerifyCodeDto) {
    return this.authService.verifyCode(dto);
  }

  @Post('complete-profile')
  completeProfile(@Body() dto: CompleteProfileDto) {
    return this.authService.completeProfile(dto);
  }

  @Get('tester-members')
  findTesterMembers() {
    return this.authService.findTesterMembers();
  }

  @Get('master-signup-requests')
  findPendingMasterSignupRequests(@Query('approverEmail') approverEmail: string) {
    return this.authService.findPendingMasterSignupRequests(approverEmail);
  }

  @Post('master-signup-requests/:id/approve')
  approveMasterSignupRequest(
    @Param('id') id: string,
    @Body('approverEmail') approverEmail: string,
  ) {
    return this.authService.approveMasterSignupRequest(Number(id), approverEmail);
  }

  @Post('master-signup-requests/:id/reject')
  rejectMasterSignupRequest(
    @Param('id') id: string,
    @Body('approverEmail') approverEmail: string,
  ) {
    return this.authService.rejectMasterSignupRequest(Number(id), approverEmail);
  }
}
