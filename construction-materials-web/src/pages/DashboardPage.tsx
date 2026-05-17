import { Button, Card, Col, DatePicker, Row, Select, Space, Statistic, Table, Typography } from 'antd';
import { CarOutlined, ReloadOutlined } from '@ant-design/icons';
import type { DateRange } from '../utils/filters';
import { buildSelectOptions } from '../utils/options';
import {
  dateTimeText,
  money,
  number,
  statusTag,
  tripStatusLabels,
} from '../utils/format';
import type { MaterialTrip, Overview, Project } from '../types';

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

type DashboardPageProps = {
  overview?: Overview;
  projects: Project[];
  loading: boolean;
  projectId?: string;
  setProjectId: (value?: string) => void;
  range: DateRange;
  setRange: (value: DateRange) => void;
  refresh: () => Promise<void>;
};

export function DashboardPage({
  overview,
  projects,
  loading,
  projectId,
  setProjectId,
  range,
  setRange,
  refresh,
}: DashboardPageProps) {
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
          <RangePicker value={range} onChange={(value) => setRange(value as DateRange)} format="DD/MM/YYYY" />
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
