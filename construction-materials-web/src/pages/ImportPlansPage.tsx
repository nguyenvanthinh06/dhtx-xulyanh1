import { Button, DatePicker, Select } from 'antd';
import { ClearOutlined } from '@ant-design/icons';
import { api } from '../api';
import { CrudPanel } from '../components/CrudPanel';
import type { FieldConfig } from '../components/FieldRenderer';
import type { DateRange } from '../utils/filters';
import { dateText, money, number, planStatusLabels, statusTag } from '../utils/format';
import { buildSelectOptions } from '../utils/options';
import type { ImportPlan, Material, Project, Supplier } from '../types';
import { useImportPlansPageViewModel } from '../viewModels/useImportPlansPageViewModel';

const { RangePicker } = DatePicker;

type ImportPlansPageProps = {
  plans: ImportPlan[];
  projects: Project[];
  materials: Material[];
  suppliers: Supplier[];
  loading: boolean;
  refresh: () => Promise<void>;
};

export function ImportPlansPage({
  plans,
  projects,
  materials,
  suppliers,
  loading,
  refresh,
}: ImportPlansPageProps) {
  const vm = useImportPlansPageViewModel(plans);
  const projectOptions = buildSelectOptions(projects);
  const materialOptions = buildSelectOptions(materials);
  const supplierOptions = buildSelectOptions(suppliers);

  const fields: FieldConfig[] = [
    { name: 'projectId', label: 'Công trình', kind: 'select', required: true, options: projectOptions },
    { name: 'materialId', label: 'Vật tư', kind: 'select', required: true, options: materialOptions },
    { name: 'supplierId', label: 'Nhà cung cấp', kind: 'select', options: supplierOptions },
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

  const filters = (
    <>
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
          { value: 'planned', label: 'Đã lập' },
          { value: 'partial', label: 'Đang nhập' },
          { value: 'completed', label: 'Hoàn tất' },
          { value: 'cancelled', label: 'Hủy' },
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
    <CrudPanel
      title="Kế hoạch nhập"
      subtitle="Kế hoạch vật liệu theo công trình, nhà cung cấp, thời gian và giá dự kiến."
      data={vm.filteredPlans}
      totalCount={plans.length}
      filters={filters}
      loading={loading}
      fields={fields}
      createItem={api.createImportPlan}
      updateItem={api.updateImportPlan}
      deleteItem={api.deleteImportPlan}
      refresh={refresh}
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
