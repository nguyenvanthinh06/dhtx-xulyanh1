import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImportPlan } from '../import-plans/import-plan.entity';
import { Material } from '../materials/material.entity';
import { PlateOcrService } from '../plate-ocr/plate-ocr.service';
import { PythonPlateOcrResponse } from '../plate-ocr/plate-ocr.types';
import { Project } from '../projects/project.entity';
import { Supplier } from '../suppliers/supplier.entity';
import {
  CreateMaterialTripDto,
  MaterialTripQueryDto,
  UpdateMaterialTripDto,
} from './material-trip.dto';
import { MaterialTrip } from './material-trip.entity';

@Injectable()
export class MaterialTripsService {
  constructor(
    @InjectRepository(MaterialTrip)
    private readonly materialTripsRepository: Repository<MaterialTrip>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(Material)
    private readonly materialsRepository: Repository<Material>,
    @InjectRepository(Supplier)
    private readonly suppliersRepository: Repository<Supplier>,
    @InjectRepository(ImportPlan)
    private readonly importPlansRepository: Repository<ImportPlan>,
    private readonly plateOcrService: PlateOcrService,
  ) {}

  async create(dto: CreateMaterialTripDto, ocr?: PythonPlateOcrResponse) {
    await this.ensureProject(dto.projectId);
    const material = await this.ensureMaterial(dto.materialId);
    await this.ensureSupplier(dto.supplierId);
    if (dto.importPlanId) {
      await this.ensureImportPlan(dto.importPlanId);
    }

    const quantity = Number(dto.quantity ?? 0);
    const unitPrice = Number(dto.unitPrice ?? material.defaultUnitPrice ?? 0);
    const firstPlate = ocr?.plates?.[0];
    const detectedPlate = ocr?.text || firstPlate?.text || dto.detectedPlate;

    const trip = this.materialTripsRepository.create({
      ...dto,
      licensePlate: dto.licensePlate || detectedPlate || undefined,
      detectedPlate,
      plateConfidence: firstPlate?.score ?? dto.plateConfidence,
      ocrSource: firstPlate?.ocr_source ?? dto.ocrSource,
      ocrImagePath: ocr?.image_path ?? dto.ocrImagePath,
      ocrOutputPath: ocr?.output_path ?? dto.ocrOutputPath,
      ocrPayload: (ocr as unknown as Record<string, unknown>) ?? dto.ocrPayload,
      quantity,
      unitPrice,
      totalPrice: quantity * unitPrice,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
      status: dto.status ?? 'pending',
    });

    return this.materialTripsRepository.save(trip);
  }

  async createWithPlateImage(dto: CreateMaterialTripDto, file: Express.Multer.File) {
    const ocr = await this.plateOcrService.detectFromUpload(file);
    return this.create(dto, ocr);
  }

  findAll(query: MaterialTripQueryDto) {
    const qb = this.materialTripsRepository.createQueryBuilder('trip');
    qb.leftJoinAndSelect('trip.project', 'project')
      .leftJoinAndSelect('trip.material', 'material')
      .leftJoinAndSelect('trip.supplier', 'supplier')
      .leftJoinAndSelect('trip.importPlan', 'importPlan')
      .orderBy('trip.occurredAt', 'DESC')
      .addOrderBy('trip.createdAt', 'DESC');

    if (query.projectId) {
      qb.andWhere('trip.projectId = :projectId', { projectId: query.projectId });
    }
    if (query.materialId) {
      qb.andWhere('trip.materialId = :materialId', { materialId: query.materialId });
    }
    if (query.supplierId) {
      qb.andWhere('trip.supplierId = :supplierId', { supplierId: query.supplierId });
    }
    if (query.status) {
      qb.andWhere('trip.status = :status', { status: query.status });
    }
    if (query.from) {
      qb.andWhere('trip.occurredAt >= :from', { from: new Date(query.from) });
    }
    if (query.to) {
      qb.andWhere('trip.occurredAt <= :to', { to: new Date(query.to) });
    }

    return qb.getMany();
  }

  async findOne(id: string) {
    const trip = await this.materialTripsRepository.findOne({ where: { id } });
    if (!trip) {
      throw new NotFoundException('Material trip not found.');
    }
    return trip;
  }

  async update(id: string, dto: UpdateMaterialTripDto) {
    const trip = await this.findOne(id);

    if (dto.projectId) {
      await this.ensureProject(dto.projectId);
    }
    if (dto.materialId) {
      await this.ensureMaterial(dto.materialId);
    }
    if (dto.supplierId) {
      await this.ensureSupplier(dto.supplierId);
    }
    if (dto.importPlanId) {
      await this.ensureImportPlan(dto.importPlanId);
    }

    Object.assign(trip, dto);
    if (dto.occurredAt) {
      trip.occurredAt = new Date(dto.occurredAt);
    }
    if (dto.quantity !== undefined || dto.unitPrice !== undefined) {
      trip.quantity = Number(dto.quantity ?? trip.quantity);
      trip.unitPrice = Number(dto.unitPrice ?? trip.unitPrice);
      trip.totalPrice = trip.quantity * trip.unitPrice;
    }

    return this.materialTripsRepository.save(trip);
  }

  async detectPlateForTrip(id: string, file: Express.Multer.File) {
    const trip = await this.findOne(id);
    const ocr = await this.plateOcrService.detectFromUpload(file);
    const firstPlate = ocr.plates?.[0];

    trip.detectedPlate = ocr.text || firstPlate?.text;
    trip.licensePlate = trip.licensePlate || trip.detectedPlate;
    trip.plateConfidence = firstPlate?.score;
    trip.ocrSource = firstPlate?.ocr_source;
    trip.ocrImagePath = ocr.image_path;
    trip.ocrOutputPath = ocr.output_path;
    trip.ocrPayload = ocr as unknown as Record<string, unknown>;

    return this.materialTripsRepository.save(trip);
  }

  async remove(id: string) {
    const trip = await this.findOne(id);
    await this.materialTripsRepository.remove(trip);
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

  private async ensureImportPlan(id: string) {
    const plan = await this.importPlansRepository.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Import plan not found.');
    }
    return plan;
  }
}
