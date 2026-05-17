import { useMemo, useState } from 'react';
import type { Project } from '../types';
import type { DateRange } from '../utils/filters';
import { dateSpanOverlapsRange, textMatches } from '../utils/filters';

type ProjectFilters = {
  search?: string;
  status?: string;
  range: DateRange;
};

const defaultFilters: ProjectFilters = { range: null };

export function useProjectsPageViewModel(projects: Project[]) {
  const [filters, setFilters] = useState<ProjectFilters>(defaultFilters);

  const filteredProjects = useMemo(() => projects.filter((project) => (
    textMatches(filters.search, project.code, project.name, project.location, project.clientName)
    && (!filters.status || project.status === filters.status)
    && dateSpanOverlapsRange(project.startDate, project.endDate, filters.range)
  )), [projects, filters]);

  return {
    filters,
    setFilters,
    filteredProjects,
    resetFilters: () => setFilters(defaultFilters),
  };
}
