import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendAuthCode(email: string, code: string) {
    const host = this.config.get<string>('SMTP_HOST');
    const port = this.config.get<number>('SMTP_PORT');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASSWORD');
    const from = this.config.get<string>('SMTP_FROM', user ?? 'DutyFlow <no-reply@duty.local>');

    if (!host || !port || !user || !pass) {
      this.logger.warn(`SMTP 미설정: ${email} 인증코드=${code}`);
      return { delivered: false, fallback: 'console' as const };
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to: email,
      subject: '[DutyFlow] 로그인 인증 코드',
      text: `DutyFlow 인증 코드는 ${code} 입니다. 5분 안에 입력해 주세요.`,
      html: `<p>DutyFlow 인증 코드는 <strong>${code}</strong> 입니다.</p><p>5분 안에 입력해 주세요.</p>`,
    });

    return { delivered: true, fallback: null };
  }
}
