import { useMemo, useState } from 'react';
import type { MaterialTrip } from '../types';
import type { DateRange } from '../utils/filters';
import { dateInRange, textMatches } from '../utils/filters';

type MaterialTripFilters = {
  search?: string;
  projectId?: string;
  materialId?: string;
  supplierId?: string;
  status?: string;
  range: DateRange;
};

const defaultFilters: MaterialTripFilters = { range: null };

export function useMaterialTripsPageViewModel(trips: MaterialTrip[]) {
  const [filters, setFilters] = useState<MaterialTripFilters>(defaultFilters);

  const filteredTrips = useMemo(() => trips.filter((trip) => (
    textMatches(
      filters.search,
      trip.ticketCode,
      trip.licensePlate,
      trip.detectedPlate,
      trip.driverName,
      trip.vehicleType,
    )
    && (!filters.projectId || trip.projectId === filters.projectId)
    && (!filters.materialId || trip.materialId === filters.materialId)
    && (!filters.supplierId || trip.supplierId === filters.supplierId)
    && (!filters.status || trip.status === filters.status)
    && dateInRange(trip.occurredAt, filters.range)
  )), [trips, filters]);

  return {
    filters,
    setFilters,
    filteredTrips,
    resetFilters: () => setFilters(defaultFilters),
  };
}
