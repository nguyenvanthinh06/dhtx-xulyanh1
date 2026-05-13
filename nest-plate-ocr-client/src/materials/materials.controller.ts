import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateMaterialDto, UpdateMaterialDto } from './material.dto';
import { MaterialsService } from './materials.service';

@Controller('materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Post()
  create(@Body() dto: CreateMaterialDto) {
    return this.materialsService.create(dto);
  }

  @Get()
  findAll(@Query('search') search?: string) {
    return this.materialsService.findAll(search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.materialsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMaterialDto) {
    return this.materialsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.materialsService.remove(id);
  }
}
