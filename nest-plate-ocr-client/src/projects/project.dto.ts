import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ProjectStatus } from './project.entity';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @IsIn(['active', 'paused', 'completed'])
  status?: ProjectStatus;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budget?: number;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @IsIn(['active', 'paused', 'completed'])
  status?: ProjectStatus;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budget?: number;
}
