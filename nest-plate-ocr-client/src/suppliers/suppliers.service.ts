import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { CreateSupplierDto, UpdateSupplierDto } from './supplier.dto';
import { Supplier } from './supplier.entity';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly suppliersRepository: Repository<Supplier>,
  ) {}

  create(dto: CreateSupplierDto) {
    const supplier = this.suppliersRepository.create({
      ...dto,
      active: dto.active ?? true,
    });
    return this.suppliersRepository.save(supplier);
  }

  findAll(search?: string) {
    return this.suppliersRepository.find({
      where: search
        ? [
            { code: ILike(`%${search}%`) },
            { name: ILike(`%${search}%`) },
            { phone: ILike(`%${search}%`) },
            { taxCode: ILike(`%${search}%`) },
          ]
        : undefined,
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string) {
    const supplier = await this.suppliersRepository.findOne({ where: { id } });
    if (!supplier) {
      throw new NotFoundException('Supplier not found.');
    }
    return supplier;
  }

  async update(id: string, dto: UpdateSupplierDto) {
    const supplier = await this.findOne(id);
    Object.assign(supplier, dto);
    return this.suppliersRepository.save(supplier);
  }

  async remove(id: string) {
    const supplier = await this.findOne(id);
    await this.suppliersRepository.remove(supplier);
    return { deleted: true };
  }
}
