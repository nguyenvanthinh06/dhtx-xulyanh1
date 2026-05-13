import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Col,
  ConfigProvider,
  DatePicker,
  Divider,
  Form,
  Image,
  Input,
  InputNumber,
  Layout,
  Menu,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd';
import {
  AppstoreOutlined,
  BarChartOutlined,
  CameraOutlined,
  CarOutlined,
  ClusterOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  PlusOutlined,
  ReloadOutlined,
  ShopOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import {
  ImportPlan,
  Material,
  MaterialTrip,
  Overview,
  PlateOcrResponse,
  Project,
  Supplier,
} from './types';

const { Header, Content, Sider } = Layout;
const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

type SectionKey = 'dashboard' | 'projects' | 'materials' | 'suppliers' | 'plans' | 'trips';
type FieldKind = 'text' | 'number' | 'textarea' | 'select' | 'date' | 'switch';

type FieldConfig = {
  name: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  options?: { label: string; value: string }[];
  min?: number;
};

const materialCategoryLabels: Record<string, string> = {
  aggregate: 'Cát, đá, sỏi',
  steel: 'Thép',
  concrete: 'Bê tông',
  plumbing: 'Ống nước',
  electrical: 'Điện',
  finishing: 'Hoàn thiện',
  other: 'Khác',
};

const planStatusLabels: Record<string, { label: string; color: string }> = {
  planned: { label: 'Đã lập', color: 'blue' },
  partial: { label: 'Đang nhập', color: 'gold' },
  completed: { label: 'Hoàn tất', color: 'green' },
  cancelled: { label: 'Hủy', color: 'red' },
};

const tripStatusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'Chờ xác nhận', color: 'gold' },
  verified: { label: 'Đã xác nhận', color: 'green' },
  rejected: { label: 'Loại', color: 'red' },
};

const projectStatusLabels: Record<string, { label: string; color: string }> = {
  active: { label: 'Đang thi công', color: 'green' },
  paused: { label: 'Tạm dừng', color: 'gold' },
  completed: { label: 'Hoàn thành', color: 'blue' },
};

function money(value?: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function number(value?: number) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function statusTag(status: string, map: Record<string, { label: string; color: string }>) {
  const item = map[status] || { label: status, color: 'default' };
  return <Tag color={item.color}>{item.label}</Tag>;
}

function dateText(value?: string) {
  return value ? dayjs(value).format('DD/MM/YYYY') : '';
}

function dateTimeText(value?: string) {
  return value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '';
}

function detectedPlateText(ocr?: PlateOcrResponse) {
  return ocr?.text || ocr?.plates?.find((item) => item.text?.trim())?.text || '';
}

function ocrFields(ocr?: PlateOcrResponse) {
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

function errorText(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }
  return 'Không detect được biển số từ ảnh vừa chọn.';
}

function buildSelectOptions<T extends { id: string; code?: string; name?: string }>(items: T[]) {
  return items.map((item) => ({
    value: item.id,
    label: item.code ? `${item.code} - ${item.name}` : item.name || item.id,
  }));
}

function serializeValues(values: Record<string, unknown>, fields: FieldConfig[]) {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    const value = values[field.name];
    if (value === undefined || value === null || value === '') {
      continue;
    }
    if (field.kind === 'date' && dayjs.isDayjs(value)) {
      payload[field.name] = value.format('YYYY-MM-DD');
    } else {
      payload[field.name] = value;
    }
  }
  return payload;
}

function initialValues(record: Record<string, unknown>, fields: FieldConfig[]) {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    const value = record[field.name];
    values[field.name] = field.kind === 'date' && value ? dayjs(String(value)) : value;
  }
  return values;
}

