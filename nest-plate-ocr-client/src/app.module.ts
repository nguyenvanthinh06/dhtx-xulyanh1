import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImportPlansModule } from './import-plans/import-plans.module';
import { MaterialsModule } from './materials/materials.module';
import { MaterialTripsModule } from './material-trips/material-trips.module';
import { PlateOcrModule } from './plate-ocr/plate-ocr.module';
import { ProjectsModule } from './projects/projects.module';
import { ReportsModule } from './reports/reports.module';
import { SuppliersModule } from './suppliers/suppliers.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 5432),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'construction_materials',
      autoLoadEntities: true,
      synchronize: process.env.TYPEORM_SYNCHRONIZE !== 'false',
    }),
    PlateOcrModule,
    ProjectsModule,
    MaterialsModule,
    SuppliersModule,
    ImportPlansModule,
    MaterialTripsModule,
    ReportsModule,
  ],
})
export class AppModule {}
