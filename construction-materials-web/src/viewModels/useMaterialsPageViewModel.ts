import { useMemo, useState } from 'react';
import type { Material } from '../types';
import { textMatches } from '../utils/filters';

type MaterialFilters = {
  search?: string;
  category?: string;
  active?: string;
  unit?: string;
};

export function useMaterialsPageViewModel(materials: Material[]) {
  const [filters, setFilters] = useState<MaterialFilters>({});

  const filteredMaterials = useMemo(() => materials.filter((material) => (
    textMatches(filters.search, material.code, material.name, material.description)
    && (!filters.category || material.category === filters.category)
    && (!filters.active || String(material.active) === filters.active)
    && (!filters.unit || material.unit === filters.unit)
  )), [materials, filters]);

  return {
    filters,
    setFilters,
    filteredMaterials,
    resetFilters: () => setFilters({}),
  };
}