function FieldRenderer({ field }: { field: FieldConfig }) {
  const rules = field.required ? [{ required: true, message: `Nhập ${field.label}` }] : undefined;

  if (field.kind === 'textarea') {
    return (
      <Form.Item name={field.name} label={field.label} rules={rules}>
        <Input.TextArea rows={3} />
      </Form.Item>
    );
  }

  if (field.kind === 'number') {
    return (
      <Form.Item name={field.name} label={field.label} rules={rules}>
        <InputNumber min={field.min ?? 0} className="full-input" />
      </Form.Item>
    );
  }

  if (field.kind === 'select') {
    return (
      <Form.Item name={field.name} label={field.label} rules={rules}>
        <Select showSearch allowClear optionFilterProp="label" options={field.options || []} />
      </Form.Item>
    );
  }

  if (field.kind === 'date') {
    return (
      <Form.Item name={field.name} label={field.label} rules={rules}>
        <DatePicker className="full-input" format="DD/MM/YYYY" />
      </Form.Item>
    );
  }

  if (field.kind === 'switch') {
    return (
      <Form.Item name={field.name} label={field.label} valuePropName="checked">
        <Switch />
      </Form.Item>
    );
  }

  return (
    <Form.Item name={field.name} label={field.label} rules={rules}>
      <Input />
    </Form.Item>
  );
}

type CrudPanelProps<T extends { id: string }> = {
  title: string;
  subtitle: string;
  data: T[];
  columns: any[];
  fields: FieldConfig[];
  loading: boolean;
  createItem: (payload: Record<string, unknown>) => Promise<unknown>;
  updateItem: (id: string, payload: Record<string, unknown>) => Promise<unknown>;
  deleteItem: (id: string) => Promise<unknown>;
  refresh: () => Promise<void>;
};

function CrudPanel<T extends { id: string }>(props: CrudPanelProps<T>) {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  };

  const openEdit = (record: T) => {
    setEditing(record);
    form.setFieldsValue(initialValues(record as Record<string, unknown>, props.fields));
    setOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    const payload = serializeValues(values, props.fields);
    setSaving(true);
    try {
      if (editing) {
        await props.updateItem(editing.id, payload);
      } else {
        await props.createItem(payload);
      }
      message.success('Đã lưu dữ liệu');
      setOpen(false);
      await props.refresh();
    } finally {
      setSaving(false);
    }
  };

  const actionColumn = {
    title: '',
    width: 116,
    fixed: 'right' as const,
    render: (_: unknown, record: T) => (
      <Space>
        <Button icon={<EditOutlined />} onClick={() => openEdit(record)} />
        <Popconfirm title="Xóa bản ghi này?" onConfirm={async () => {
          await props.deleteItem(record.id);
          message.success('Đã xóa');
          await props.refresh();
        }}>
          <Button danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ),
  };

  return (
    <section className="work-surface">
      <div className="section-head">
        <div>
          <Title level={3}>{props.title}</Title>
          <Text type="secondary">{props.subtitle}</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={props.refresh} />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm mới
          </Button>
        </Space>
      </div>

      <Table
        rowKey="id"
        loading={props.loading}
        columns={[...props.columns, actionColumn]}
        dataSource={props.data}
        size="middle"
        scroll={{ x: 1080 }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
      />

      <Modal
        title={editing ? `Cập nhật ${props.title.toLowerCase()}` : `Thêm ${props.title.toLowerCase()}`}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        confirmLoading={saving}
        width={760}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            {props.fields.map((field) => (
              <Col span={field.kind === 'textarea' ? 24 : 12} key={field.name}>
                <FieldRenderer field={field} />
              </Col>
            ))}
          </Row>
        </Form>
      </Modal>
    </section>
  );
}

