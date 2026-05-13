import {
  BadGatewayException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import FormData = require('form-data');
import { PythonPlateOcrResponse } from './plate-ocr.types';

@Injectable()
export class PlateOcrService {
  private readonly apiUrl = (process.env.PLATE_OCR_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
  private readonly timeoutMs = Number(process.env.PLATE_OCR_TIMEOUT_MS || 120_000);

  async health() {
    try {
      const response = await axios.get(`${this.apiUrl}/health`, {
        timeout: Math.min(this.timeoutMs, 10_000),
      });
      return response.data;
    } catch (error) {
      throw new ServiceUnavailableException({
        message: 'Python OCR API is not reachable.',
        detail: this.errorMessage(error),
      });
    }
  }

  async detectFromUpload(file: Express.Multer.File): Promise<PythonPlateOcrResponse> {
    const form = new FormData();
    form.append('image', file.buffer, {
      filename: file.originalname || 'upload.jpg',
      contentType: file.mimetype || 'application/octet-stream',
      knownLength: file.size,
    });

    try {
      const response = await axios.post<PythonPlateOcrResponse>(`${this.apiUrl}/detect`, form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: this.timeoutMs,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new HttpException(error.response.data, error.response.status);
      }

      throw new BadGatewayException({
        message: 'Python OCR API request failed.',
        detail: this.errorMessage(error),
      });
    }
  }

  private errorMessage(error: unknown): string {
    const axiosError = error as AxiosError;
    return axiosError.message || String(error);
  }
}
