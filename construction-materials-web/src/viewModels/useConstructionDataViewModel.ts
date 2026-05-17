import { App as AntApp } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { DateRange } from '../utils/filters';
import type { ImportPlan, Material, MaterialTrip, Overview, Project, Supplier } from '../types';

export function useConstructionDataViewModel() {
  const { message } = AntApp.useApp();
  const [loading, setLoading] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<'checking' | 'ok' | 'down'>('checking');
  const [projects, setProjects] = useState<Project[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [plans, setPlans] = useState<ImportPlan[]>([]);
  const [trips, setTrips] = useState<MaterialTrip[]>([]);
  const [overview, setOverview] = useState<Overview>();
  const [reportProjectId, setReportProjectId] = useState<string | undefined>();
  const [reportRange, setReportRange] = useState<DateRange>([
    dayjs().startOf('month'),
    dayjs().endOf('day'),
  ]);

  const loadCoreData = useCallback(async () => {
    setLoading(true);
    try {
      const [projectRows, materialRows, supplierRows, planRows, tripRows] = await Promise.all([
        api.listProjects(),
        api.listMaterials(),
        api.listSuppliers(),
        api.listImportPlans(),
        api.listMaterialTrips(),
      ]);
      setProjects(projectRows);
      setMaterials(materialRows);
      setSuppliers(supplierRows);
      setPlans(planRows);
      setTrips(tripRows);
    } catch {
      message.error('Không tải được dữ liệu từ backend');
    } finally {
      setLoading(false);
    }
  }, [message]);

  const loadOverview = useCallback(async () => {
    const query = {
      projectId: reportProjectId,
      from: reportRange?.[0]?.startOf('day').toISOString(),
      to: reportRange?.[1]?.endOf('day').toISOString(),
    };
    const data = await api.overview(query);
    setOverview(data);
  }, [reportProjectId, reportRange]);

  const refreshAll = useCallback(async () => {
    await loadCoreData();
    await loadOverview();
  }, [loadCoreData, loadOverview]);

  useEffect(() => {
    void loadCoreData();
    api.health()
      .then(() => setOcrStatus('ok'))
      .catch(() => setOcrStatus('down'));
  }, [loadCoreData]);

  useEffect(() => {
    loadOverview().catch(() => undefined);
  }, [loadOverview]);

  return {
    loading,
    ocrStatus,
    projects,
    materials,
    suppliers,
    plans,
    trips,
    overview,
    reportProjectId,
    reportRange,
    setReportProjectId,
    setReportRange,
    refreshAll,
  };
}