function Dashboard({
  overview,
  projects,
  loading,
  projectId,
  setProjectId,
  range,
  setRange,
  refresh,
}: {
  overview?: Overview;
  projects: Project[];
  loading: boolean;
  projectId?: string;
  setProjectId: (value?: string) => void;
  range: [Dayjs, Dayjs] | null;
  setRange: (value: [Dayjs, Dayjs] | null) => void;
  refresh: () => Promise<void>;
}) {
  const totals = overview?.totals || { trips: 0, quantity: 0, cost: 0, averageCostPerTrip: 0 };

  return (
    <section className="dashboard">
      <div className="section-head">
        <div>
          <Title level={3}>Tổng quan nhập vật liệu</Title>
          <Text type="secondary">Theo dõi khối lượng, chi phí và luồng xe theo thời gian.</Text>
        </div>
        <Space wrap>
          <Select
            allowClear
            showSearch
            className="filter-select"
            placeholder="Tất cả công trình"
            optionFilterProp="label"
            value={projectId}
            onChange={setProjectId}
            options={buildSelectOptions(projects)}
          />
          <RangePicker
            value={range}
            onChange={(value) => setRange(value as [Dayjs, Dayjs] | null)}
            format="DD/MM/YYYY"
          />
          <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading} />
        </Space>
      </div>

      <Row gutter={[16, 16]} className="metric-row">
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Số chuyến xe" value={totals.trips} prefix={<CarOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Tổng khối lượng" value={number(totals.quantity)} suffix="đơn vị" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Tổng chi phí" value={money(totals.cost)} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <div className="work-surface compact">
            <Title level={4}>Theo vật tư</Title>
            <Table
              rowKey="key"
              size="small"
              pagination={false}
              dataSource={overview?.byMaterial || []}
              columns={[
                { title: 'Vật tư', dataIndex: 'name' },
                { title: 'Khối lượng', render: (_: unknown, row) => `${number(row.quantity)} ${row.unit || ''}` },
                { title: 'Chi phí', render: (_: unknown, row) => money(row.cost) },
                { title: 'Chuyến', dataIndex: 'trips', width: 88 },
              ]}
            />
          </div>
        </Col>
        <Col xs={24} xl={12}>
          <div className="work-surface compact">
            <Title level={4}>Theo nhà cung cấp</Title>
            <Table
              rowKey="key"
              size="small"
              pagination={false}
              dataSource={overview?.bySupplier || []}
              columns={[
                { title: 'Nhà cung cấp', dataIndex: 'name' },
                { title: 'Khối lượng', render: (_: unknown, row) => number(row.quantity) },
                { title: 'Chi phí', render: (_: unknown, row) => money(row.cost) },
                { title: 'Chuyến', dataIndex: 'trips', width: 88 },
              ]}
            />
          </div>
        </Col>
      </Row>

      <div className="work-surface compact">
        <Title level={4}>Chuyến xe gần đây</Title>
        <Table
          rowKey="id"
          size="small"
          dataSource={overview?.recentTrips || []}
          pagination={false}
          scroll={{ x: 960 }}
          columns={[
            { title: 'Thời gian', render: (_: unknown, row: MaterialTrip) => dateTimeText(row.occurredAt) },
            { title: 'Biển số', render: (_: unknown, row: MaterialTrip) => row.licensePlate || row.detectedPlate || '-' },
            { title: 'Vật tư', render: (_: unknown, row: MaterialTrip) => row.material?.name },
            { title: 'Nhà cung cấp', render: (_: unknown, row: MaterialTrip) => row.supplier?.name },
            { title: 'Khối lượng', render: (_: unknown, row: MaterialTrip) => `${number(row.quantity)} ${row.material?.unit || ''}` },
            { title: 'Chi phí', render: (_: unknown, row: MaterialTrip) => money(row.totalPrice) },
            { title: 'Trạng thái', render: (_: unknown, row: MaterialTrip) => statusTag(row.status, tripStatusLabels) },
          ]}
        />
      </div>
    </section>
  );
}

