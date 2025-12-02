export type InspectionType = 'initial' | 'progress' | 'final' | 'warranty' | 'storm_damage';
export type InspectionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type RoofCondition = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
export type RoofType = 'gable' | 'hip' | 'flat' | 'mansard' | 'gambrel' | 'shed' | 'combination';
export type WarrantyType = 'manufacturer' | 'workmanship' | 'extended';
export type WarrantyStatus = 'active' | 'expired' | 'claimed' | 'voided';

export interface RoofInspection {
  id: string;
  project_id?: string;
  customer_id: string;
  inspector_id?: string;
  inspection_date: string;
  inspection_type: InspectionType;
  status: InspectionStatus;
  overall_condition?: RoofCondition;
  notes?: string;
  photos: string[];
  findings: Record<string, unknown>;
  recommendations?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  customer?: { name: string; company?: string };
  project?: { name: string };
  inspector?: { first_name: string; last_name: string };
}

export interface RoofMeasurement {
  id: string;
  project_id?: string;
  customer_id: string;
  measurement_date: string;
  total_squares?: number;
  pitch?: string;
  roof_type?: RoofType;
  areas: { name: string; length: number; width: number; area: number }[];
  ridges_length?: number;
  valleys_length?: number;
  eaves_length?: number;
  penetrations: { type: string; count: number }[];
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  customer?: { name: string; company?: string };
  project?: { name: string };
}

export interface RoofWarranty {
  id: string;
  project_id?: string;
  customer_id: string;
  warranty_type: WarrantyType;
  provider: string;
  coverage_details?: string;
  start_date: string;
  end_date: string;
  status: WarrantyStatus;
  warranty_number?: string;
  documents: string[];
  notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  customer?: { name: string; company?: string };
  project?: { name: string };
}

export interface WeatherLog {
  id: string;
  project_id?: string;
  location: string;
  log_date: string;
  temperature_high?: number;
  temperature_low?: number;
  precipitation?: number;
  wind_speed?: number;
  conditions?: string;
  work_suitable: boolean;
  notes?: string;
  created_at: string;
  // Joined fields
  project?: { name: string };
}
