import { Module } from '@nestjs/common';
import { PlateOcrController } from './plate-ocr/plate-ocr.controller';
import { PlateOcrService } from './plate-ocr/plate-ocr.service';

@Module({
  controllers: [PlateOcrController],
  providers: [PlateOcrService],
})
export class AppModule {}
