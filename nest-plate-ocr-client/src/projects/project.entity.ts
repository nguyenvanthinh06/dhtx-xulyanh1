import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ProjectStatus = 'active' | 'paused' | 'completed';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  location?: string;

  @Column({ nullable: true })
  clientName?: string;

  @Column({ default: 'active' })
  status: ProjectStatus;

  @Column({ type: 'date', nullable: true })
  startDate?: string;

  @Column({ type: 'date', nullable: true })
  endDate?: string;

  @Column({ type: 'double precision', default: 0 })
  budget: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
