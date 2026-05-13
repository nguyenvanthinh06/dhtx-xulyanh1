import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { CreateMaterialDto, UpdateMaterialDto } from './material.dto';
import { Material } from './material.entity';

@Injectable()
export class MaterialsService {
  constructor(
    @InjectRepository(Material)
    private readonly materialsRepository: Repository<Material>,
  ) {}

  create(dto: CreateMaterialDto) {
    const material = this.materialsRepository.create({
      ...dto,
      category: dto.category ?? 'other',
      defaultUnitPrice: dto.defaultUnitPrice ?? 0,
      active: dto.active ?? true,
    });
    return this.materialsRepository.save(material);
  }

  findAll(search?: string) {
    return this.materialsRepository.find({
      where: search
        ? [
            { code: ILike(`%${search}%`) },
            { name: ILike(`%${search}%`) },
            { category: ILike(`%${search}%`) as any },
          ]
        : undefined,
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string) {
    const material = await this.materialsRepository.findOne({ where: { id } });
    if (!material) {
      throw new NotFoundException('Material not found.');
    }
    return material;
  }

  async update(id: string, dto: UpdateMaterialDto) {
    const material = await this.findOne(id);
    Object.assign(material, dto);
    return this.materialsRepository.save(material);
  }

  async remove(id: string) {
    const material = await this.findOne(id);
    await this.materialsRepository.remove(material);
    return { deleted: true };
  }
}
