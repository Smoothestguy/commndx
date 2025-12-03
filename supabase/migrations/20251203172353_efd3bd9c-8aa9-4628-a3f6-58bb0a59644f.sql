-- Create quickbooks_sync_logs table for tracking sync operations
CREATE TABLE IF NOT EXISTS quickbooks_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL,
  records_synced INTEGER DEFAULT 0,
  details JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE quickbooks_sync_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Authenticated users can manage sync logs"
  ON quickbooks_sync_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);