import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { DutyCalendar } from './duty-calendar.entity';

@Entity({ name: 'upload_log' })
export class UploadLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'original_name', length: 255 })
  originalName: string;

  @Column({ name: 'stored_name', type: 'varchar', nullable: true, length: 255 })
  storedName: string | null;

  @Column({ name: 'target_year' })
  targetYear: number;

  @Column({ name: 'target_month' })
  targetMonth: number;

  @Column({ name: 'row_count', default: 0 })
  rowCount: number;

  @Column({ name: 'status', length: 30, default: 'success' })
  status: 'success' | 'failed';

  @Column({ name: 'message', type: 'text', nullable: true })
  message: string | null;

  @OneToMany(() => DutyCalendar, (duty) => duty.uploadLog)
  duties: DutyCalendar[];

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  createdAt: Date;
}
