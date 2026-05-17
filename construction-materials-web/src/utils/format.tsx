import { Tag } from 'antd';
import dayjs from 'dayjs';
import type { PlateOcrResponse } from '../types';

export const materialCategoryLabels: Record<string, string> = {
  aggregate: 'Cát, đá, sỏi',
  steel: 'Thép',
  concrete: 'Bê tông',
  plumbing: 'Ống nước',
  electrical: 'Điện',
  finishing: 'Hoàn thiện',
  other: 'Khác',
};

export const planStatusLabels: Record<string, { label: string; color: string }> = {
  planned: { label: 'Đã lập', color: 'blue' },
  partial: { label: 'Đang nhập', color: 'gold' },
  completed: { label: 'Hoàn tất', color: 'green' },
  cancelled: { label: 'Hủy', color: 'red' },
};

export const tripStatusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'Chờ xác nhận', color: 'gold' },
  verified: { label: 'Đã xác nhận', color: 'green' },
  rejected: { label: 'Loại', color: 'red' },
};

export const projectStatusLabels: Record<string, { label: string; color: string }> = {
  active: { label: 'Đang thi công', color: 'green' },
  paused: { label: 'Tạm dừng', color: 'gold' },
  completed: { label: 'Hoàn thành', color: 'blue' },
};

export function money(value?: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function number(value?: number) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(Number(value || 0));
}

export function statusTag(status: string, map: Record<string, { label: string; color: string }>) {
  const item = map[status] || { label: status, color: 'default' };
  return <Tag color={item.color}>{item.label}</Tag>;
}

export function dateText(value?: string) {
  return value ? dayjs(value).format('DD/MM/YYYY') : '';
}

export function dateTimeText(value?: string) {
  return value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '';
}

export function detectedPlateText(ocr?: PlateOcrResponse) {
  return ocr?.text || ocr?.plates?.find((item) => item.text?.trim())?.text || '';
}

export function ocrFields(ocr?: PlateOcrResponse) {
  const firstPlate = ocr?.plates?.[0];
  const detectedPlate = detectedPlateText(ocr);

  if (!ocr) {
    return {};
  }

  return {
    detectedPlate,
    plateConfidence: firstPlate?.score,
    ocrSource: firstPlate?.ocr_source,
    ocrImagePath: ocr.image_path,
    ocrOutputPath: ocr.output_path,
    ocrPayload: ocr,
  };
}

export function errorText(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }
  return 'Không detect được biển số từ ảnh vừa chọn.';
}
