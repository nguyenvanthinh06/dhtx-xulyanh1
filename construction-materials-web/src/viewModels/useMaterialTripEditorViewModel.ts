import { App as AntApp, Form } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { MaterialTrip, PlateOcrResponse } from '../types';
import { detectedPlateText, errorText, ocrFields } from '../utils/format';

type UseMaterialTripEditorParams = {
  refresh: () => Promise<void>;
};

export function useMaterialTripEditorViewModel({ refresh }: UseMaterialTripEditorParams) {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MaterialTrip | null>(null);
  const [saving, setSaving] = useState(false);
  const [plateImage, setPlateImage] = useState<File | undefined>();
  const [platePreviewUrl, setPlatePreviewUrl] = useState<string>();
  const [plateOcr, setPlateOcr] = useState<PlateOcrResponse>();
  const [plateDetecting, setPlateDetecting] = useState(false);
  const [plateOcrError, setPlateOcrError] = useState<string>();

  useEffect(() => {
    return () => {
      if (platePreviewUrl) {
        URL.revokeObjectURL(platePreviewUrl);
      }
    };
  }, [platePreviewUrl]);

  const resetPlateDetection = () => {
    setPlateImage(undefined);
    setPlatePreviewUrl(undefined);
    setPlateOcr(undefined);
    setPlateOcrError(undefined);
    setPlateDetecting(false);
  };

  const detectUploadedPlate = async (file: File) => {
    setPlateImage(file);
    setPlatePreviewUrl(URL.createObjectURL(file));
    setPlateOcr(undefined);
    setPlateOcrError(undefined);
    setPlateDetecting(true);

    try {
      const result = await api.detectPlate(file);
      const plateText = detectedPlateText(result);
      setPlateOcr(result);

      if (plateText) {
        form.setFieldValue('licensePlate', plateText);
        message.success(`Đã detect biển số: ${plateText}`);
      } else {
        message.warning('OCR chưa đọc được biển số. Bạn có thể nhập thủ công.');
      }
    } catch (error) {
      setPlateOcrError(errorText(error));
      message.error('Detect biển số thất bại');
    } finally {
      setPlateDetecting(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    resetPlateDetection();
    form.resetFields();
    form.setFieldsValue({ occurredAt: dayjs(), status: 'pending' });
    setOpen(true);
  };

  const openEdit = (record: MaterialTrip) => {
    setEditing(record);
    resetPlateDetection();
    form.setFieldsValue({
      ...record,
      occurredAt: record.occurredAt ? dayjs(record.occurredAt) : undefined,
    });
    setOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    const payload = {
      ...values,
      occurredAt: values.occurredAt ? values.occurredAt.toISOString() : undefined,
    };

    setSaving(true);
    try {
      if (editing) {
        await api.updateMaterialTrip(editing.id, {
          ...payload,
          ...(plateOcr ? ocrFields(plateOcr) : {}),
        });
        if (plateImage && !plateOcr) {
          await api.detectTripPlate(editing.id, plateImage);
        }
      } else if (plateImage && !plateOcr) {
        await api.createMaterialTrip(payload, plateImage);
      } else {
        await api.createMaterialTrip({
          ...payload,
          ...(plateOcr ? ocrFields(plateOcr) : {}),
        });
      }
      message.success('Đã lưu chuyến xe');
      setOpen(false);
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  return {
    form,
    open,
    editing,
    saving,
    platePreviewUrl,
    plateOcr,
    plateDetecting,
    plateOcrError,
    setOpen,
    openCreate,
    openEdit,
    submit,
    resetPlateDetection,
    detectUploadedPlate,
  };
}
