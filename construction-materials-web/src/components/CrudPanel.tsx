import type { ReactNode } from 'react';
import { useState } from 'react';
import { App as AntApp, Button, Col, Form, Modal, Popconfirm, Row, Space, Table, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { FieldRenderer, type FieldConfig, initialValues, serializeValues } from './FieldRenderer';
import { FilterStrip } from './FilterStrip';

const { Text, Title } = Typography;

type CrudPanelProps<T extends { id: string }> = {
  title: string;
  subtitle: string;
  data: T[];
  totalCount?: number;
  filters?: ReactNode;
  columns: any[];
  fields: FieldConfig[];
  loading: boolean;
  createItem: (payload: Record<string, unknown>) => Promise<unknown>;
  updateItem: (id: string, payload: Record<string, unknown>) => Promise<unknown>;
  deleteItem: (id: string) => Promise<unknown>;
  refresh: () => Promise<void>;
};

export function CrudPanel<T extends { id: string }>(props: CrudPanelProps<T>) {
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
        <Popconfirm
          title="Xóa bản ghi này?"
          onConfirm={async () => {
            await props.deleteItem(record.id);
            message.success('Đã xóa');
            await props.refresh();
          }}
        >
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

      {props.filters ? (
        <FilterStrip currentCount={props.data.length} totalCount={props.totalCount}>
          {props.filters}
        </FilterStrip>
      ) : null}

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
