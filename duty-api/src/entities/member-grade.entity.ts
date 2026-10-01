import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Member } from './member.entity';

@Entity({ name: 'member_grade' })
export class MemberGrade {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'grade_code', unique: true, length: 30 })
  gradeCode: string;

  @Column({ name: 'grade_name', length: 80 })
  gradeName: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @OneToMany(() => Member, (member) => member.grade)
  members: Member[];

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
