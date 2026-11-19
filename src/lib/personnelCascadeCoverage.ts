// Live pg_constraint audit (personnel FK ON DELETE CASCADE), 2026-11-19.
export const protectedPersonnelTables = {
  document_signatures: 'document signatures', visit_personnel: 'worked stays', timesheet_signature_requests: 'timesheet signature requests',
  personnel_expenses: 'personnel expenses', personnel_hotel_assignments: 'hotel assignments', shift_extensions: 'shift extensions',
  variance_resolutions: 'variance resolutions', crew_members: 'crew memberships', site_checkin_tokens: 'site check-in links',
  personnel_badges: 'badges', personnel_certifications: 'certifications', personnel_assignment_ratings: 'assignment ratings',
  personnel_engagement_notes: 'engagement notes', project_personnel_rate_history: 'rate history',
  reimbursements: 'reimbursements', project_labor_expenses: 'project labor expenses',
} as const;
export const disposablePersonnelCascades = [
  'personnel_onboarding_tokens', 'onboarding_email_deliveries', 'personnel_notifications', 'personnel_notification_preferences',
  'personnel_invitations', 'personnel_status_log', 'clock_alerts', 'personnel_schedules', 'emergency_contacts', 'personnel_languages', 'personnel_capabilities',
] as const;
export const baselinePersonnelCascades = ['location_assignments','location_attendance','personnel_documents','personnel_project_assignments','personnel_w9_forms'] as const;