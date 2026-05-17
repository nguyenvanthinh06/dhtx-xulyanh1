import axios from 'axios';
import {
  ImportPlan,
  Material,
  MaterialTrip,
  Overview,
  PlateDetectOptions,
  PlateOcrResponse,
  Project,
  Supplier,
} from './types';

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
});

function cleanPayload<T extends Record<string, unknown>>(payload: T) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== ''),
  );
}

function params(payload: Record<string, unknown>) {
  return cleanPayload(payload);
}

export const api = {
  health: async () => (await http.get('/plates/health')).data,
  detectPlate: async (image: File, options: PlateDetectOptions = {}) => {
    const form = new FormData();
    form.append('image', image);
    Object.entries(cleanPayload(options as Record<string, unknown>)).forEach(([key, value]) => {
      form.append(key, String(value));
    });
    return (await http.post<PlateOcrResponse>('/plates/detect', form)).data;
  },

  listProjects: async () => (await http.get<Project[]>('/projects')).data,
  createProject: async (payload: Record<string, unknown>) =>
    (await http.post<Project>('/projects', cleanPayload(payload))).data,
  updateProject: async (id: string, payload: Record<string, unknown>) =>
    (await http.patch<Project>(`/projects/${id}`, cleanPayload(payload))).data,
  deleteProject: async (id: string) => (await http.delete(`/projects/${id}`)).data,

  listMaterials: async () => (await http.get<Material[]>('/materials')).data,
  createMaterial: async (payload: Record<string, unknown>) =>
    (await http.post<Material>('/materials', cleanPayload(payload))).data,
  updateMaterial: async (id: string, payload: Record<string, unknown>) =>
    (await http.patch<Material>(`/materials/${id}`, cleanPayload(payload))).data,
  deleteMaterial: async (id: string) => (await http.delete(`/materials/${id}`)).data,

  listSuppliers: async () => (await http.get<Supplier[]>('/suppliers')).data,
  createSupplier: async (payload: Record<string, unknown>) =>
    (await http.post<Supplier>('/suppliers', cleanPayload(payload))).data,
  updateSupplier: async (id: string, payload: Record<string, unknown>) =>
    (await http.patch<Supplier>(`/suppliers/${id}`, cleanPayload(payload))).data,
  deleteSupplier: async (id: string) => (await http.delete(`/suppliers/${id}`)).data,

  listImportPlans: async (query: Record<string, unknown> = {}) =>
    (await http.get<ImportPlan[]>('/import-plans', { params: params(query) })).data,
  createImportPlan: async (payload: Record<string, unknown>) =>
    (await http.post<ImportPlan>('/import-plans', cleanPayload(payload))).data,
  updateImportPlan: async (id: string, payload: Record<string, unknown>) =>
    (await http.patch<ImportPlan>(`/import-plans/${id}`, cleanPayload(payload))).data,
  deleteImportPlan: async (id: string) => (await http.delete(`/import-plans/${id}`)).data,

  listMaterialTrips: async (query: Record<string, unknown> = {}) =>
    (await http.get<MaterialTrip[]>('/material-trips', { params: params(query) })).data,
  createMaterialTrip: async (payload: Record<string, unknown>, image?: File) => {
    if (!image) {
      return (await http.post<MaterialTrip>('/material-trips', cleanPayload(payload))).data;
    }

    const form = new FormData();
    Object.entries(cleanPayload(payload)).forEach(([key, value]) => form.append(key, String(value)));
    form.append('image', image);
    return (await http.post<MaterialTrip>('/material-trips/with-plate-image', form)).data;
  },
  updateMaterialTrip: async (id: string, payload: Record<string, unknown>) =>
    (await http.patch<MaterialTrip>(`/material-trips/${id}`, cleanPayload(payload))).data,
  detectTripPlate: async (id: string, image: File) => {
    const form = new FormData();
    form.append('image', image);
    return (await http.post<MaterialTrip>(`/material-trips/${id}/plate-detect`, form)).data;
  },
  deleteMaterialTrip: async (id: string) => (await http.delete(`/material-trips/${id}`)).data,

  overview: async (query: Record<string, unknown> = {}) =>
    (await http.get<Overview>('/reports/overview', { params: params(query) })).data,
};
