-- Journal entries table (read-only cache from QuickBooks)
CREATE TABLE public.quickbooks_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quickbooks_id TEXT NOT NULL UNIQUE,
  doc_number TEXT,
  txn_date DATE NOT NULL,
  private_note TEXT,
  total_amount NUMERIC(12,2) DEFAULT 0,
  is_adjustment BOOLEAN DEFAULT FALSE,
  currency_code TEXT DEFAULT 'USD',
  line_items JSONB DEFAULT '[]',
  raw_data JSONB,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS - only admins, managers, and accounting can view
ALTER TABLE public.quickbooks_journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins managers and accounting can view journal entries"
  ON public.quickbooks_journal_entries FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    public.has_role(auth.uid(), 'accounting')
  );

-- Admin-only INSERT/UPDATE/DELETE for sync operations (edge function uses service role)
CREATE POLICY "Service role can manage journal entries"
  ON public.quickbooks_journal_entries FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Index for date-based queries
CREATE INDEX idx_qb_journal_entries_txn_date ON public.quickbooks_journal_entries(txn_date DESC);
CREATE INDEX idx_qb_journal_entries_quickbooks_id ON public.quickbooks_journal_entries(quickbooks_id);