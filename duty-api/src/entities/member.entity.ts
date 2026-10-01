import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DutyCalendar } from './duty-calendar.entity';
import { MemberGrade } from './member-grade.entity';
import { MemberWantedLeave } from './member-wanted-leave.entity';
import { ManagerMemberDayoff } from './manager-member-dayoff.entity';

@Entity({ name: 'member' })
export class Member {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'mb_id', type: 'varchar', unique: true, nullable: true, length: 80 })
  mbId: string | null;

  @Column({ name: 'mb_phone', type: 'varchar', nullable: true, length: 30 })
  mbPhone: string | null;

  @Column({ name: 'mb_lv', default: 1 })
  mbLv: number;

  @Column({ name: 'mb_name', length: 80 })
  mbName: string;

  @Column({ name: 'mb_department', type: 'varchar', nullable: true, length: 100 })
  mbDepartment: string | null;

  @Column({ name: 'mb_sort_order', type: 'int', nullable: true })
  mbSortOrder: number | null;

  @Column({ name: 'mb_is_tester', type: 'boolean', default: false })
  mbIsTester: boolean;

  @Column({ name: 'mb_hidden', type: 'boolean', default: false })
  mbHidden: boolean;

  @ManyToOne(() => MemberGrade, (grade) => grade.members, { nullable: true })
  @JoinColumn({ name: 'grade_id' })
  grade: MemberGrade | null;

  @OneToMany(() => DutyCalendar, (duty) => duty.member)
  duties: DutyCalendar[];

  @OneToMany(() => MemberWantedLeave, (leave) => leave.member)
  wantedLeaves: MemberWantedLeave[];

  @OneToMany(() => ManagerMemberDayoff, (dayoff) => dayoff.member)
  managedDayoffs: ManagerMemberDayoff[];

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