function TripsPanel({
  data,
  projects,
  materials,
  suppliers,
  plans,
  loading,
  refresh,
}: {
  data: MaterialTrip[];
  projects: Project[];
  materials: Material[];
  suppliers: Supplier[];
  plans: ImportPlan[];
  loading: boolean;
  refresh: () => Promise<void>;
}) {
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

  const planOptions = plans.map((plan) => ({
    value: plan.id,
    label: `${plan.project?.code || 'CT'} / ${plan.material?.name || 'Vật tư'} / ${number(plan.plannedQuantity)} ${plan.material?.unit || ''}`,
  }));

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
      } else {
        if (plateImage && !plateOcr) {
          await api.createMaterialTrip(payload, plateImage);
        } else {
          await api.createMaterialTrip({
            ...payload,
            ...(plateOcr ? ocrFields(plateOcr) : {}),
          });
        }
      }
      message.success('Đã lưu chuyến xe');
      setOpen(false);
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="work-surface">
      <div className="section-head">
        <div>
          <Title level={3}>Nhập vật liệu theo chuyến xe</Title>
          <Text type="secondary">Mỗi chuyến gắn với vật tư, nhà cung cấp, khối lượng và biển số OCR.</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={refresh} />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Ghi nhận chuyến
          </Button>
        </Space>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={data}
        size="middle"
        scroll={{ x: 1320 }}
        columns={[
          { title: 'Thời gian', width: 150, render: (_: unknown, row) => dateTimeText(row.occurredAt) },
          { title: 'Phiếu', dataIndex: 'ticketCode', width: 120 },
          {
            title: 'Biển số',
            width: 150,
            render: (_: unknown, row) => (
              <Space direction="vertical" size={0}>
                <Text strong>{row.licensePlate || row.detectedPlate || '-'}</Text>
                {row.detectedPlate && row.detectedPlate !== row.licensePlate ? (
                  <Text type="secondary">OCR: {row.detectedPlate}</Text>
                ) : null}
              </Space>
            ),
          },
          { title: 'Công trình', render: (_: unknown, row) => row.project?.name },
          { title: 'Vật tư', render: (_: unknown, row) => row.material?.name },
          { title: 'Nhà cung cấp', render: (_: unknown, row) => row.supplier?.name },
          { title: 'Khối lượng', render: (_: unknown, row) => `${number(row.quantity)} ${row.material?.unit || ''}` },
          { title: 'Đơn giá', render: (_: unknown, row) => money(row.unitPrice) },
          { title: 'Thành tiền', render: (_: unknown, row) => money(row.totalPrice) },
          { title: 'Trạng thái', render: (_: unknown, row) => statusTag(row.status, tripStatusLabels) },
          {
            title: '',
            width: 116,
            fixed: 'right',
            render: (_: unknown, record) => (
              <Space>
                <Button icon={<EditOutlined />} onClick={() => openEdit(record)} />
                <Popconfirm title="Xóa chuyến xe này?" onConfirm={async () => {
                  await api.deleteMaterialTrip(record.id);
                  message.success('Đã xóa');
                  await refresh();
                }}>
                  <Button danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? 'Cập nhật chuyến xe' : 'Ghi nhận chuyến xe'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        confirmLoading={saving}
        width={960}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="projectId" label="Công trình" rules={[{ required: true }]}>
                <Select showSearch optionFilterProp="label" options={buildSelectOptions(projects)} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="materialId" label="Vật tư" rules={[{ required: true }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={buildSelectOptions(materials)}
                  onChange={(id) => {
                    const material = materials.find((item) => item.id === id);
                    if (material && !form.getFieldValue('unitPrice')) {
                      form.setFieldValue('unitPrice', material.defaultUnitPrice);
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="supplierId" label="Nhà cung cấp" rules={[{ required: true }]}>
                <Select showSearch optionFilterProp="label" options={buildSelectOptions(suppliers)} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="importPlanId" label="Kế hoạch">
                <Select allowClear showSearch optionFilterProp="label" options={planOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="ticketCode" label="Mã phiếu">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="occurredAt" label="Thời gian vào công trường" rules={[{ required: true }]}>
                <DatePicker showTime className="full-input" format="DD/MM/YYYY HH:mm" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="licensePlate" label="Biển số xác nhận">
                <Input placeholder="Tự điền từ OCR nếu để trống" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="driverName" label="Tài xế">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="vehicleType" label="Loại xe">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="quantity" label="Khối lượng" rules={[{ required: true }]}>
                <InputNumber min={0} className="full-input" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="unitPrice" label="Đơn giá">
                <InputNumber min={0} className="full-input" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="status" label="Trạng thái">
                <Select
                  options={[
                    { value: 'pending', label: 'Chờ xác nhận' },
                    { value: 'verified', label: 'Đã xác nhận' },
                    { value: 'rejected', label: 'Loại' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <div className="plate-ocr-row">
                <Upload.Dragger
                  className="plate-upload-dragger"
                  maxCount={1}
                  showUploadList={false}
                  beforeUpload={(file) => {
                    void detectUploadedPlate(file as File);
                    return false;
                  }}
                  onRemove={() => {
                    resetPlateDetection();
                    form.setFieldValue('licensePlate', undefined);
                    return true;
                  }}
                >
                  <p className="ant-upload-drag-icon"><CameraOutlined /></p>
                  <p className="ant-upload-text">Chọn ảnh OCR biển số</p>
                  <p className="ant-upload-hint">Chọn ảnh xong hệ thống sẽ detect ngay.</p>
                </Upload.Dragger>
                {(platePreviewUrl || plateDetecting || plateOcr || plateOcrError) ? (
                  <div className="plate-preview-panel">
                    <div className="plate-preview-result">
                      {plateDetecting ? (
                        <Alert
                          type="info"
                          showIcon
                          message="Đang detect biển số"
                          description="Backend đang gọi Python OCR API. Kết quả sẽ được tự điền vào ô biển số xác nhận."
                        />
                      ) : null}
                      {plateOcr ? (
                        <Alert
                          type={detectedPlateText(plateOcr) ? 'success' : 'warning'}
                          showIcon
                          message={
                            detectedPlateText(plateOcr)
                              ? `Biển số detect được: ${detectedPlateText(plateOcr)}`
                              : 'OCR chưa đọc được biển số'
                          }
                          description={
                            <Space direction="vertical" size={2}>
                              <Text>
                                Confidence:{' '}
                                {plateOcr.plates?.[0]?.score !== undefined
                                  ? `${Math.round(plateOcr.plates[0].score * 100)}%`
                                  : 'không có'}
                              </Text>
                              <Text>Nguồn OCR: {plateOcr.plates?.[0]?.ocr_source || 'không có'}</Text>
                              <Text type="secondary">Nếu biển số sai, sửa trực tiếp ở ô "Biển số xác nhận".</Text>
                            </Space>
                          }
                        />
                      ) : null}
                      {plateOcrError ? (
                        <Alert type="error" showIcon message="Detect thất bại" description={plateOcrError} />
                      ) : null}
                    </div>
                    {platePreviewUrl ? (
                      <div className="plate-preview-frame">
                        <Image
                          src={platePreviewUrl}
                          alt="Ảnh xe dùng để OCR biển số"
                          width="100%"
                          height={124}
                          style={{ objectFit: 'cover' }}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </Col>
            <Col span={24}>
              <Form.Item name="note" label="Ghi chú">
                <Input.TextArea rows={3} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </section>
  );
}

function AppShell() {
  const { message } = AntApp.useApp();
  const [section, setSection] = useState<SectionKey>('dashboard');
  const [loading, setLoading] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<'checking' | 'ok' | 'down'>('checking');
  const [projects, setProjects] = useState<Project[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [plans, setPlans] = useState<ImportPlan[]>([]);
  const [trips, setTrips] = useState<MaterialTrip[]>([]);
  const [overview, setOverview] = useState<Overview>();
  const [reportProjectId, setReportProjectId] = useState<string | undefined>();
  const [reportRange, setReportRange] = useState<[Dayjs, Dayjs] | null>([
    dayjs().startOf('month'),
    dayjs().endOf('day'),
  ]);

  const loadCoreData = async () => {
    setLoading(true);
    try {
      const [projectRows, materialRows, supplierRows, planRows, tripRows] = await Promise.all([
        api.listProjects(),
        api.listMaterials(),
        api.listSuppliers(),
        api.listImportPlans(),
        api.listMaterialTrips(),
      ]);
      setProjects(projectRows);
      setMaterials(materialRows);
      setSuppliers(supplierRows);
      setPlans(planRows);
      setTrips(tripRows);
    } catch (error) {
      message.error('Không tải được dữ liệu từ backend');
    } finally {
      setLoading(false);
    }
  };

  const loadOverview = async () => {
    const query = {
      projectId: reportProjectId,
      from: reportRange?.[0]?.startOf('day').toISOString(),
      to: reportRange?.[1]?.endOf('day').toISOString(),
    };
    const data = await api.overview(query);
    setOverview(data);
  };

  const refreshAll = async () => {
    await loadCoreData();
    await loadOverview();
  };

  useEffect(() => {
    loadCoreData();
    api.health()
      .then(() => setOcrStatus('ok'))
      .catch(() => setOcrStatus('down'));
  }, []);

  useEffect(() => {
    loadOverview().catch(() => undefined);
  }, [reportProjectId, reportRange]);

  const projectFields: FieldConfig[] = [
    { name: 'code', label: 'Mã công trình', kind: 'text', required: true },
    { name: 'name', label: 'Tên công trình', kind: 'text', required: true },
    { name: 'location', label: 'Địa điểm', kind: 'text' },
    { name: 'clientName', label: 'Chủ đầu tư', kind: 'text' },
    {
      name: 'status',
      label: 'Trạng thái',
      kind: 'select',
      options: [
        { value: 'active', label: 'Đang thi công' },
        { value: 'paused', label: 'Tạm dừng' },
        { value: 'completed', label: 'Hoàn thành' },
      ],
    },
    { name: 'budget', label: 'Ngân sách', kind: 'number' },
    { name: 'startDate', label: 'Ngày bắt đầu', kind: 'date' },
    { name: 'endDate', label: 'Ngày kết thúc', kind: 'date' },
  ];

  const materialFields: FieldConfig[] = [
    { name: 'code', label: 'Mã vật tư', kind: 'text', required: true },
    { name: 'name', label: 'Tên vật tư', kind: 'text', required: true },
    {
      name: 'category',
      label: 'Nhóm',
      kind: 'select',
      options: Object.entries(materialCategoryLabels).map(([value, label]) => ({ value, label })),
    },
    { name: 'unit', label: 'Đơn vị', kind: 'text', required: true },
    { name: 'defaultUnitPrice', label: 'Đơn giá mặc định', kind: 'number' },
    { name: 'active', label: 'Đang sử dụng', kind: 'switch' },
    { name: 'description', label: 'Mô tả', kind: 'textarea' },
  ];

  const supplierFields: FieldConfig[] = [
    { name: 'code', label: 'Mã NCC', kind: 'text', required: true },
    { name: 'name', label: 'Tên nhà cung cấp', kind: 'text', required: true },
    { name: 'taxCode', label: 'Mã số thuế', kind: 'text' },
    { name: 'contactPerson', label: 'Người liên hệ', kind: 'text' },
    { name: 'phone', label: 'Số điện thoại', kind: 'text' },
    { name: 'email', label: 'Email', kind: 'text' },
    { name: 'address', label: 'Địa chỉ', kind: 'text' },
    { name: 'active', label: 'Đang hợp tác', kind: 'switch' },
    { name: 'note', label: 'Ghi chú', kind: 'textarea' },
  ];

  const planFields: FieldConfig[] = [
    { name: 'projectId', label: 'Công trình', kind: 'select', required: true, options: buildSelectOptions(projects) },
    { name: 'materialId', label: 'Vật tư', kind: 'select', required: true, options: buildSelectOptions(materials) },
    { name: 'supplierId', label: 'Nhà cung cấp', kind: 'select', options: buildSelectOptions(suppliers) },
    { name: 'plannedQuantity', label: 'Khối lượng dự kiến', kind: 'number', required: true },
    { name: 'unitPrice', label: 'Đơn giá dự kiến', kind: 'number' },
    { name: 'plannedDate', label: 'Ngày dự kiến', kind: 'date' },
    {
      name: 'status',
      label: 'Trạng thái',
      kind: 'select',
      options: [
        { value: 'planned', label: 'Đã lập' },
        { value: 'partial', label: 'Đang nhập' },
        { value: 'completed', label: 'Hoàn tất' },
        { value: 'cancelled', label: 'Hủy' },
      ],
    },
    { name: 'note', label: 'Ghi chú', kind: 'textarea' },
  ];

  const content = useMemo(() => {
    if (section === 'dashboard') {
      return (
        <Dashboard
          overview={overview}
          projects={projects}
          loading={loading}
          projectId={reportProjectId}
          setProjectId={setReportProjectId}
          range={reportRange}
          setRange={setReportRange}
          refresh={refreshAll}
        />
      );
    }

    if (section === 'projects') {
      return (
        <CrudPanel
          title="Công trình"
          subtitle="Hồ sơ công trình dùng để tách báo cáo vật liệu theo từng dự án."
          data={projects}
          loading={loading}
          fields={projectFields}
          createItem={api.createProject}
          updateItem={api.updateProject}
          deleteItem={api.deleteProject}
          refresh={refreshAll}
          columns={[
            { title: 'Mã', dataIndex: 'code', width: 130 },
            { title: 'Tên công trình', dataIndex: 'name' },
            { title: 'Địa điểm', dataIndex: 'location' },
            { title: 'Chủ đầu tư', dataIndex: 'clientName' },
            { title: 'Trạng thái', render: (_: unknown, row: Project) => statusTag(row.status, projectStatusLabels) },
            { title: 'Ngân sách', render: (_: unknown, row: Project) => money(row.budget) },
          ]}
        />
      );
    }

    if (section === 'materials') {
      return (
        <CrudPanel
          title="Vật tư"
          subtitle="Danh mục vật liệu, đơn vị đo và đơn giá mặc định để nhập theo chuyến."
          data={materials}
          loading={loading}
          fields={materialFields}
          createItem={api.createMaterial}
          updateItem={api.updateMaterial}
          deleteItem={api.deleteMaterial}
          refresh={refreshAll}
          columns={[
            { title: 'Mã', dataIndex: 'code', width: 120 },
            { title: 'Tên vật tư', dataIndex: 'name' },
            { title: 'Nhóm', render: (_: unknown, row: Material) => materialCategoryLabels[row.category] },
            { title: 'Đơn vị', dataIndex: 'unit', width: 90 },
            { title: 'Đơn giá', render: (_: unknown, row: Material) => money(row.defaultUnitPrice) },
            { title: 'Trạng thái', render: (_: unknown, row: Material) => row.active ? <Tag color="green">Đang dùng</Tag> : <Tag>Ngưng</Tag> },
          ]}
        />
      );
    }

    if (section === 'suppliers') {
      return (
        <CrudPanel
          title="Nhà cung cấp"
          subtitle="Thông tin đối tác cung ứng vật liệu và đầu mối liên hệ."
          data={suppliers}
          loading={loading}
          fields={supplierFields}
          createItem={api.createSupplier}
          updateItem={api.updateSupplier}
          deleteItem={api.deleteSupplier}
          refresh={refreshAll}
          columns={[
            { title: 'Mã', dataIndex: 'code', width: 120 },
            { title: 'Tên nhà cung cấp', dataIndex: 'name' },
            { title: 'MST', dataIndex: 'taxCode' },
            { title: 'Liên hệ', dataIndex: 'contactPerson' },
            { title: 'Điện thoại', dataIndex: 'phone' },
            { title: 'Trạng thái', render: (_: unknown, row: Supplier) => row.active ? <Tag color="green">Đang hợp tác</Tag> : <Tag>Ngưng</Tag> },
          ]}
        />
      );
    }

    if (section === 'plans') {
      return (
        <CrudPanel
          title="Kế hoạch nhập"
          subtitle="Kế hoạch vật liệu theo công trình, nhà cung cấp, thời gian và giá dự kiến."
          data={plans}
          loading={loading}
          fields={planFields}
          createItem={api.createImportPlan}
          updateItem={api.updateImportPlan}
          deleteItem={api.deleteImportPlan}
          refresh={refreshAll}
          columns={[
            { title: 'Công trình', render: (_: unknown, row: ImportPlan) => row.project?.name },
            { title: 'Vật tư', render: (_: unknown, row: ImportPlan) => row.material?.name },
            { title: 'Nhà cung cấp', render: (_: unknown, row: ImportPlan) => row.supplier?.name || '-' },
            { title: 'Ngày', render: (_: unknown, row: ImportPlan) => dateText(row.plannedDate) },
            { title: 'Khối lượng', render: (_: unknown, row: ImportPlan) => `${number(row.plannedQuantity)} ${row.material?.unit || ''}` },
            { title: 'Đơn giá', render: (_: unknown, row: ImportPlan) => money(row.unitPrice) },
            { title: 'Trạng thái', render: (_: unknown, row: ImportPlan) => statusTag(row.status, planStatusLabels) },
          ]}
        />
      );
    }

    return (
      <TripsPanel
        data={trips}
        projects={projects}
        materials={materials}
        suppliers={suppliers}
        plans={plans}
        loading={loading}
        refresh={refreshAll}
      />
    );
  }, [section, overview, projects, materials, suppliers, plans, trips, loading, reportProjectId, reportRange]);

  return (
    <Layout className="app-shell">
      <Sider width={264} className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">VL</div>
          <div>
            <Text className="brand-title">Vật liệu công trường</Text>
            <Text className="brand-subtitle">Quản lý xe vào ra</Text>
          </div>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[section]}
          onClick={(item) => setSection(item.key as SectionKey)}
          items={[
            { key: 'dashboard', icon: <BarChartOutlined />, label: 'Tổng quan' },
            { key: 'projects', icon: <ClusterOutlined />, label: 'Công trình' },
            { key: 'materials', icon: <ToolOutlined />, label: 'Vật tư' },
            { key: 'suppliers', icon: <ShopOutlined />, label: 'Nhà cung cấp' },
            { key: 'plans', icon: <FileTextOutlined />, label: 'Kế hoạch nhập' },
            { key: 'trips', icon: <CarOutlined />, label: 'Chuyến xe' },
          ]}
        />
      </Sider>
      <Layout>
        <Header className="topbar">
          <Space split={<Divider type="vertical" />}>
            <Space>
              <AppstoreOutlined />
              <Text strong>Construction Materials Control</Text>
            </Space>
            <Space>
              <Text type="secondary">OCR</Text>
              {ocrStatus === 'ok' ? <Tag color="green">online</Tag> : ocrStatus === 'down' ? <Tag color="red">offline</Tag> : <Tag>checking</Tag>}
            </Space>
          </Space>
        </Header>
        <Content className="content">{content}</Content>
      </Layout>
    </Layout>
  );
}

export default function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#146c5f',
          colorInfo: '#146c5f',
          borderRadius: 6,
          fontFamily: 'Aptos, Segoe UI, sans-serif',
        },
        components: {
          Layout: {
            headerBg: '#f7f5ef',
            siderBg: '#17211f',
          },
          Menu: {
            itemBg: '#17211f',
            itemColor: '#c7d3ce',
            itemHoverBg: '#22312d',
            itemSelectedBg: '#d7a63a',
            itemSelectedColor: '#17211f',
          },
        },
      }}
    >
      <AntApp>
        <AppShell />
      </AntApp>
    </ConfigProvider>
  );
}
