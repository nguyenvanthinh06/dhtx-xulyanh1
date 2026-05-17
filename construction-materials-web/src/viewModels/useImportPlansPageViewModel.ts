import { useMemo, useState } from 'react';
import type { ImportPlan } from '../types';
import type { DateRange } from '../utils/filters';
import { dateInRange } from '../utils/filters';

type ImportPlanFilters = {
  projectId?: string;
  materialId?: string;
  supplierId?: string;
  status?: string;
  range: DateRange;
};

const defaultFilters: ImportPlanFilters = { range: null };

export function useImportPlansPageViewModel(plans: ImportPlan[]) {
  const [filters, setFilters] = useState<ImportPlanFilters>(defaultFilters);

  const filteredPlans = useMemo(() => plans.filter((plan) => (
    (!filters.projectId || plan.projectId === filters.projectId)
    && (!filters.materialId || plan.materialId === filters.materialId)
    && (!filters.supplierId || plan.supplierId === filters.supplierId)
    && (!filters.status || plan.status === filters.status)
    && dateInRange(plan.plannedDate, filters.range)
  )), [plans, filters]);

  return {
    filters,
    setFilters,
    filteredPlans,
    resetFilters: () => setFilters(defaultFilters),
  };
}
