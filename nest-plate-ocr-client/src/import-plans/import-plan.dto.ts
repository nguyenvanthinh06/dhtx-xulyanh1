import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ImportPlanStatus } from './import-plan.entity';

export class CreateImportPlanDto {
  @IsUUID()
  projectId: string;

  @IsUUID()
  materialId: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  plannedQuantity: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsString()
  plannedDate?: string;

  @IsOptional()
  @IsIn(['planned', 'partial', 'completed', 'cancelled'])
  status?: ImportPlanStatus;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateImportPlanDto {
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  materialId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  plannedQuantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsString()
  plannedDate?: string;

  @IsOptional()
  @IsIn(['planned', 'partial', 'completed', 'cancelled'])
  status?: ImportPlanStatus;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ImportPlanQueryDto {
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  materialId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsIn(['planned', 'partial', 'completed', 'cancelled'])
  status?: ImportPlanStatus;
}
