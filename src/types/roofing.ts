export type InspectionType = 'initial' | 'progress' | 'final' | 'warranty' | 'storm_damage';
export type InspectionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type RoofCondition = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
export type RoofType = 'gable' | 'hip' | 'flat' | 'mansard' | 'gambrel' | 'shed' | 'combination';
export type WarrantyType = 'manufacturer' | 'workmanship' | 'extended';
export type WarrantyStatus = 'active' | 'expired' | 'claimed' | 'voided';

// Activity types
export type ActivityType = 'call' | 'email' | 'meeting' | 'note' | 'site_visit' | 'follow_up';
export type ActivityPriority = 'low' | 'medium' | 'high' | 'urgent';

// Appointment types
export type AppointmentType = 'inspection' | 'estimate' | 'installation' | 'follow_up' | 'consultation' | 'warranty_service';
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

// Insurance Claim types
export type ClaimStatus = 'filed' | 'pending_adjuster' | 'adjuster_scheduled' | 'approved' | 'denied' | 'in_progress' | 'completed';

// Task types
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

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
  customer?: { name: string; company?: string };
  project?: { name: string };
  inspector?: { first_name: string; last_name: string };
}

export interface RoofMeasurement {
  id: string;
  project_id?: string;
  customer_id: string;
  measurement_date: string;
  // Area measurements
  total_roof_area?: number;
  total_pitched_area?: number;
  total_flat_area?: number;
  total_facets?: number;
  total_squares?: number;
  pitch?: string;
  roof_type?: RoofType;
  // Linear measurements
  eaves_length?: number;
  valleys_length?: number;
  hips_length?: number;
  ridges_length?: number;
  rakes_length?: number;
  wall_flashing_length?: number;
  step_flashing_length?: number;
  transitions_length?: number;
  parapet_wall_length?: number;
  unspecified_length?: number;
  // JSON fields
  areas: { name: string; length: number; width: number; area: number }[];
  penetrations: { type: string; count: number }[];
  notes?: string;
  created_at: string;
  updated_at: string;
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
  project?: { name: string };
}

export interface Activity {
  id: string;
  customer_id: string;
  project_id?: string;
  activity_type: ActivityType;
  subject: string;
  description?: string;
  activity_date: string;
  created_by: string;
  priority?: ActivityPriority;
  follow_up_date?: string;
  created_at: string;
  updated_at: string;
  customer?: { name: string; company?: string };
  project?: { name: string };
  creator?: { first_name: string; last_name: string };
}

export interface Appointment {
  id: string;
  customer_id: string;
  project_id?: string;
  appointment_type: AppointmentType;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  assigned_to?: string;
  status: AppointmentStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
  customer?: { name: string; company?: string; address?: string };
  project?: { name: string };
  assignee?: { first_name: string; last_name: string };
}

export interface InsuranceClaim {
  id: string;
  customer_id: string;
  project_id?: string;
  claim_number?: string;
  insurance_company: string;
  policy_number?: string;
  adjuster_name?: string;
  adjuster_phone?: string;
  adjuster_email?: string;
  date_of_loss: string;
  damage_description?: string;
  status: ClaimStatus;
  filed_date?: string;
  adjuster_visit_date?: string;
  approved_amount?: number;
  deductible?: number;
  documents: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
  customer?: { name: string; company?: string };
  project?: { name: string };
}

export interface Task {
  id: string;
  customer_id?: string;
  project_id?: string;
  title: string;
  description?: string;
  due_date?: string;
  assigned_to?: string;
  status: TaskStatus;
  priority: TaskPriority;
  completed_at?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  customer?: { name: string; company?: string };
  project?: { name: string };
  assignee?: { first_name: string; last_name: string };
}
