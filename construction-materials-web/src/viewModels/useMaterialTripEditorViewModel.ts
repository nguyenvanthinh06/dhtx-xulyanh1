import { App as AntApp, Form } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { MaterialTrip, PlateDetectOptions, PlateOcrResponse } from '../types';
import { detectedPlateText, errorText, ocrFields } from '../utils/format';

type UseMaterialTripEditorParams = {
  refresh: () => Promise<void>;
};

type AutoPlateDetectAttempt = {
  label: string;
  options: PlateDetectOptions;
};

const autoPlateDetectAttempts: AutoPlateDetectAttempt[] = [
  {
    label: 'YOLO v2 + YOLO OCR',
    options: {
      detectEngine: 'yolo',
      ocrEngine: 'yolo',
      fallback: 'roboflow',
      finalFallback: 'gemini',
      fallbackDetect: 'none',
      plateModel: 'plate-v2',
      fallbackPlateModel: 'plate-v1',
      plateConf: '0.25',
      fallbackPlateConf: '0.25',
      charModel: 'char-default',
      charConf: '0.25',
      plateCropScale: 'auto',
      minPlateWidth: '300',
    },
  },
  {
    label: 'YOLO v2 low confidence',
    options: {
      detectEngine: 'yolo',
      ocrEngine: 'yolo',
      fallback: 'roboflow',
      finalFallback: 'gemini',
      fallbackDetect: 'yolo',
      plateModel: 'plate-v2',
      fallbackPlateModel: 'plate-v1',
      plateConf: '0.25,0.18,0.12',
      fallbackPlateConf: '0.2,0.15,0.1',
      charModel: 'char-default',
      charConf: '0.2',
      plateCropScale: '3',
      minPlateWidth: '420',
    },
  },
  {
    label: 'YOLO legacy plate model',
    options: {
      detectEngine: 'yolo',
      ocrEngine: 'yolo',
      fallback: 'roboflow',
      finalFallback: 'gemini',
      fallbackDetect: 'none',
      plateModel: 'plate-v1',
      fallbackPlateModel: 'plate-v1',
      plateConf: '0.25,0.18,0.12',
      fallbackPlateConf: '0.2,0.15,0.1',
      charModel: 'char-default',
      charConf: '0.2',
      plateCropScale: '3',
      minPlateWidth: '420',
    },
  },
  {
    label: 'Roboflow detect + Roboflow OCR',
    options: {
      detectEngine: 'roboflow',
      ocrEngine: 'roboflow',
      fallback: 'gemini',
      finalFallback: 'gemini',
      fallbackDetect: 'yolo',
      plateModel: 'plate-v2',
      fallbackPlateModel: 'plate-v1',
      plateConf: '0.25,0.15',
      fallbackPlateConf: '0.2,0.12',
      charModel: 'char-default',
      charConf: '0.2',
      plateCropScale: 'auto',
      minPlateWidth: '300',
    },
  },
  {
    label: 'Roboflow detect + Cloud OCR 2',
    options: {
      detectEngine: 'roboflow',
      ocrEngine: 'gemini',
      fallback: 'roboflow',
      finalFallback: 'gemini',
      fallbackDetect: 'yolo',
      plateModel: 'plate-v2',
      fallbackPlateModel: 'plate-v1',
      plateConf: '0.25,0.15',
      fallbackPlateConf: '0.2,0.12',
      charModel: 'char-default',
      charConf: '0.2',
      plateCropScale: 'auto',
      minPlateWidth: '300',
    },
  },
];

function firstPlateScore(result?: PlateOcrResponse) {
  return result?.plates?.[0]?.score ?? -1;
}

function betterDetectFallback(current: PlateOcrResponse | undefined, candidate: PlateOcrResponse) {
  if (!current || firstPlateScore(candidate) > firstPlateScore(current)) {
    return candidate;
  }
  return current;
}

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
  const [plateOcrAttemptLabel, setPlateOcrAttemptLabel] = useState<string>();

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
    setPlateOcrAttemptLabel(undefined);
    setPlateDetecting(false);
  };

  const detectPlateWithAutoSwitch = async (image: File) => {
    let bestResult: PlateOcrResponse | undefined;
    let bestLabel: string | undefined;
    let lastError: unknown;

    for (const attempt of autoPlateDetectAttempts) {
      setPlateOcrAttemptLabel(attempt.label);

      try {
        const result = await api.detectPlate(image, attempt.options);
        const selectedResult = betterDetectFallback(bestResult, result);
        if (selectedResult === result) {
          bestLabel = attempt.label;
        }
        bestResult = selectedResult;

        if (detectedPlateText(result)) {
          return { result, attemptLabel: attempt.label };
        }
      } catch (error) {
        lastError = error;
      }
    }

    if (bestResult) {
      return { result: bestResult, attemptLabel: bestLabel };
    }

    throw lastError || new Error('Plate OCR auto detection failed.');
  };

  const detectUploadedPlate = async (file: File) => {
    setPlateImage(file);
    setPlatePreviewUrl(URL.createObjectURL(file));
    setPlateOcr(undefined);
    setPlateOcrError(undefined);
    setPlateOcrAttemptLabel(undefined);
    setPlateDetecting(true);

    try {
      const { result, attemptLabel } = await detectPlateWithAutoSwitch(file);
      const plateText = detectedPlateText(result);
      setPlateOcr(result);
      setPlateOcrAttemptLabel(attemptLabel);

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
    plateOcrAttemptLabel,
    setOpen,
    openCreate,
    openEdit,
    submit,
    resetPlateDetection,
    detectUploadedPlate,
  };
}
