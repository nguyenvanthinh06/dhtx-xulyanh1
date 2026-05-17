export type ProjectStatus = 'active' | 'paused' | 'completed';
export type MaterialCategory =
  | 'aggregate'
  | 'steel'
  | 'concrete'
  | 'plumbing'
  | 'electrical'
  | 'finishing'
  | 'other';
export type ImportPlanStatus = 'planned' | 'partial' | 'completed' | 'cancelled';
export type MaterialTripStatus = 'pending' | 'verified' | 'rejected';

export interface Project {
  id: string;
  code: string;
  name: string;
  location?: string;
  clientName?: string;
  status: ProjectStatus;
  startDate?: string;
  endDate?: string;
  budget: number;
}

export interface Material {
  id: string;
  code: string;
  name: string;
  category: MaterialCategory;
  unit: string;
  defaultUnitPrice: number;
  active: boolean;
  description?: string;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  taxCode?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  active: boolean;
  note?: string;
}

export interface ImportPlan {
  id: string;
  projectId: string;
  project?: Project;
  materialId: string;
  material?: Material;
  supplierId?: string;
  supplier?: Supplier;
  plannedQuantity: number;
  unitPrice: number;
  plannedDate?: string;
  status: ImportPlanStatus;
  note?: string;
}

export interface MaterialTrip {
  id: string;
  projectId: string;
  project?: Project;
  materialId: string;
  material?: Material;
  supplierId: string;
  supplier?: Supplier;
  importPlanId?: string;
  importPlan?: ImportPlan;
  ticketCode?: string;
  driverName?: string;
  vehicleType?: string;
  licensePlate?: string;
  detectedPlate?: string;
  plateConfidence?: number;
  ocrSource?: string;
  ocrImagePath?: string;
  ocrOutputPath?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  occurredAt: string;
  status: MaterialTripStatus;
  note?: string;
}

export interface PlateOcrResponse {
  success: boolean;
  text: string;
  plates: Array<{
    box: number[];
    score: number;
    text: string;
    source?: string;
    ocr_source?: string;
    raw_text?: string;
  }>;
  image_path: string;
  output_path: string;
  source_hint_path?: string | null;
  output_image_base64?: string;
  options?: Record<string, unknown>;
  logs?: string[];
}

export interface PlateDetectOptions {
  detectEngine?: string;
  ocrEngine?: string;
  fallback?: string;
  finalFallback?: string;
  fallbackDetect?: string;
  plateModel?: string;
  fallbackPlateModel?: string;
  charModel?: string;
  plateConf?: string;
  fallbackPlateConf?: string;
  charConf?: string;
  plateCropScale?: string;
  minPlateWidth?: string;
  includeLogs?: boolean;
  includeImage?: boolean;
}

export interface AggregateRow {
  key: string;
  name: string;
  unit?: string;
  quantity: number;
  cost: number;
  trips: number;
}

export interface Overview {
  filters: Record<string, unknown>;
  totals: {
    trips: number;
    quantity: number;
    cost: number;
    averageCostPerTrip: number;
  };
  byMaterial: AggregateRow[];
  bySupplier: AggregateRow[];
  byDay: AggregateRow[];
  recentTrips: MaterialTrip[];
}
