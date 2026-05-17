import {
  App as AntApp,
  ConfigProvider,
  Divider,
  Layout,
  Menu,
  Space,
  Tag,
  Typography,
} from 'antd';
import {
  AppstoreOutlined,
  BarChartOutlined,
  CameraOutlined,
  CarOutlined,
  ClusterOutlined,
  FileTextOutlined,
  ShopOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import { DashboardPage } from './pages/DashboardPage';
import { ImportPlansPage } from './pages/ImportPlansPage';
import { MaterialsPage } from './pages/MaterialsPage';
import { MaterialTripsPage } from './pages/MaterialTripsPage';
import { PlateDetectPage } from './pages/PlateDetectPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { useConstructionDataViewModel } from './viewModels/useConstructionDataViewModel';

const { Header, Content, Sider } = Layout;
const { Text } = Typography;

type SectionKey = 'dashboard' | 'projects' | 'materials' | 'suppliers' | 'plans' | 'trips' | 'plate-detect';

function AppShell() {
  const [section, setSection] = useState<SectionKey>('dashboard');
  const vm = useConstructionDataViewModel();

  const content = (() => {
    if (section === 'dashboard') {
      return (
        <DashboardPage
          overview={vm.overview}
          projects={vm.projects}
          loading={vm.loading}
          projectId={vm.reportProjectId}
          setProjectId={vm.setReportProjectId}
          range={vm.reportRange}
          setRange={vm.setReportRange}
          refresh={vm.refreshAll}
        />
      );
    }

    if (section === 'projects') {
      return <ProjectsPage projects={vm.projects} loading={vm.loading} refresh={vm.refreshAll} />;
    }

    if (section === 'materials') {
      return <MaterialsPage materials={vm.materials} loading={vm.loading} refresh={vm.refreshAll} />;
    }

    if (section === 'suppliers') {
      return <SuppliersPage suppliers={vm.suppliers} loading={vm.loading} refresh={vm.refreshAll} />;
    }

    if (section === 'plans') {
      return (
        <ImportPlansPage
          plans={vm.plans}
          projects={vm.projects}
          materials={vm.materials}
          suppliers={vm.suppliers}
          loading={vm.loading}
          refresh={vm.refreshAll}
        />
      );
    }

    if (section === 'plate-detect') {
      return <PlateDetectPage />;
    }

    return (
      <MaterialTripsPage
        trips={vm.trips}
        projects={vm.projects}
        materials={vm.materials}
        suppliers={vm.suppliers}
        plans={vm.plans}
        loading={vm.loading}
        refresh={vm.refreshAll}
      />
    );
  })();

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
            { key: 'plate-detect', icon: <CameraOutlined />, label: 'Detect biển số' },
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
              {vm.ocrStatus === 'ok' ? (
                <Tag color="green">online</Tag>
              ) : vm.ocrStatus === 'down' ? (
                <Tag color="red">offline</Tag>
              ) : (
                <Tag>checking</Tag>
              )}
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
