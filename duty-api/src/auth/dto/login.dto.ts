import { IsEmail, IsIn } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsIn(['google', 'naver', 'kakao', 'email'])
  provider: 'google' | 'naver' | 'kakao' | 'email';
}
