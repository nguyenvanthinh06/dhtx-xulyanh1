import type { ReactNode } from 'react';
import { Typography } from 'antd';

const { Text } = Typography;

type FilterStripProps = {
  children: ReactNode;
  currentCount: number;
  totalCount?: number;
};

export function FilterStrip({ children, currentCount, totalCount }: FilterStripProps) {
  return (
    <div className="filter-strip">
      <div className="filter-controls">{children}</div>
      <Text type="secondary">
        Hiển thị {currentCount}
        {totalCount !== undefined ? ` / ${totalCount}` : ''} dòng
      </Text>
    </div>
  );
}
