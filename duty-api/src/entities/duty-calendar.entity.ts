import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Member } from './member.entity';
import { UploadLog } from './upload-log.entity';

@Entity({ name: 'duty_calendar' })
@Index(['member', 'dutyDate'], { unique: true })
export class DutyCalendar {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Member, (member) => member.duties, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'member_id' })
  member: Member;

  @Column({ name: 'duty_date', type: 'date' })
  dutyDate: string;

  @Column({ name: 'duty_code', length: 30 })
  dutyCode: string;

  @Column({ name: 'duty_label', type: 'varchar', nullable: true, length: 100 })
  dutyLabel: string | null;

  @Column({ name: 'source_row', type: 'int', nullable: true })
  sourceRow: number | null;

  @Column({ name: 'source_col', type: 'int', nullable: true })
  sourceCol: number | null;

  @ManyToOne(() => UploadLog, (log) => log.duties, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'upload_log_id' })
  uploadLog: UploadLog | null;

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
