import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Member } from './member.entity';

@Entity({ name: 'member_wanted_leave' })
export class MemberWantedLeave {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Member, (member) => member.wantedLeaves, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'member_id' })
  member: Member;

  @Column({ name: 'leave_date', type: 'date' })
  leaveDate: string;

  @Column({ name: 'reason', type: 'varchar', nullable: true, length: 255 })
  reason: string | null;

  @Column({ name: 'status', default: 'requested', length: 30 })
  status: 'requested' | 'approved' | 'rejected';

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
