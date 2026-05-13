import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Material } from '../materials/material.entity';
import { Project } from '../projects/project.entity';
import { Supplier } from '../suppliers/supplier.entity';

export type ImportPlanStatus = 'planned' | 'partial' | 'completed' | 'cancelled';

@Entity('import_plans')
export class ImportPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column({ type: 'uuid' })
  materialId: string;

  @ManyToOne(() => Material, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'materialId' })
  material: Material;

  @Column({ type: 'uuid', nullable: true })
  supplierId?: string;

  @ManyToOne(() => Supplier, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'supplierId' })
  supplier?: Supplier;

  @Column({ type: 'double precision', default: 0 })
  plannedQuantity: number;

  @Column({ type: 'double precision', default: 0 })
  unitPrice: number;

  @Column({ type: 'date', nullable: true })
  plannedDate?: string;

  @Column({ default: 'planned' })
  status: ImportPlanStatus;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
