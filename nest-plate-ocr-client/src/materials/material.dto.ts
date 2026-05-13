import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { MaterialCategory } from './material.entity';

const categories = [
  'aggregate',
  'steel',
  'concrete',
  'plumbing',
  'electrical',
  'finishing',
  'other',
];

export class CreateMaterialDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsIn(categories)
  category?: MaterialCategory;

  @IsString()
  @IsNotEmpty()
  unit: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultUnitPrice?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateMaterialDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(categories)
  category?: MaterialCategory;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultUnitPrice?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}
