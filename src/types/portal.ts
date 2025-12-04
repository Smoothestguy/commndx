export interface Reimbursement {
  id: string;
  personnel_id: string;
  project_id: string | null;
  amount: number;
  description: string;
  category: string;
  receipt_url: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  project?: {
    id: string;
    name: string;
  };
}

export interface PersonnelNotification {
  id: string;
  personnel_id: string;
  title: string;
  message: string;
  notification_type: 'general' | 'job_alert' | 'pay_info' | 'assignment';
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PersonnelNotificationPreferences {
  id: string;
  personnel_id: string;
  email_notifications: boolean;
  sms_notifications: boolean;
  job_alerts: boolean;
  pay_notifications: boolean;
  assignment_notifications: boolean;
  created_at: string;
  updated_at: string;
}

export interface PersonnelInvitation {
  id: string;
  personnel_id: string;
  email: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired';
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  personnel?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}
