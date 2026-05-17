import {
  Alert,
  App as AntApp,
  Button,
  Col,
  Form,
  Image,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Typography,
  Upload,
} from 'antd';
import { CameraOutlined, ClearOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { PlateDetectOptions, PlateOcrResponse } from '../types';
import { detectedPlateText, errorText } from '../utils/format';

const { Text, Title } = Typography;

type PresetKey = 'standard' | 'missed' | 'wrongText' | 'cloud';
type PlateDetectFormValues = PlateDetectOptions & { preset: PresetKey };
type PlateRow = PlateOcrResponse['plates'][number] & { index: number };

const presetValues: Record<PresetKey, PlateDetectOptions> = {
  standard: {
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
    includeImage: true,
    includeLogs: false,
  },
  missed: {
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
    includeImage: true,
    includeLogs: true,
  },
  wrongText: {
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
    charConf: '0.15',
    plateCropScale: '3',
    minPlateWidth: '420',
    includeImage: true,
    includeLogs: true,
  },
  cloud: {
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
    includeImage: true,
    includeLogs: true,
  },
};

const initialValues: PlateDetectFormValues = {
  preset: 'standard',
  ...presetValues.standard,
};

export function PlateDetectPage() {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm<PlateDetectFormValues>();
  const [file, setFile] = useState<File>();
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [detecting, setDetecting] = useState(false);
  const [result, setResult] = useState<PlateOcrResponse>();
  const [detectError, setDetectError] = useState<string>();

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const plateRows = useMemo<PlateRow[]>(
    () => (result?.plates || []).map((plate, index) => ({ ...plate, index: index + 1 })),
    [result],
  );
  const detectedText = detectedPlateText(result);
  const firstPlate = result?.plates?.[0];
  const outputImageUrl = result?.output_image_base64
    ? `data:image/jpeg;base64,${result.output_image_base64}`
    : previewUrl;

  const applyPreset = (preset: PresetKey) => {
    form.setFieldsValue({ preset, ...presetValues[preset] });
  };

  const clearImage = () => {
    setFile(undefined);
    setPreviewUrl(undefined);
    setResult(undefined);
    setDetectError(undefined);
  };

  const detectPlate = async () => {
    if (!file) {
      message.warning('Chọn ảnh xe trước khi detect.');
      return;
    }

    const values = await form.validateFields();
    const { preset: _preset, ...options } = values;
    setDetecting(true);
    setResult(undefined);
    setDetectError(undefined);

    try {
      const response = await api.detectPlate(file, options);
      setResult(response);
      if (detectedPlateText(response)) {
        message.success(`Đã detect biển số: ${detectedPlateText(response)}`);
      } else {
        message.warning('Chưa đọc được biển số từ ảnh vừa chọn.');
      }
    } catch (error) {
      setDetectError(errorText(error));
      message.error('Detect biển số thất bại');
    } finally {
      setDetecting(false);
    }
  };

  return (
    <section className="work-surface plate-detect-page">
      <div className="section-head">
        <div>
          <Title level={3}>Detect biển số</Title>
          <Text type="secondary">Upload ảnh xe, chọn cấu hình OCR và chạy lại khi model đọc sai hoặc bỏ sót biển số.</Text>
        </div>
        <Button icon={<ReloadOutlined />} loading={detecting} disabled={!file} onClick={detectPlate}>
          Detect lại
        </Button>
      </div>

      <div className="plate-detect-layout">
        <div className="plate-upload-panel">
          <Upload.Dragger
            className="plate-upload-dragger"
            maxCount={1}
            showUploadList={false}
            accept="image/*"
            beforeUpload={(selectedFile) => {
              setFile(selectedFile as File);
              setPreviewUrl(URL.createObjectURL(selectedFile as File));
              setResult(undefined);
              setDetectError(undefined);
              return false;
            }}
          >
            <p className="ant-upload-drag-icon"><CameraOutlined /></p>
            <p className="ant-upload-text">Chọn ảnh xe để detect biển số</p>
            <p className="ant-upload-hint">Ảnh JPG, PNG, BMP hoặc WebP.</p>
          </Upload.Dragger>

          <div className="plate-detect-preview">
            {outputImageUrl ? (
              <Image
                src={outputImageUrl}
                alt="Ảnh xe detect biển số"
                width="100%"
                height="100%"
                style={{ objectFit: 'contain' }}
              />
            ) : (
              <div className="plate-preview-empty">
                <CameraOutlined />
                <Text type="secondary">Chưa có ảnh</Text>
              </div>
            )}
          </div>
        </div>

        <div className="plate-option-panel">
          <div className="plate-panel-title">
            <SettingOutlined />
            <Text strong>Tham số detect</Text>
          </div>

          <Form form={form} layout="vertical" initialValues={initialValues}>
            <Row gutter={12}>
              <Col xs={24} md={12}>
                <Form.Item name="preset" label="Kịch bản">
                  <Select
                    onChange={applyPreset}
                    options={[
                      { value: 'standard', label: 'Mặc định' },
                      { value: 'missed', label: 'Không detect được' },
                      { value: 'wrongText', label: 'Detect sai ký tự' },
                      { value: 'cloud', label: 'Ưu tiên Cloud OCR' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="plateModel" label="Model biển số">
                  <Select
                    options={[
                      { value: 'plate-v2', label: 'YOLO plate v2' },
                      { value: 'plate-v1', label: 'YOLO plate legacy' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="detectEngine" label="Engine detect">
                  <Select
                    options={[
                      { value: 'yolo', label: 'YOLO local' },
                      { value: 'roboflow', label: 'Roboflow API' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="ocrEngine" label="Engine OCR">
                  <Select
                    options={[
                      { value: 'yolo', label: 'YOLO ký tự' },
                      { value: 'roboflow', label: 'Roboflow OCR' },
                      { value: 'gemini', label: 'Cloud OCR 2' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="plateConf" label="Tỷ lệ detect">
                  <Select
                    options={[
                      { value: '0.25', label: '25% - cân bằng' },
                      { value: '0.18', label: '18% - nhạy hơn' },
                      { value: '0.12', label: '12% - ảnh khó' },
                      { value: '0.25,0.18,0.12', label: 'Thử 25% → 18% → 12%' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="charConf" label="Tỷ lệ OCR ký tự">
                  <Select
                    options={[
                      { value: '0.25', label: '25% - mặc định' },
                      { value: '0.2', label: '20% - ảnh mờ' },
                      { value: '0.15', label: '15% - giữ ký tự yếu' },
                      { value: '0.1', label: '10% - kiểm tra lỗi' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="plateCropScale" label="Tỷ lệ phóng crop">
                  <Select
                    options={[
                      { value: 'auto', label: 'Auto' },
                      { value: '2', label: '2x' },
                      { value: '3', label: '3x' },
                      { value: 'none', label: 'Không phóng' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="minPlateWidth" label="Độ rộng crop tối thiểu">
                  <Select
                    options={[
                      { value: '300', label: '300 px' },
                      { value: '420', label: '420 px' },
                      { value: '600', label: '600 px' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="fallback" label="Fallback OCR">
                  <Select
                    options={[
                      { value: 'roboflow', label: 'Roboflow' },
                      { value: 'gemini', label: 'Cloud OCR 2' },
                      { value: 'yolo', label: 'YOLO' },
                      { value: 'none', label: 'Tắt' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="finalFallback" label="Fallback cuối">
                  <Select
                    options={[
                      { value: 'gemini', label: 'Cloud OCR 2' },
                      { value: 'roboflow', label: 'Roboflow' },
                      { value: 'yolo', label: 'YOLO' },
                      { value: 'none', label: 'Tắt' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="fallbackDetect" label="Fallback detect">
                  <Select
                    options={[
                      { value: 'none', label: 'Tắt' },
                      { value: 'yolo', label: 'YOLO legacy' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="fallbackPlateConf" label="Tỷ lệ fallback detect">
                  <Select
                    options={[
                      { value: '0.25', label: '25%' },
                      { value: '0.2,0.15,0.1', label: 'Thử 20% → 15% → 10%' },
                      { value: '0.12', label: '12%' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={12}>
                <Form.Item name="includeImage" label="Ảnh kết quả" valuePropName="checked">
                  <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
                </Form.Item>
              </Col>
              <Col xs={12}>
                <Form.Item name="includeLogs" label="Log OCR" valuePropName="checked">
                  <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
                </Form.Item>
              </Col>
            </Row>

            <Space wrap className="plate-detect-actions">
              <Button type="primary" icon={<CameraOutlined />} loading={detecting} onClick={detectPlate}>
                Detect biển số
              </Button>
              <Button icon={<ClearOutlined />} onClick={clearImage}>
                Xóa ảnh
              </Button>
            </Space>
          </Form>
        </div>
      </div>

      <div className="plate-result-panel">
        {detecting ? (
          <Alert type="info" showIcon message="Đang detect biển số" description="Backend đang chạy pipeline OCR với tham số đã chọn." />
        ) : null}

        {detectError ? (
          <Alert type="error" showIcon message="Detect thất bại" description={detectError} />
        ) : null}

        {result ? (
          <>
            <div className="plate-result-summary">
              <div>
                <Text type="secondary">Biển số</Text>
                <Title level={2}>{detectedText || 'Không đọc được'}</Title>
              </div>
              <div>
                <Text type="secondary">Confidence</Text>
                <Text strong>{firstPlate?.score !== undefined ? `${Math.round(firstPlate.score * 100)}%` : '-'}</Text>
              </div>
              <div>
                <Text type="secondary">Nguồn detect</Text>
                <Text strong>{firstPlate?.source || '-'}</Text>
              </div>
              <div>
                <Text type="secondary">Nguồn OCR</Text>
                <Text strong>{firstPlate?.ocr_source || '-'}</Text>
              </div>
            </div>

            <Table
              rowKey={(row) => `${row.index}-${row.box.join('-')}`}
              size="small"
              pagination={false}
              dataSource={plateRows}
              scroll={{ x: 900 }}
              columns={[
                { title: '#', dataIndex: 'index', width: 54 },
                { title: 'Biển số', dataIndex: 'text', width: 140, render: (text: string) => text || '-' },
                {
                  title: 'Confidence',
                  dataIndex: 'score',
                  width: 116,
                  render: (score: number) => `${Math.round(score * 100)}%`,
                },
                { title: 'Detect', dataIndex: 'source', width: 180 },
                { title: 'OCR', dataIndex: 'ocr_source', width: 180 },
                { title: 'Box', dataIndex: 'box', render: (box: number[]) => box.join(', ') },
                { title: 'Raw OCR', dataIndex: 'raw_text', render: (text?: string) => text || '-' },
              ]}
            />

            {result.logs?.length ? (
              <details className="plate-log-panel">
                <summary>Log OCR ({result.logs.length} dòng)</summary>
                <pre>{result.logs.join('\n')}</pre>
              </details>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
