import { IsEmail, IsIn, IsInt, IsString, Max, Min, MinLength } from 'class-validator';

export class CompleteProfileDto {
  @IsEmail()
  email: string;

  @IsIn(['google', 'naver', 'kakao', 'email'])
  provider: 'google' | 'naver' | 'kakao' | 'email';

  @IsString()
  @MinLength(32)
  profileToken: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsIn(['member', 'master'])
  role: 'member' | 'master';

  @IsInt()
  @Min(1)
  @Max(5)
  level: number;
}
