import {
  Alert,
  App as AntApp,
  Button,
  Col,
  DatePicker,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Typography,
  Upload,
} from 'antd';
import { CameraOutlined, ClearOutlined, DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { api } from '../api';
import { FilterStrip } from '../components/FilterStrip';
import type { DateRange } from '../utils/filters';
import {
  dateTimeText,
  detectedPlateText,
  money,
  number,
  statusTag,
  tripStatusLabels,
} from '../utils/format';
import { buildSelectOptions } from '../utils/options';
import type { ImportPlan, Material, MaterialTrip, Project, Supplier } from '../types';
import { useMaterialTripEditorViewModel } from '../viewModels/useMaterialTripEditorViewModel';
import { useMaterialTripsPageViewModel } from '../viewModels/useMaterialTripsPageViewModel';

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

type MaterialTripsPageProps = {
  trips: MaterialTrip[];
  projects: Project[];
  materials: Material[];
  suppliers: Supplier[];
  plans: ImportPlan[];
  loading: boolean;
  refresh: () => Promise<void>;
};

export function MaterialTripsPage({
  trips,
  projects,
  materials,
  suppliers,
  plans,
  loading,
  refresh,
}: MaterialTripsPageProps) {
  const { message } = AntApp.useApp();
  const vm = useMaterialTripsPageViewModel(trips);
  const editor = useMaterialTripEditorViewModel({ refresh });
  const projectOptions = buildSelectOptions(projects);
  const materialOptions = buildSelectOptions(materials);
  const supplierOptions = buildSelectOptions(suppliers);

  const planOptions = plans.map((plan) => ({
    value: plan.id,
    label: `${plan.project?.code || 'CT'} / ${plan.material?.name || 'Vật tư'} / ${number(plan.plannedQuantity)} ${plan.material?.unit || ''}`,
  }));

  const filters = (
    <>
      <Input
        allowClear
        className="filter-input"
        placeholder="Tìm phiếu, biển số, tài xế"
        value={vm.filters.search}
        onChange={(event) => vm.setFilters((current) => ({ ...current, search: event.target.value }))}
      />
      <Select
        allowClear
        showSearch
        className="filter-select"
        placeholder="Công trình"
        optionFilterProp="label"
        value={vm.filters.projectId}
        onChange={(projectId) => vm.setFilters((current) => ({ ...current, projectId }))}
        options={projectOptions}
      />
      <Select
        allowClear
        showSearch
        className="filter-select"
        placeholder="Vật tư"
        optionFilterProp="label"
        value={vm.filters.materialId}
        onChange={(materialId) => vm.setFilters((current) => ({ ...current, materialId }))}
        options={materialOptions}
      />
      <Select
        allowClear
        showSearch
        className="filter-select"
        placeholder="Nhà cung cấp"
        optionFilterProp="label"
        value={vm.filters.supplierId}
        onChange={(supplierId) => vm.setFilters((current) => ({ ...current, supplierId }))}
        options={supplierOptions}
      />
      <Select
        allowClear
        className="filter-select-sm"
        placeholder="Trạng thái"
        value={vm.filters.status}
        onChange={(status) => vm.setFilters((current) => ({ ...current, status }))}
        options={[
          { value: 'pending', label: 'Chờ xác nhận' },
          { value: 'verified', label: 'Đã xác nhận' },
          { value: 'rejected', label: 'Loại' },
        ]}
      />
      <RangePicker
        className="filter-date-range"
        value={vm.filters.range}
        onChange={(range) => vm.setFilters((current) => ({ ...current, range: range as DateRange }))}
        format="DD/MM/YYYY"
      />
      <Button icon={<ClearOutlined />} onClick={vm.resetFilters}>
        Xóa lọc
      </Button>
    </>
  );

  return (
    <section className="work-surface">
      <div className="section-head">
        <div>
          <Title level={3}>Nhập vật liệu theo chuyến xe</Title>
          <Text type="secondary">Mỗi chuyến gắn với vật tư, nhà cung cấp, khối lượng và biển số OCR.</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={refresh} />
          <Button type="primary" icon={<PlusOutlined />} onClick={editor.openCreate}>
            Ghi nhận chuyến
          </Button>
        </Space>
      </div>

      <FilterStrip currentCount={vm.filteredTrips.length} totalCount={trips.length}>
        {filters}
      </FilterStrip>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={vm.filteredTrips}
        size="middle"
        scroll={{ x: 1320 }}
        columns={[
          { title: 'Thời gian', width: 150, render: (_: unknown, row: MaterialTrip) => dateTimeText(row.occurredAt) },
          { title: 'Phiếu', dataIndex: 'ticketCode', width: 120 },
          {
            title: 'Biển số',
            width: 150,
            render: (_: unknown, row: MaterialTrip) => (
              <Space direction="vertical" size={0}>
                <Text strong>{row.licensePlate || row.detectedPlate || '-'}</Text>
                {row.detectedPlate && row.detectedPlate !== row.licensePlate ? (
                  <Text type="secondary">OCR: {row.detectedPlate}</Text>
                ) : null}
              </Space>
            ),
          },
          { title: 'Công trình', render: (_: unknown, row: MaterialTrip) => row.project?.name },
          { title: 'Vật tư', render: (_: unknown, row: MaterialTrip) => row.material?.name },
          { title: 'Nhà cung cấp', render: (_: unknown, row: MaterialTrip) => row.supplier?.name },
          { title: 'Khối lượng', render: (_: unknown, row: MaterialTrip) => `${number(row.quantity)} ${row.material?.unit || ''}` },
          { title: 'Đơn giá', render: (_: unknown, row: MaterialTrip) => money(row.unitPrice) },
          { title: 'Thành tiền', render: (_: unknown, row: MaterialTrip) => money(row.totalPrice) },
          { title: 'Trạng thái', render: (_: unknown, row: MaterialTrip) => statusTag(row.status, tripStatusLabels) },
          {
            title: '',
            width: 116,
            fixed: 'right' as const,
            render: (_: unknown, record: MaterialTrip) => (
              <Space>
                <Button icon={<EditOutlined />} onClick={() => editor.openEdit(record)} />
                <Popconfirm
                  title="Xóa chuyến xe này?"
                  onConfirm={async () => {
                    await api.deleteMaterialTrip(record.id);
                    message.success('Đã xóa');
                    await refresh();
                  }}
                >
                  <Button danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editor.editing ? 'Cập nhật chuyến xe' : 'Ghi nhận chuyến xe'}
        open={editor.open}
        onCancel={() => editor.setOpen(false)}
        onOk={editor.submit}
        confirmLoading={editor.saving}
        okButtonProps={{ disabled: editor.plateDetecting }}
        width={960}
        destroyOnClose
      >
        <Form form={editor.form} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="projectId" label="Công trình" rules={[{ required: true }]}>
                <Select showSearch optionFilterProp="label" options={projectOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="materialId" label="Vật tư" rules={[{ required: true }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={materialOptions}
                  onChange={(id) => {
                    const material = materials.find((item) => item.id === id);
                    if (material && !editor.form.getFieldValue('unitPrice')) {
                      editor.form.setFieldValue('unitPrice', material.defaultUnitPrice);
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="supplierId" label="Nhà cung cấp" rules={[{ required: true }]}>
                <Select showSearch optionFilterProp="label" options={supplierOptions} />
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
                    void editor.detectUploadedPlate(file as File);
                    return false;
                  }}
                  onRemove={() => {
                    editor.resetPlateDetection();
                    editor.form.setFieldValue('licensePlate', undefined);
                    return true;
                  }}
                >
                  <p className="ant-upload-drag-icon"><CameraOutlined /></p>
                  <p className="ant-upload-text">Chọn ảnh OCR biển số</p>
                  <p className="ant-upload-hint">Chọn ảnh xong hệ thống sẽ detect ngay.</p>
                </Upload.Dragger>
                {(editor.platePreviewUrl || editor.plateDetecting || editor.plateOcr || editor.plateOcrError) ? (
                  <div className="plate-preview-panel">
                    <div className="plate-preview-result">
                      {editor.plateDetecting ? (
                        <Alert
                          type="info"
                          showIcon
                          message="Đang detect biển số"
                          description={
                            editor.plateOcrAttemptLabel
                              ? `Đang thử cấu hình: ${editor.plateOcrAttemptLabel}`
                              : 'Backend đang gọi Python OCR API. Kết quả sẽ được tự điền vào ô biển số xác nhận.'
                          }
                        />
                      ) : null}
                      {editor.plateOcr ? (
                        <Alert
                          type={detectedPlateText(editor.plateOcr) ? 'success' : 'warning'}
                          showIcon
                          message={
                            detectedPlateText(editor.plateOcr)
                              ? `Biển số detect được: ${detectedPlateText(editor.plateOcr)}`
                              : 'OCR chưa đọc được biển số'
                          }
                          description={
                            <Space direction="vertical" size={2}>
                              <Text>
                                Confidence:{' '}
                                {editor.plateOcr.plates?.[0]?.score !== undefined
                                  ? `${Math.round(editor.plateOcr.plates[0].score * 100)}%`
                                  : 'không có'}
                              </Text>
                              <Text>Nguồn OCR: {editor.plateOcr.plates?.[0]?.ocr_source || 'không có'}</Text>
                              {editor.plateOcrAttemptLabel ? (
                                <Text>Cấu hình OCR: {editor.plateOcrAttemptLabel}</Text>
                              ) : null}
                              <Text type="secondary">Nếu biển số sai, sửa trực tiếp ở ô "Biển số xác nhận".</Text>
                            </Space>
                          }
                        />
                      ) : null}
                      {editor.plateOcrError ? (
                        <Alert type="error" showIcon message="Detect thất bại" description={editor.plateOcrError} />
                      ) : null}
                    </div>
                    {editor.platePreviewUrl ? (
                      <div className="plate-preview-frame">
                        <Image
                          src={editor.platePreviewUrl}
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
