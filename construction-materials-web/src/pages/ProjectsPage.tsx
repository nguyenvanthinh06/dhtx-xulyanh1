import { Button, DatePicker, Input, Select } from 'antd';
import { ClearOutlined } from '@ant-design/icons';
import { api } from '../api';
import { CrudPanel } from '../components/CrudPanel';
import type { FieldConfig } from '../components/FieldRenderer';
import type { DateRange } from '../utils/filters';
import { money, projectStatusLabels, statusTag } from '../utils/format';
import type { Project } from '../types';
import { useProjectsPageViewModel } from '../viewModels/useProjectsPageViewModel';

const { RangePicker } = DatePicker;

type ProjectsPageProps = {
  projects: Project[];
  loading: boolean;
  refresh: () => Promise<void>;
};

export function ProjectsPage({ projects, loading, refresh }: ProjectsPageProps) {
  const vm = useProjectsPageViewModel(projects);

  const fields: FieldConfig[] = [
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

  const filters = (
    <>
      <Input
        allowClear
        className="filter-input"
        placeholder="Tìm mã, tên, địa điểm"
        value={vm.filters.search}
        onChange={(event) => vm.setFilters((current) => ({ ...current, search: event.target.value }))}
      />
      <Select
        allowClear
        className="filter-select-sm"
        placeholder="Trạng thái"
        value={vm.filters.status}
        onChange={(status) => vm.setFilters((current) => ({ ...current, status }))}
        options={[
          { value: 'active', label: 'Đang thi công' },
          { value: 'paused', label: 'Tạm dừng' },
          { value: 'completed', label: 'Hoàn thành' },
        ]}
      />
      <RangePicker
        className="filter-date-range"
        value={vm.filters.range}
        onChange={(range) => vm.setFilters((current) => ({ ...current, range: range as DateRange }))}
        format="DD/MM/YYYY"
        placeholder={['Bắt đầu từ', 'Kết thúc đến']}
      />
      <Button icon={<ClearOutlined />} onClick={vm.resetFilters}>
        Xóa lọc
      </Button>
    </>
  );

  return (
    <CrudPanel
      title="Công trình"
      subtitle="Hồ sơ công trình dùng để tách báo cáo vật liệu theo từng dự án."
      data={vm.filteredProjects}
      totalCount={projects.length}
      filters={filters}
      loading={loading}
      fields={fields}
      createItem={api.createProject}
      updateItem={api.updateProject}
      deleteItem={api.deleteProject}
      refresh={refresh}
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
