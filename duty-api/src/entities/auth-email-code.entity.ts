import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'auth_email_code' })
@Index(['email', 'provider'])
export class AuthEmailCode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  email: string;

  @Column({ length: 30 })
  provider: 'google' | 'naver' | 'kakao' | 'email';

  @Column({ name: 'code_hash', length: 128 })
  codeHash: string;

  @Column({ name: 'profile_token_hash', type: 'varchar', length: 128, nullable: true })
  profileTokenHash: string | null;

  @Column({ name: 'role', type: 'varchar', length: 20, nullable: true })
  role: 'member' | 'master' | null;

  @Column({ name: 'level', type: 'int', nullable: true })
  level: number | null;

  @Column({ name: 'name', type: 'varchar', length: 80, nullable: true })
  name: string | null;

  @Column({ name: 'expires_at', type: 'datetime', precision: 3 })
  expiresAt: Date;

  @Column({ name: 'verified_at', type: 'datetime', precision: 3, nullable: true })
  verifiedAt: Date | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  createdAt: Date;
}
