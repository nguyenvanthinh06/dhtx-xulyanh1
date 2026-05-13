import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  CreateImportPlanDto,
  ImportPlanQueryDto,
  UpdateImportPlanDto,
} from './import-plan.dto';
import { ImportPlansService } from './import-plans.service';

@Controller('import-plans')
export class ImportPlansController {
  constructor(private readonly importPlansService: ImportPlansService) {}

  @Post()
  create(@Body() dto: CreateImportPlanDto) {
    return this.importPlansService.create(dto);
  }

  @Get()
  findAll(@Query() query: ImportPlanQueryDto) {
    return this.importPlansService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.importPlansService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateImportPlanDto) {
    return this.importPlansService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.importPlansService.remove(id);
  }
}
