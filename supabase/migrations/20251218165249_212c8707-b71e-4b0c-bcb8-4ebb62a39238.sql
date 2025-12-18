-- Add bill_rate to personnel_project_assignments for project-specific billing rates
ALTER TABLE personnel_project_assignments 
  ADD COLUMN IF NOT EXISTS bill_rate NUMERIC DEFAULT NULL;

COMMENT ON COLUMN personnel_project_assignments.bill_rate IS 
  'Project-specific bill rate override. NULL = use personnel default bill_rate';

-- Add linked_vendor_id to personnel for auto-created self-vendor
ALTER TABLE personnel 
  ADD COLUMN IF NOT EXISTS linked_vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL;

COMMENT ON COLUMN personnel.linked_vendor_id IS 
  'Auto-created vendor record for this personnel as their own vendor for billing';

-- Function to auto-create a vendor record for personnel who are their own vendor
CREATE OR REPLACE FUNCTION create_personnel_vendor(p_personnel_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor_id UUID;
  v_personnel RECORD;
BEGIN
  -- Get personnel info
  SELECT * INTO v_personnel FROM personnel WHERE id = p_personnel_id;
  
  IF v_personnel IS NULL THEN
    RAISE EXCEPTION 'Personnel not found';
  END IF;
  
  -- Check if already has linked vendor
  IF v_personnel.linked_vendor_id IS NOT NULL THEN
    RETURN v_personnel.linked_vendor_id;
  END IF;
  
  -- Create vendor record for this personnel
  INSERT INTO vendors (
    name, 
    email, 
    phone, 
    address, 
    city, 
    state, 
    zip,
    vendor_type, 
    status, 
    company
  ) VALUES (
    v_personnel.first_name || ' ' || v_personnel.last_name,
    v_personnel.email,
    v_personnel.phone,
    v_personnel.address,
    v_personnel.city,
    v_personnel.state,
    v_personnel.zip,
    'personnel',
    'active',
    v_personnel.first_name || ' ' || v_personnel.last_name
  ) RETURNING id INTO v_vendor_id;
  
  -- Link back to personnel
  UPDATE personnel SET linked_vendor_id = v_vendor_id WHERE id = p_personnel_id;
  
  RETURN v_vendor_id;
END;
$$;