import {
  BadRequestException,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PlateOcrService } from './plate-ocr.service';

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/bmp',
  'image/webp',
]);

@Controller('plates')
export class PlateOcrController {
  constructor(private readonly plateOcrService: PlateOcrService) {}

  @Get('health')
  health() {
    return this.plateOcrService.health();
  }

  @Post('detect')
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
  detect(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Missing multipart file field 'image'.");
    }

    return this.plateOcrService.detectFromUpload(file);
  }
}
