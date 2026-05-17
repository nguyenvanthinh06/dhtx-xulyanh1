import { Button, Input, Select, Tag } from 'antd';
import { ClearOutlined } from '@ant-design/icons';
import { api } from '../api';
import { CrudPanel } from '../components/CrudPanel';
import type { FieldConfig } from '../components/FieldRenderer';
import { materialCategoryLabels, money } from '../utils/format';
import { uniqueOptions } from '../utils/options';
import type { Material } from '../types';
import { useMaterialsPageViewModel } from '../viewModels/useMaterialsPageViewModel';

type MaterialsPageProps = {
  materials: Material[];
  loading: boolean;
  refresh: () => Promise<void>;
};

export function MaterialsPage({ materials, loading, refresh }: MaterialsPageProps) {
  const vm = useMaterialsPageViewModel(materials);

  const fields: FieldConfig[] = [
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

  const filters = (
    <>
      <Input
        allowClear
        className="filter-input"
        placeholder="Tìm mã, tên vật tư"
        value={vm.filters.search}
        onChange={(event) => vm.setFilters((current) => ({ ...current, search: event.target.value }))}
      />
      <Select
        allowClear
        className="filter-select-sm"
        placeholder="Nhóm vật tư"
        value={vm.filters.category}
        onChange={(category) => vm.setFilters((current) => ({ ...current, category }))}
        options={Object.entries(materialCategoryLabels).map(([value, label]) => ({ value, label }))}
      />
      <Select
        allowClear
        className="filter-select-sm"
        placeholder="Đơn vị"
        value={vm.filters.unit}
        onChange={(unit) => vm.setFilters((current) => ({ ...current, unit }))}
        options={uniqueOptions(materials.map((item) => item.unit))}
      />
      <Select
        allowClear
        className="filter-select-sm"
        placeholder="Trạng thái"
        value={vm.filters.active}
        onChange={(active) => vm.setFilters((current) => ({ ...current, active }))}
        options={[
          { value: 'true', label: 'Đang dùng' },
          { value: 'false', label: 'Ngưng' },
        ]}
      />
      <Button icon={<ClearOutlined />} onClick={vm.resetFilters}>
        Xóa lọc
      </Button>
    </>
  );

  return (
    <CrudPanel
      title="Vật tư"
      subtitle="Danh mục vật liệu, đơn vị đo và đơn giá mặc định để nhập theo chuyến."
      data={vm.filteredMaterials}
      totalCount={materials.length}
      filters={filters}
      loading={loading}
      fields={fields}
      createItem={api.createMaterial}
      updateItem={api.updateMaterial}
      deleteItem={api.deleteMaterial}
      refresh={refresh}
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
