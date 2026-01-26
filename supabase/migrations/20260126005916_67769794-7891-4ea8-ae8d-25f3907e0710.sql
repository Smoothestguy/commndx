-- Add is_billable column to project_rate_brackets
-- When false, personnel in this bracket are tracked for time and pay but excluded from customer invoices

ALTER TABLE project_rate_brackets 
ADD COLUMN is_billable BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN project_rate_brackets.is_billable IS 
  'If false, personnel in this bracket are excluded from customer invoices but their pay_rate hours are still tracked as internal labor cost';