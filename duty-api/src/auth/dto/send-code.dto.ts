import { IsEmail, IsIn } from 'class-validator';

export class SendCodeDto {
  @IsEmail()
  email: string;

  @IsIn(['google', 'naver', 'kakao', 'email'])
  provider: 'google' | 'naver' | 'kakao' | 'email';
}
