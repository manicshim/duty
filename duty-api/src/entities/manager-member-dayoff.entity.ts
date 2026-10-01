import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Master } from './master.entity';
import { Member } from './member.entity';

@Entity({ name: 'manager_member_dayoff' })
export class ManagerMemberDayoff {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Member, (member) => member.managedDayoffs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'member_id' })
  member: Member;

  @ManyToOne(() => Master, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'master_id' })
  master: Master | null;

  @Column({ name: 'dayoff_date', type: 'date' })
  dayoffDate: string;

  @Column({ name: 'memo', type: 'varchar', nullable: true, length: 255 })
  memo: string | null;

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
