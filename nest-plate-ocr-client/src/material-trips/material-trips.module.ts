import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImportPlan } from '../import-plans/import-plan.entity';
import { Material } from '../materials/material.entity';
import { PlateOcrModule } from '../plate-ocr/plate-ocr.module';
import { Project } from '../projects/project.entity';
import { Supplier } from '../suppliers/supplier.entity';
import { MaterialTrip } from './material-trip.entity';
import { MaterialTripsController } from './material-trips.controller';
import { MaterialTripsService } from './material-trips.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MaterialTrip, Project, Material, Supplier, ImportPlan]),
    PlateOcrModule,
  ],
  controllers: [MaterialTripsController],
  providers: [MaterialTripsService],
  exports: [MaterialTripsService, TypeOrmModule],
})
export class MaterialTripsModule {}
