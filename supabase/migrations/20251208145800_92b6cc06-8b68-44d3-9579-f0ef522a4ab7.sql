-- Create expense category type enum
CREATE TYPE public.expense_category_type AS ENUM ('vendor', 'personnel', 'both');

-- Create vendor bill status enum
CREATE TYPE public.vendor_bill_status AS ENUM ('draft', 'open', 'paid', 'partially_paid', 'void');

-- Create personnel payment type enum
CREATE TYPE public.personnel_payment_type AS ENUM ('regular', 'bonus', 'reimbursement', 'advance');

-- Create expense_categories table
CREATE TABLE public.expense_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category_type public.expense_category_type NOT NULL DEFAULT 'both',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vendor_bills table
CREATE TABLE public.vendor_bills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  vendor_name TEXT NOT NULL,
  bill_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status public.vendor_bill_status NOT NULL DEFAULT 'draft',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  remaining_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vendor_bill_line_items table
CREATE TABLE public.vendor_bill_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id UUID NOT NULL REFERENCES public.vendor_bills(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vendor_bill_payments table
CREATE TABLE public.vendor_bill_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id UUID NOT NULL REFERENCES public.vendor_bills(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'Check',
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create personnel_payments table
CREATE TABLE public.personnel_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  personnel_id UUID NOT NULL REFERENCES public.personnel(id) ON DELETE RESTRICT,
  personnel_name TEXT NOT NULL,
  payment_date DATE NOT NULL,
  gross_amount NUMERIC NOT NULL,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  payment_type public.personnel_payment_type NOT NULL DEFAULT 'regular',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create personnel_payment_allocations table
CREATE TABLE public.personnel_payment_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.personnel_payments(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  amount NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_bill_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_bill_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personnel_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personnel_payment_allocations ENABLE ROW LEVEL SECURITY;

-- RLS policies for expense_categories
CREATE POLICY "Authenticated users can view expense categories"
ON public.expense_categories FOR SELECT
USING (true);

CREATE POLICY "Admins and managers can manage expense categories"
ON public.expense_categories FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- RLS policies for vendor_bills
CREATE POLICY "Authenticated users can view vendor bills"
ON public.vendor_bills FOR SELECT
USING (true);

CREATE POLICY "Admins and managers can manage vendor bills"
ON public.vendor_bills FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- RLS policies for vendor_bill_line_items
CREATE POLICY "Authenticated users can view vendor bill line items"
ON public.vendor_bill_line_items FOR SELECT
USING (true);

CREATE POLICY "Admins and managers can manage vendor bill line items"
ON public.vendor_bill_line_items FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- RLS policies for vendor_bill_payments
CREATE POLICY "Authenticated users can view vendor bill payments"
ON public.vendor_bill_payments FOR SELECT
USING (true);

CREATE POLICY "Admins and managers can manage vendor bill payments"
ON public.vendor_bill_payments FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- RLS policies for personnel_payments
CREATE POLICY "Authenticated users can view personnel payments"
ON public.personnel_payments FOR SELECT
USING (true);

CREATE POLICY "Admins and managers can manage personnel payments"
ON public.personnel_payments FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- RLS policies for personnel_payment_allocations
CREATE POLICY "Authenticated users can view personnel payment allocations"
ON public.personnel_payment_allocations FOR SELECT
USING (true);

CREATE POLICY "Admins and managers can manage personnel payment allocations"
ON public.personnel_payment_allocations FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Create function to generate vendor bill number
CREATE OR REPLACE FUNCTION public.generate_vendor_bill_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year TEXT;
  seq_number INTEGER;
BEGIN
  current_year := TO_CHAR(NOW(), 'YY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM 6) AS INTEGER)), 0) + 1
  INTO seq_number
  FROM public.vendor_bills
  WHERE number LIKE 'BILL-' || current_year || '%';
  RETURN 'BILL-' || current_year || LPAD(seq_number::TEXT, 5, '0');
END;
$$;

-- Create function to generate personnel payment number
CREATE OR REPLACE FUNCTION public.generate_personnel_payment_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year TEXT;
  seq_number INTEGER;
BEGIN
  current_year := TO_CHAR(NOW(), 'YY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM 5) AS INTEGER)), 0) + 1
  INTO seq_number
  FROM public.personnel_payments
  WHERE number LIKE 'PAY-' || current_year || '%';
  RETURN 'PAY-' || current_year || LPAD(seq_number::TEXT, 5, '0');
END;
$$;

-- Create trigger function to set vendor bill number
CREATE OR REPLACE FUNCTION public.set_vendor_bill_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    NEW.number := public.generate_vendor_bill_number();
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger function to set personnel payment number
CREATE OR REPLACE FUNCTION public.set_personnel_payment_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    NEW.number := public.generate_personnel_payment_number();
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger function to update vendor bill amounts on payment changes
CREATE OR REPLACE FUNCTION public.update_vendor_bill_payment_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_paid NUMERIC;
  bill_total NUMERIC;
  new_status public.vendor_bill_status;
BEGIN
  -- Get the bill_id depending on operation
  IF TG_OP = 'DELETE' THEN
    SELECT COALESCE(SUM(amount), 0) INTO total_paid
    FROM public.vendor_bill_payments
    WHERE bill_id = OLD.bill_id;
    
    SELECT total INTO bill_total FROM public.vendor_bills WHERE id = OLD.bill_id;
    
    -- Determine new status
    IF total_paid = 0 THEN
      new_status := 'open';
    ELSIF total_paid >= bill_total THEN
      new_status := 'paid';
    ELSE
      new_status := 'partially_paid';
    END IF;
    
    UPDATE public.vendor_bills
    SET paid_amount = total_paid,
        remaining_amount = bill_total - total_paid,
        status = new_status,
        updated_at = now()
    WHERE id = OLD.bill_id;
    
    RETURN OLD;
  ELSE
    SELECT COALESCE(SUM(amount), 0) INTO total_paid
    FROM public.vendor_bill_payments
    WHERE bill_id = NEW.bill_id;
    
    SELECT total INTO bill_total FROM public.vendor_bills WHERE id = NEW.bill_id;
    
    -- Determine new status
    IF total_paid = 0 THEN
      new_status := 'open';
    ELSIF total_paid >= bill_total THEN
      new_status := 'paid';
    ELSE
      new_status := 'partially_paid';
    END IF;
    
    UPDATE public.vendor_bills
    SET paid_amount = total_paid,
        remaining_amount = bill_total - total_paid,
        status = new_status,
        updated_at = now()
    WHERE id = NEW.bill_id;
    
    RETURN NEW;
  END IF;
END;
$$;

-- Create triggers
CREATE TRIGGER set_vendor_bill_number_trigger
BEFORE INSERT ON public.vendor_bills
FOR EACH ROW
EXECUTE FUNCTION public.set_vendor_bill_number();

CREATE TRIGGER set_personnel_payment_number_trigger
BEFORE INSERT ON public.personnel_payments
FOR EACH ROW
EXECUTE FUNCTION public.set_personnel_payment_number();

CREATE TRIGGER update_vendor_bill_payments_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.vendor_bill_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_vendor_bill_payment_totals();

-- Create updated_at triggers
CREATE TRIGGER update_expense_categories_updated_at
BEFORE UPDATE ON public.expense_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendor_bills_updated_at
BEFORE UPDATE ON public.vendor_bills
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_personnel_payments_updated_at
BEFORE UPDATE ON public.personnel_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_vendor_bills_vendor_id ON public.vendor_bills(vendor_id);
CREATE INDEX idx_vendor_bills_status ON public.vendor_bills(status);
CREATE INDEX idx_vendor_bills_bill_date ON public.vendor_bills(bill_date);
CREATE INDEX idx_vendor_bills_due_date ON public.vendor_bills(due_date);
CREATE INDEX idx_vendor_bill_line_items_bill_id ON public.vendor_bill_line_items(bill_id);
CREATE INDEX idx_vendor_bill_line_items_project_id ON public.vendor_bill_line_items(project_id);
CREATE INDEX idx_vendor_bill_line_items_category_id ON public.vendor_bill_line_items(category_id);
CREATE INDEX idx_vendor_bill_payments_bill_id ON public.vendor_bill_payments(bill_id);
CREATE INDEX idx_personnel_payments_personnel_id ON public.personnel_payments(personnel_id);
CREATE INDEX idx_personnel_payments_payment_date ON public.personnel_payments(payment_date);
CREATE INDEX idx_personnel_payments_category_id ON public.personnel_payments(category_id);
CREATE INDEX idx_personnel_payment_allocations_payment_id ON public.personnel_payment_allocations(payment_id);
CREATE INDEX idx_personnel_payment_allocations_project_id ON public.personnel_payment_allocations(project_id);

-- Seed expense categories
INSERT INTO public.expense_categories (name, description, category_type) VALUES
('Materials', 'Raw materials and supplies', 'vendor'),
('Equipment', 'Tools and equipment', 'vendor'),
('Subcontractor', 'Subcontractor services', 'both'),
('Overhead', 'General overhead expenses', 'both'),
('Office Supplies', 'Office and administrative supplies', 'vendor'),
('Insurance', 'Insurance premiums', 'vendor'),
('Utilities', 'Utility bills', 'vendor'),
('Travel', 'Travel and transportation', 'both'),
('Direct Labor', 'Direct labor costs', 'personnel'),
('Admin Labor', 'Administrative labor costs', 'personnel'),
('Bonus', 'Employee bonuses', 'personnel'),
('Reimbursement', 'Employee reimbursements', 'personnel');