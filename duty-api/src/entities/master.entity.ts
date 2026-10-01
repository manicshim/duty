import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'master' })
export class Master {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'ms_id', unique: true, length: 80 })
  msId: string;

  @Column({ name: 'ms_lv', default: 1 })
  msLv: number;

  @Column({ name: 'ms_name', length: 80 })
  msName: string;

  @Column({ name: 'ms_phone', type: 'varchar', nullable: true, length: 30 })
  msPhone: string | null;

  @Column({ name: 'section_permissions', type: 'json', nullable: true })
  sectionPermissions: Record<string, boolean> | null;

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
