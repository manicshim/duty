import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'master_signup_request' })
export class MasterSignupRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  email: string;

  @Column({ length: 30 })
  provider: 'google' | 'naver' | 'kakao' | 'email';

  @Column({ length: 80 })
  name: string;

  @Column({ default: 1 })
  level: number;

  @Column({ length: 30, default: 'pending' })
  status: 'pending' | 'approved' | 'rejected';

  @Column({ name: 'approved_by', type: 'varchar', nullable: true, length: 80 })
  approvedBy: string | null;

  @Column({ name: 'approved_at', type: 'datetime', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'rejected_by', type: 'varchar', nullable: true, length: 80 })
  rejectedBy: string | null;

  @Column({ name: 'rejected_at', type: 'datetime', nullable: true })
  rejectedAt: Date | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
    onUpdate: 'CURRENT_TIMESTAMP(3)',
  })
  updatedAt: Date;
}
