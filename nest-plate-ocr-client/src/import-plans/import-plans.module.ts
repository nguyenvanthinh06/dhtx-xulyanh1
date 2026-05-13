import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Material } from '../materials/material.entity';
import { Project } from '../projects/project.entity';
import { Supplier } from '../suppliers/supplier.entity';
import { ImportPlan } from './import-plan.entity';
import { ImportPlansController } from './import-plans.controller';
import { ImportPlansService } from './import-plans.service';

@Module({
  imports: [TypeOrmModule.forFeature([ImportPlan, Project, Material, Supplier])],
  controllers: [ImportPlansController],
  providers: [ImportPlansService],
  exports: [ImportPlansService, TypeOrmModule],
})
export class ImportPlansModule {}
