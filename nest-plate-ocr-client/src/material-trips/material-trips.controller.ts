import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  CreateMaterialTripDto,
  MaterialTripQueryDto,
  UpdateMaterialTripDto,
} from './material-trip.dto';
import { MaterialTripsService } from './material-trips.service';

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/bmp',
  'image/webp',
]);

@Controller('material-trips')
export class MaterialTripsController {
  constructor(private readonly materialTripsService: MaterialTripsService) {}

  @Post()
  create(@Body() dto: CreateMaterialTripDto) {
    return this.materialTripsService.create(dto);
  }

  @Post('with-plate-image')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: {
        fileSize: Number(process.env.MAX_UPLOAD_MB || 15) * 1024 * 1024,
      },
      fileFilter: (_req, file, callback) => {
        if (!IMAGE_MIME_TYPES.has(file.mimetype)) {
          callback(new BadRequestException('Only image files are supported.'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  createWithPlateImage(
    @Body() dto: CreateMaterialTripDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException("Missing multipart file field 'image'.");
    }
    return this.materialTripsService.createWithPlateImage(dto, file);
  }

  @Get()
  findAll(@Query() query: MaterialTripQueryDto) {
    return this.materialTripsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.materialTripsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMaterialTripDto) {
    return this.materialTripsService.update(id, dto);
  }

  @Post(':id/plate-detect')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: {
        fileSize: Number(process.env.MAX_UPLOAD_MB || 15) * 1024 * 1024,
      },
      fileFilter: (_req, file, callback) => {
        if (!IMAGE_MIME_TYPES.has(file.mimetype)) {
          callback(new BadRequestException('Only image files are supported.'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  detectPlateForTrip(@Param('id') id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Missing multipart file field 'image'.");
    }
    return this.materialTripsService.detectPlateForTrip(id, file);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.materialTripsService.remove(id);
  }
}
