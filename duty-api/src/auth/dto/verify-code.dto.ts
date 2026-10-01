import { IsEmail, IsIn, IsString, Length } from 'class-validator';

export class VerifyCodeDto {
  @IsEmail()
  email: string;

  @IsIn(['google', 'naver', 'kakao', 'email'])
  provider: 'google' | 'naver' | 'kakao' | 'email';

  @IsString()
  @Length(6, 6)
  code: string;
}
