-- Add project_id column to invoices table for direct project association
ALTER TABLE invoices ADD COLUMN project_id uuid REFERENCES projects(id);

-- Create index for performance
CREATE INDEX idx_invoices_project_id ON invoices(project_id);