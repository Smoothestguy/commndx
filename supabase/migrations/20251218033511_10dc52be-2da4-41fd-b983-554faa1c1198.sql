-- Add pay period tracking columns to personnel_payments
ALTER TABLE public.personnel_payments 
ADD COLUMN IF NOT EXISTS pay_period_start DATE,
ADD COLUMN IF NOT EXISTS pay_period_end DATE,
ADD COLUMN IF NOT EXISTS regular_hours NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC;

-- Add reimbursement_id to link reimbursements to payments when included
ALTER TABLE public.reimbursements 
ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.personnel_payments(id) ON DELETE SET NULL;

-- Create index for efficient pay period queries
CREATE INDEX IF NOT EXISTS idx_personnel_payments_pay_period 
ON public.personnel_payments(pay_period_start, pay_period_end);

-- Create index for finding unpaid reimbursements
CREATE INDEX IF NOT EXISTS idx_reimbursements_status 
ON public.reimbursements(status) WHERE status = 'approved';