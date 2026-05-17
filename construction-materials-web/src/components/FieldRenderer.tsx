import { DatePicker, Form, Input, InputNumber, Select, Switch } from 'antd';
import dayjs from 'dayjs';

export type FieldKind = 'text' | 'number' | 'textarea' | 'select' | 'date' | 'switch';

export type FieldConfig = {
  name: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  options?: { label: string; value: string }[];
  min?: number;
};

export function serializeValues(values: Record<string, unknown>, fields: FieldConfig[]) {
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

export function initialValues(record: Record<string, unknown>, fields: FieldConfig[]) {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    const value = record[field.name];
    values[field.name] = field.kind === 'date' && value ? dayjs(String(value)) : value;
  }
  return values;
}

export function FieldRenderer({ field }: { field: FieldConfig }) {
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
