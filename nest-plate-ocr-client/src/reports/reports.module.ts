import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaterialTrip } from '../material-trips/material-trip.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [TypeOrmModule.forFeature([MaterialTrip])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
