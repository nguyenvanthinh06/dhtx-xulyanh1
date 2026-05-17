import { useMemo, useState } from 'react';
import type { Supplier } from '../types';
import { textMatches } from '../utils/filters';

type SupplierFilters = {
  search?: string;
  active?: string;
};

export function useSuppliersPageViewModel(suppliers: Supplier[]) {
  const [filters, setFilters] = useState<SupplierFilters>({});

  const filteredSuppliers = useMemo(() => suppliers.filter((supplier) => (
    textMatches(
      filters.search,
      supplier.code,
      supplier.name,
      supplier.taxCode,
      supplier.contactPerson,
      supplier.phone,
      supplier.email,
      supplier.address,
    )
    && (!filters.active || String(supplier.active) === filters.active)
  )), [suppliers, filters]);

  return {
    filters,
    setFilters,
    filteredSuppliers,
    resetFilters: () => setFilters({}),
  };
}
