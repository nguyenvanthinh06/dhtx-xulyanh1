import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ImportPlan } from '../import-plans/import-plan.entity';
import { Material } from '../materials/material.entity';
import { Project } from '../projects/project.entity';
import { Supplier } from '../suppliers/supplier.entity';

export type MaterialTripStatus = 'pending' | 'verified' | 'rejected';

@Entity('material_trips')
export class MaterialTrip {
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

  @Column({ type: 'uuid' })
  supplierId: string;

  @ManyToOne(() => Supplier, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplierId' })
  supplier: Supplier;

  @Column({ type: 'uuid', nullable: true })
  importPlanId?: string;

  @ManyToOne(() => ImportPlan, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'importPlanId' })
  importPlan?: ImportPlan;

  @Column({ nullable: true })
  ticketCode?: string;

  @Column({ nullable: true })
  driverName?: string;

  @Column({ nullable: true })
  vehicleType?: string;

  @Column({ nullable: true })
  licensePlate?: string;

  @Column({ nullable: true })
  detectedPlate?: string;

  @Column({ type: 'double precision', nullable: true })
  plateConfidence?: number;

  @Column({ nullable: true })
  ocrSource?: string;

  @Column({ nullable: true })
  ocrImagePath?: string;

  @Column({ nullable: true })
  ocrOutputPath?: string;

  @Column({ type: 'jsonb', nullable: true })
  ocrPayload?: Record<string, unknown>;

  @Column({ type: 'double precision', default: 0 })
  quantity: number;

  @Column({ type: 'double precision', default: 0 })
  unitPrice: number;

  @Column({ type: 'double precision', default: 0 })
  totalPrice: number;

  @Column({ type: 'timestamptz' })
  occurredAt: Date;

  @Column({ default: 'pending' })
  status: MaterialTripStatus;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
