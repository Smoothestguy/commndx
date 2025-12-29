-- Fix bills marked as 'paid' but with no actual payments recorded
UPDATE vendor_bills
SET status = 'open',
    updated_at = now()
WHERE status = 'paid' 
  AND paid_amount = 0 
  AND remaining_amount > 0;

-- Create validation trigger to prevent future inconsistencies
CREATE OR REPLACE FUNCTION public.validate_vendor_bill_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent setting status to 'paid' if not fully paid
  IF NEW.status = 'paid' AND NEW.paid_amount < NEW.total THEN
    NEW.status := CASE 
      WHEN NEW.paid_amount = 0 THEN 'open'
      ELSE 'partially_paid'
    END;
  END IF;
  
  -- Prevent setting status to 'partially_paid' if not partially paid
  IF NEW.status = 'partially_paid' AND NEW.paid_amount = 0 THEN
    NEW.status := 'open';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER validate_vendor_bill_status_trigger
BEFORE INSERT OR UPDATE ON vendor_bills
FOR EACH ROW
EXECUTE FUNCTION public.validate_vendor_bill_status();