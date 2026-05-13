import { Module } from '@nestjs/common';
import { PlateOcrController } from './plate-ocr.controller';
import { PlateOcrService } from './plate-ocr.service';

@Module({
  controllers: [PlateOcrController],
  providers: [PlateOcrService],
  exports: [PlateOcrService],
})
export class PlateOcrModule {}
