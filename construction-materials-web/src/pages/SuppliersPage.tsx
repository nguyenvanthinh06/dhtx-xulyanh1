import { Button, Input, Select, Tag } from 'antd';
import { ClearOutlined } from '@ant-design/icons';
import { api } from '../api';
import { CrudPanel } from '../components/CrudPanel';
import type { FieldConfig } from '../components/FieldRenderer';
import type { Supplier } from '../types';
import { useSuppliersPageViewModel } from '../viewModels/useSuppliersPageViewModel';

type SuppliersPageProps = {
  suppliers: Supplier[];
  loading: boolean;
  refresh: () => Promise<void>;
};

export function SuppliersPage({ suppliers, loading, refresh }: SuppliersPageProps) {
  const vm = useSuppliersPageViewModel(suppliers);

  const fields: FieldConfig[] = [
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

  const filters = (
    <>
      <Input
        allowClear
        className="filter-input"
        placeholder="Tìm mã, tên, MST, SĐT"
        value={vm.filters.search}
        onChange={(event) => vm.setFilters((current) => ({ ...current, search: event.target.value }))}
      />
      <Select
        allowClear
        className="filter-select-sm"
        placeholder="Trạng thái"
        value={vm.filters.active}
        onChange={(active) => vm.setFilters((current) => ({ ...current, active }))}
        options={[
          { value: 'true', label: 'Đang hợp tác' },
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
      title="Nhà cung cấp"
      subtitle="Thông tin đối tác cung ứng vật liệu và đầu mối liên hệ."
      data={vm.filteredSuppliers}
      totalCount={suppliers.length}
      filters={filters}
      loading={loading}
      fields={fields}
      createItem={api.createSupplier}
      updateItem={api.updateSupplier}
      deleteItem={api.deleteSupplier}
      refresh={refresh}
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
