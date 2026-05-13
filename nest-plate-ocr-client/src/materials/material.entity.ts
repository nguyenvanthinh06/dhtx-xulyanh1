import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type MaterialCategory =
  | 'aggregate'
  | 'steel'
  | 'concrete'
  | 'plumbing'
  | 'electrical'
  | 'finishing'
  | 'other';

@Entity('materials')
export class Material {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ default: 'other' })
  category: MaterialCategory;

  @Column({ default: 'kg' })
  unit: string;

  @Column({ type: 'double precision', default: 0 })
  defaultUnitPrice: number;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
