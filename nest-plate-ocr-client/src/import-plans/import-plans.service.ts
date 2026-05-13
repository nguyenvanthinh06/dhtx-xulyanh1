import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Material } from '../materials/material.entity';
import { Project } from '../projects/project.entity';
import { Supplier } from '../suppliers/supplier.entity';
import {
  CreateImportPlanDto,
  ImportPlanQueryDto,
  UpdateImportPlanDto,
} from './import-plan.dto';
import { ImportPlan } from './import-plan.entity';

@Injectable()
export class ImportPlansService {
  constructor(
    @InjectRepository(ImportPlan)
    private readonly importPlansRepository: Repository<ImportPlan>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(Material)
    private readonly materialsRepository: Repository<Material>,
    @InjectRepository(Supplier)
    private readonly suppliersRepository: Repository<Supplier>,
  ) {}

  async create(dto: CreateImportPlanDto) {
    await this.ensureProject(dto.projectId);
    const material = await this.ensureMaterial(dto.materialId);
    if (dto.supplierId) {
      await this.ensureSupplier(dto.supplierId);
    }

    const plan = this.importPlansRepository.create({
      ...dto,
      unitPrice: dto.unitPrice ?? material.defaultUnitPrice ?? 0,
      status: dto.status ?? 'planned',
    });
    return this.importPlansRepository.save(plan);
  }

  findAll(query: ImportPlanQueryDto) {
    const qb = this.importPlansRepository.createQueryBuilder('plan');
    qb.leftJoinAndSelect('plan.project', 'project')
      .leftJoinAndSelect('plan.material', 'material')
      .leftJoinAndSelect('plan.supplier', 'supplier')
      .orderBy('plan.plannedDate', 'DESC')
      .addOrderBy('plan.createdAt', 'DESC');

    if (query.projectId) {
      qb.andWhere('plan.projectId = :projectId', { projectId: query.projectId });
    }
    if (query.materialId) {
      qb.andWhere('plan.materialId = :materialId', { materialId: query.materialId });
    }
    if (query.supplierId) {
      qb.andWhere('plan.supplierId = :supplierId', { supplierId: query.supplierId });
    }
    if (query.status) {
      qb.andWhere('plan.status = :status', { status: query.status });
    }

    return qb.getMany();
  }

  async findOne(id: string) {
    const plan = await this.importPlansRepository.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Import plan not found.');
    }
    return plan;
  }

  async update(id: string, dto: UpdateImportPlanDto) {
    const plan = await this.findOne(id);

    if (dto.projectId) {
      await this.ensureProject(dto.projectId);
    }
    if (dto.materialId) {
      await this.ensureMaterial(dto.materialId);
    }
    if (dto.supplierId) {
      await this.ensureSupplier(dto.supplierId);
    }

    Object.assign(plan, dto);
    return this.importPlansRepository.save(plan);
  }

  async remove(id: string) {
    const plan = await this.findOne(id);
    await this.importPlansRepository.remove(plan);
    return { deleted: true };
  }

  private async ensureProject(id: string) {
    const project = await this.projectsRepository.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException('Project not found.');
    }
    return project;
  }

  private async ensureMaterial(id: string) {
    const material = await this.materialsRepository.findOne({ where: { id } });
    if (!material) {
      throw new NotFoundException('Material not found.');
    }
    return material;
  }

  private async ensureSupplier(id: string) {
    const supplier = await this.suppliersRepository.findOne({ where: { id } });
    if (!supplier) {
      throw new NotFoundException('Supplier not found.');
    }
    return supplier;
  }
}
