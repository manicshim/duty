import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, createHmac, randomBytes, randomInt } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { IsNull, Repository } from 'typeorm';
import { AuthEmailCode } from '../entities/auth-email-code.entity';
import { Member } from '../entities/member.entity';
import { Master } from '../entities/master.entity';
import { MemberOauthAccount } from '../entities/member-oauth-account.entity';
import { MasterSignupRequest } from '../entities/master-signup-request.entity';
import { SendCodeDto } from './dto/send-code.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { LoginDto } from './dto/login.dto';
import { MailService } from './mail.service';

const testerEmails = new Set(['dev.jh2oon@gmail.com']);

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AuthEmailCode)
    private readonly codeRepository: Repository<AuthEmailCode>,
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
    @InjectRepository(Master)
    private readonly masterRepository: Repository<Master>,
    @InjectRepository(MemberOauthAccount)
    private readonly memberOauthRepository: Repository<MemberOauthAccount>,
    @InjectRepository(MasterSignupRequest)
    private readonly masterSignupRequestRepository: Repository<MasterSignupRequest>,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  getOAuthStartUrl(provider: 'google' | 'naver' | 'kakao', mode: 'login' | 'signup', role: 'member' | 'master', level: number) {
    const state = this.signState({
      provider,
      mode,
      role,
      level: Number.isFinite(level) ? Math.min(Math.max(level, 1), 5) : 1,
      nonce: randomBytes(12).toString('hex'),
    });
    const redirectUri = this.getOAuthRedirectUri(provider);
    const client = this.getOAuthClient(provider);
    const params = new URLSearchParams({
      client_id: client.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
    });

    if (provider === 'google') {
      params.set('scope', 'openid email profile');
      params.set('access_type', 'offline');
      params.set('prompt', 'select_account');
      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }
    if (provider === 'naver') {
      return `https://nid.naver.com/oauth2.0/authorize?${params.toString()}`;
    }
    const kakaoScope = this.configService.get<string>('KAKAO_SCOPE', 'account_email');
    if (kakaoScope.trim()) {
      params.set('scope', kakaoScope.trim());
    }
    return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
  }

  async handleOAuthCallback(provider: 'google' | 'naver' | 'kakao', code: string, state: string) {
    if (!code || !state) {
      throw new UnauthorizedException('SNS 인증 응답이 올바르지 않습니다.');
    }
    const statePayload = this.verifyState(state);
    if (statePayload.provider !== provider) {
      throw new UnauthorizedException('SNS 인증 제공자가 일치하지 않습니다.');
    }

    const profile = await this.fetchOAuthProfile(provider, code);
    const email = profile.email.trim().toLowerCase();
    const existing = await this.findExistingAccount(email, provider);
    if (existing) {
      return this.authenticatedResponse(existing);
    }

    if (statePayload.mode === 'login') {
      return {
        ok: false,
        requiresProfile: false,
        email,
        provider,
        name: profile.name,
        message: `${this.getProviderLabel(provider)} 계정이 아직 DutyFlow 회원과 연결되어 있지 않습니다. 회원가입 탭에서 같은 SNS 계정으로 먼저 등록해 주세요.`,
      };
    }

    const profileToken = randomBytes(32).toString('hex');
    await this.codeRepository.save(
      this.codeRepository.create({
        email,
        provider,
        codeHash: this.hashCode(`oauth:${profile.providerId}:${Date.now()}`),
        profileTokenHash: this.hashCode(profileToken),
        role: statePayload.role,
        level: statePayload.level,
        name: profile.name,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        verifiedAt: new Date(),
      }),
    );

    return {
      ok: true,
      requiresProfile: true,
      profileToken,
      email,
      provider,
      name: profile.name,
      role: statePayload.role,
      level: statePayload.level,
      message: profile.name
        ? 'SNS 계정 인증이 완료되었습니다. 가입 정보를 확인해 주세요.'
        : 'SNS 계정 인증이 완료되었습니다. 이름을 직접 입력해 주세요.',
    };
  }

  toFrontendOAuthRedirect(result: Record<string, unknown>) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5050');
    const url = new URL(frontendUrl);
    url.searchParams.set('oauthResult', JSON.stringify(result));
    return url.toString();
  }

  async sendCode(dto: SendCodeDto) {
    const email = dto.email.trim().toLowerCase();
    const code = String(randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.codeRepository.save(
      this.codeRepository.create({
        email,
        provider: dto.provider,
        codeHash: this.hashCode(code),
        profileTokenHash: null,
        role: null,
        level: null,
        name: null,
        expiresAt,
        verifiedAt: null,
      }),
    );

    const delivery = await this.mailService.sendAuthCode(email, code);
    return {
      ok: true,
      delivered: delivery.delivered,
      fallback: delivery.fallback,
      expiresAt,
      message: delivery.delivered
        ? '인증 메일을 발송했습니다.'
        : 'SMTP 미설정 상태입니다. 서버 콘솔의 인증코드를 입력하세요.',
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.findExistingAccount(email, dto.provider);
    if (!existing) {
      throw new UnauthorizedException('등록된 계정이 없습니다. 회원가입을 진행해 주세요.');
    }
    return this.authenticatedResponse(existing);
  }

  async verifyCode(dto: VerifyCodeDto) {
    const email = dto.email.trim().toLowerCase();
    const latest = await this.codeRepository.findOne({
      where: {
        email,
        provider: dto.provider,
        verifiedAt: IsNull(),
      },
      order: { createdAt: 'DESC' },
    });

    if (!latest) {
      throw new UnauthorizedException('인증 요청을 찾을 수 없습니다.');
    }
    if (latest.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('인증 코드가 만료되었습니다.');
    }
    if (latest.codeHash !== this.hashCode(dto.code)) {
      throw new UnauthorizedException('인증 코드가 일치하지 않습니다.');
    }

    latest.verifiedAt = new Date();
    const existing = await this.findExistingAccount(email, dto.provider);
    if (existing) {
      await this.codeRepository.save(latest);
      return this.authenticatedResponse(existing);
    }

    const profileToken = randomBytes(32).toString('hex');
    latest.profileTokenHash = this.hashCode(profileToken);
    await this.codeRepository.save(latest);

    return {
      ok: true,
      requiresProfile: true,
      profileToken,
      email,
      provider: latest.provider,
      message: '등록된 계정 정보가 없습니다. 관리자 또는 근무자 정보를 등록해 주세요.',
    };
  }

  async completeProfile(dto: CompleteProfileDto) {
    const email = dto.email.trim().toLowerCase();
    const displayName = dto.name.trim();
    if (displayName.length < 2 || displayName.toLowerCase() === email || displayName.includes('@')) {
      throw new BadRequestException('이름은 이메일이 아닌 실제 이름으로 2자 이상 입력해 주세요.');
    }
    const verified = await this.codeRepository.findOne({
      where: { email, provider: dto.provider },
      order: { createdAt: 'DESC' },
    });
    if (!verified?.verifiedAt || !verified.profileTokenHash) {
      throw new UnauthorizedException('프로필 등록 권한이 없습니다.');
    }
    if (verified.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('프로필 등록 시간이 만료되었습니다.');
    }
    if (verified.profileTokenHash !== this.hashCode(dto.profileToken)) {
      throw new UnauthorizedException('프로필 토큰이 일치하지 않습니다.');
    }

    verified.name = displayName;
    verified.role = dto.role;
    verified.level = dto.level;
    await this.codeRepository.save(verified);

    if (dto.role === 'master') {
      const request = await this.upsertMasterSignupRequest(email, dto.provider, displayName, dto.level);
      return {
        ok: true,
        pending: true,
        requiresProfile: false,
        requestId: request.id,
        email,
        provider: dto.provider,
        message: '관리자 가입 요청이 승인 대기 상태로 등록되었습니다. 기존 관리자 승인 전까지 로그인할 수 없습니다. 관리자에게 문의해 주세요.',
      };
    }

    const account = await this.upsertMember(email, dto.provider, displayName, dto.level);

    return this.authenticatedResponse({
      id: account.id,
      email,
      provider: dto.provider,
      role: 'member',
      lv: account.mbLv,
      name: account.mbName,
    });
  }

  async findTesterMembers() {
    const testers = await this.memberRepository.find({
      where: { mbIsTester: true },
      order: { updatedAt: 'DESC' },
    });
    return testers.map((member) => ({
      id: member.id,
      email: member.mbId,
      name: '테스터',
      hidden: member.mbHidden,
      linked: Boolean(member.mbId),
      updatedAt: member.updatedAt,
    }));
  }

  async findPendingMasterSignupRequests(approverEmail: string) {
    await this.findMasterApprover(approverEmail);
    return this.masterSignupRequestRepository.find({
      where: { status: 'pending' },
      order: { createdAt: 'ASC' },
    });
  }

  async approveMasterSignupRequest(id: number, approverEmail: string) {
    const approver = await this.findMasterApprover(approverEmail);
    const request = await this.masterSignupRequestRepository.findOne({ where: { id } });
    if (!request) {
      throw new BadRequestException('관리자 가입 요청을 찾을 수 없습니다.');
    }
    if (request.status !== 'pending') {
      throw new BadRequestException('이미 처리된 관리자 가입 요청입니다.');
    }

    const master = await this.upsertMaster(request.email, request.name, request.level);
    request.status = 'approved';
    request.approvedBy = approver.msId;
    request.approvedAt = new Date();
    await this.masterSignupRequestRepository.save(request);

    return {
      ok: true,
      request,
      master: {
        id: master.id,
        email: master.msId,
        name: master.msName,
        lv: master.msLv,
      },
      message: `${request.name} 관리자 가입을 승인했습니다.`,
    };
  }

  async rejectMasterSignupRequest(id: number, approverEmail: string) {
    const approver = await this.findMasterApprover(approverEmail);
    const request = await this.masterSignupRequestRepository.findOne({ where: { id } });
    if (!request) {
      throw new BadRequestException('관리자 가입 요청을 찾을 수 없습니다.');
    }
    if (request.status !== 'pending') {
      throw new BadRequestException('이미 처리된 관리자 가입 요청입니다.');
    }

    request.status = 'rejected';
    request.rejectedBy = approver.msId;
    request.rejectedAt = new Date();
    await this.masterSignupRequestRepository.save(request);

    return {
      ok: true,
      request,
      message: `${request.name} 관리자 가입 요청을 거절했습니다.`,
    };
  }

  private async findExistingAccount(email: string, provider: 'google' | 'naver' | 'kakao' | 'email') {
    const master = await this.masterRepository.findOne({ where: { msId: email } });
    if (master) {
      return {
        id: master.id,
        email,
        provider,
        role: 'master' as const,
        lv: master.msLv,
        name: master.msName,
      };
    }

    const oauthAccount = await this.memberOauthRepository.findOne({
      where: { email, provider },
      relations: { member: true },
    });
    const sameEmailOauthAccount = oauthAccount
      ? null
      : await this.memberOauthRepository.findOne({
          where: { email },
          relations: { member: true },
        });
    const member =
      oauthAccount?.member ??
      sameEmailOauthAccount?.member ??
      await this.memberRepository.findOne({ where: { mbId: email } });
    if (member) {
      if (!oauthAccount) {
        await this.linkMemberOauthAccount(member, email, provider);
      }
      return {
        id: member.id,
        email,
        provider,
        role: 'member' as const,
        lv: member.mbLv,
        name: member.mbName,
      };
    }

    return null;
  }

  private authenticatedResponse(user: {
    id: number;
    email: string;
    provider: 'google' | 'naver' | 'kakao' | 'email';
    role: 'member' | 'master';
    lv: number;
    name: string;
  }) {
    return {
      ok: true,
      requiresProfile: false,
      accessToken: randomBytes(32).toString('hex'),
      user,
    };
  }

  private async upsertMember(email: string, provider: 'google' | 'naver' | 'kakao' | 'email', name: string, level: number) {
    const mbId = this.toAccountId(email);
    const isTester = testerEmails.has(mbId);
    const memberName = isTester ? '테스터' : name;
    let member = await this.memberRepository.findOne({ where: { mbId } });
    if (!member) {
      member = await this.memberRepository.findOne({
        where: {
          mbName: memberName,
          mbId: IsNull(),
        },
      });
    }
    if (!member && !isTester) {
      const sameNameMembers = await this.memberRepository.find({ where: { mbName: name } });
      if (sameNameMembers.length === 1) {
        member = sameNameMembers[0];
      }
    }
    if (!member) {
      member = this.memberRepository.create({
        mbId,
        mbName: memberName,
        mbLv: level,
        mbPhone: null,
        mbDepartment: null,
        mbIsTester: isTester,
        mbHidden: isTester,
        grade: null,
      });
    } else {
      member.mbId = member.mbId ?? mbId;
      member.mbName = memberName;
      member.mbLv = level;
      member.mbIsTester = isTester || member.mbIsTester;
      member.mbHidden = isTester || member.mbHidden;
    }
    const saved = await this.memberRepository.save(member);
    await this.linkMemberOauthAccount(saved, email, provider);
    return saved;
  }

  private async linkMemberOauthAccount(member: Member, email: string, provider: 'google' | 'naver' | 'kakao' | 'email') {
    const normalizedEmail = this.toAccountId(email);
    const existing = await this.memberOauthRepository.findOne({ where: { email: normalizedEmail, provider } });
    if (existing) {
      existing.member = member;
      return this.memberOauthRepository.save(existing);
    }
    return this.memberOauthRepository.save(
      this.memberOauthRepository.create({
        member,
        email: normalizedEmail,
        provider,
      }),
    );
  }

  private async upsertMasterSignupRequest(email: string, provider: 'google' | 'naver' | 'kakao' | 'email', name: string, level: number) {
    const msId = this.toAccountId(email);
    const existingMaster = await this.masterRepository.findOne({ where: { msId } });
    if (existingMaster) {
      throw new BadRequestException('이미 등록된 관리자 계정입니다. 로그인으로 진행해 주세요.');
    }

    const pending = await this.masterSignupRequestRepository.findOne({
      where: { email: msId, provider, status: 'pending' },
      order: { createdAt: 'DESC' },
    });
    if (pending) {
      pending.name = name;
      pending.level = level;
      return this.masterSignupRequestRepository.save(pending);
    }

    return this.masterSignupRequestRepository.save(
      this.masterSignupRequestRepository.create({
        email: msId,
        provider,
        name,
        level,
        status: 'pending',
        approvedBy: null,
        approvedAt: null,
        rejectedBy: null,
        rejectedAt: null,
      }),
    );
  }

  private async findMasterApprover(email: string) {
    const msId = this.toAccountId(email);
    const approver = await this.masterRepository.findOne({ where: { msId } });
    if (!approver) {
      throw new UnauthorizedException('관리자 승인 권한이 없습니다.');
    }
    return approver;
  }

  private async upsertMaster(email: string, name: string, level: number) {
    const msId = this.toAccountId(email);
    let master = await this.masterRepository.findOne({ where: { msId } });
    if (!master) {
      master = this.masterRepository.create({
        msId,
        msName: name,
        msLv: level,
        msPhone: null,
        sectionPermissions: this.defaultMasterPermissions(level),
      });
    } else {
      master.msName = name;
      master.msLv = level;
      master.sectionPermissions = this.defaultMasterPermissions(level);
    }
    return this.masterRepository.save(master);
  }

  private defaultMasterPermissions(level: number) {
    return {
      calendar: level >= 1,
      calendarView: level >= 1,
      wantedLeave: level >= 2,
      dayoff: level >= 3,
      logs: level >= 3,
      upload: level >= 4,
      grades: level >= 5,
    };
  }

  private hashCode(code: string) {
    return createHash('sha256').update(code).digest('hex');
  }

  private toAccountId(email: string) {
    const id = email.trim().toLowerCase();
    if (!id) {
      throw new BadRequestException('유효하지 않은 이메일입니다.');
    }
    return id;
  }

  private getOAuthClient(provider: 'google' | 'naver' | 'kakao') {
    const prefix = provider.toUpperCase();
    const clientId = this.configService.get<string>(`${prefix}_CLIENT_ID`);
    const clientSecret = this.configService.get<string>(`${prefix}_CLIENT_SECRET`);
    if (!clientId || !clientSecret) {
      throw new BadRequestException(`${provider} OAuth Client ID/Secret이 설정되지 않았습니다.`);
    }
    return { clientId, clientSecret };
  }

  private getOAuthRedirectUri(provider: 'google' | 'naver' | 'kakao') {
    const publicBaseUrl = this.configService.get<string>('OAUTH_PUBLIC_BASE_URL', 'http://localhost:3300');
    return `${publicBaseUrl.replace(/\/$/, '')}/auth/oauth/${provider}/callback`;
  }

  private signState(payload: { provider: 'google' | 'naver' | 'kakao'; mode: 'login' | 'signup'; role: 'member' | 'master'; level: number; nonce: string }) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.getStateSecret()).update(body).digest('base64url');
    return `${body}.${signature}`;
  }

  private verifyState(state: string) {
    const [body, signature] = state.split('.');
    const expected = createHmac('sha256', this.getStateSecret()).update(body).digest('base64url');
    if (!body || !signature || signature !== expected) {
      throw new UnauthorizedException('SNS 인증 state가 올바르지 않습니다.');
    }
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      provider: 'google' | 'naver' | 'kakao';
      mode: 'login' | 'signup';
      role: 'member' | 'master';
      level: number;
      nonce: string;
    };
  }

  private getStateSecret() {
    return this.configService.get<string>('OAUTH_STATE_SECRET', 'duty-oauth-state-dev-secret');
  }

  private getProviderLabel(provider: 'google' | 'naver' | 'kakao' | 'email') {
    const labels = {
      google: 'Google',
      naver: 'Naver',
      kakao: 'Kakao',
      email: '이메일',
    };
    return labels[provider];
  }

  private async fetchOAuthProfile(provider: 'google' | 'naver' | 'kakao', code: string) {
    const token = await this.exchangeOAuthToken(provider, code);
    if (provider === 'google') {
      const profile = await this.getJson<{ sub: string; email?: string; name?: string }>('https://openidconnect.googleapis.com/v1/userinfo', token.accessToken);
      if (!profile.email) throw new UnauthorizedException('Google 계정 이메일을 확인할 수 없습니다.');
      return { providerId: profile.sub, email: profile.email, name: profile.name ?? '' };
    }
    if (provider === 'naver') {
      const profile = await this.getJson<{ response?: { id: string; email?: string; name?: string; nickname?: string } }>('https://openapi.naver.com/v1/nid/me', token.accessToken);
      const response = profile.response;
      if (!response?.email) throw new UnauthorizedException('Naver 계정 이메일을 확인할 수 없습니다.');
      return { providerId: response.id, email: response.email, name: response.name ?? response.nickname ?? '' };
    }
    const profile = await this.getJson<{ id: number; kakao_account?: { email?: string; profile?: { nickname?: string } } }>('https://kapi.kakao.com/v2/user/me', token.accessToken);
    const email = profile.kakao_account?.email;
    if (!email) throw new UnauthorizedException('Kakao 계정 이메일 제공 동의가 필요합니다.');
    return { providerId: String(profile.id), email, name: profile.kakao_account?.profile?.nickname ?? '' };
  }

  private async exchangeOAuthToken(provider: 'google' | 'naver' | 'kakao', code: string) {
    const client = this.getOAuthClient(provider);
    const redirectUri = this.getOAuthRedirectUri(provider);
    const tokenUrl =
      provider === 'google'
        ? 'https://oauth2.googleapis.com/token'
        : provider === 'naver'
          ? 'https://nid.naver.com/oauth2.0/token'
          : 'https://kauth.kakao.com/oauth/token';
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: client.clientId,
      client_secret: client.clientSecret,
      redirect_uri: redirectUri,
      code,
    });
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const result = (await response.json()) as { access_token?: string; error_description?: string; error?: string };
    if (!response.ok || !result.access_token) {
      throw new UnauthorizedException(result.error_description ?? result.error ?? 'SNS 토큰 발급 실패');
    }
    return { accessToken: result.access_token };
  }

  private async getJson<T>(url: string, accessToken: string) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const result = (await response.json()) as T;
    if (!response.ok) {
      throw new UnauthorizedException('SNS 프로필 조회 실패');
    }
    return result;
  }

}
