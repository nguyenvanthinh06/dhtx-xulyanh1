import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { MaterialTripStatus } from './material-trip.entity';

export class CreateMaterialTripDto {
  @IsUUID()
  projectId: string;

  @IsUUID()
  materialId: string;

  @IsUUID()
  supplierId: string;

  @IsOptional()
  @IsUUID()
  importPlanId?: string;

  @IsOptional()
  @IsString()
  ticketCode?: string;

  @IsOptional()
  @IsString()
  driverName?: string;

  @IsOptional()
  @IsString()
  vehicleType?: string;

  @IsOptional()
  @IsString()
  licensePlate?: string;

  @IsOptional()
  @IsString()
  detectedPlate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  plateConfidence?: number;

  @IsOptional()
  @IsString()
  ocrSource?: string;

  @IsOptional()
  @IsString()
  ocrImagePath?: string;

  @IsOptional()
  @IsString()
  ocrOutputPath?: string;

  @IsOptional()
  @IsObject()
  ocrPayload?: Record<string, unknown>;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsString()
  occurredAt?: string;

  @IsOptional()
  @IsIn(['pending', 'verified', 'rejected'])
  status?: MaterialTripStatus;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateMaterialTripDto {
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
  @IsUUID()
  importPlanId?: string;

  @IsOptional()
  @IsString()
  ticketCode?: string;

  @IsOptional()
  @IsString()
  driverName?: string;

  @IsOptional()
  @IsString()
  vehicleType?: string;

  @IsOptional()
  @IsString()
  licensePlate?: string;

  @IsOptional()
  @IsString()
  detectedPlate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  plateConfidence?: number;

  @IsOptional()
  @IsString()
  ocrSource?: string;

  @IsOptional()
  @IsString()
  ocrImagePath?: string;

  @IsOptional()
  @IsString()
  ocrOutputPath?: string;

  @IsOptional()
  @IsObject()
  ocrPayload?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsString()
  occurredAt?: string;

  @IsOptional()
  @IsIn(['pending', 'verified', 'rejected'])
  status?: MaterialTripStatus;

  @IsOptional()
  @IsString()
  note?: string;
}

export class MaterialTripQueryDto {
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
  @IsIn(['pending', 'verified', 'rejected'])
  status?: MaterialTripStatus;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}
