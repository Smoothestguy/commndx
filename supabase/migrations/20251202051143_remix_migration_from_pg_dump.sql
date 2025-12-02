CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'manager',
    'user'
);


--
-- Name: customer_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.customer_type AS ENUM (
    'residential',
    'commercial',
    'government',
    'non_profit',
    'other'
);


--
-- Name: estimate_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estimate_status AS ENUM (
    'draft',
    'pending',
    'approved',
    'sent'
);


--
-- Name: everify_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.everify_status AS ENUM (
    'pending',
    'verified',
    'rejected',
    'expired',
    'not_required'
);


--
-- Name: invoice_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invoice_status AS ENUM (
    'draft',
    'sent',
    'paid',
    'overdue'
);


--
-- Name: job_order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.job_order_status AS ENUM (
    'active',
    'in-progress',
    'completed',
    'on-hold'
);


--
-- Name: personnel_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.personnel_status AS ENUM (
    'active',
    'inactive',
    'do_not_hire'
);


--
-- Name: project_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_status AS ENUM (
    'active',
    'completed',
    'on-hold'
);


--
-- Name: purchase_order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.purchase_order_status AS ENUM (
    'draft',
    'pending_approval',
    'sent',
    'acknowledged',
    'in-progress',
    'completed',
    'cancelled'
);


--
-- Name: vendor_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.vendor_status AS ENUM (
    'active',
    'inactive'
);


--
-- Name: work_auth_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.work_auth_type AS ENUM (
    'citizen',
    'permanent_resident',
    'work_visa',
    'ead',
    'other'
);


--
-- Name: assign_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_user_role() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  user_count INTEGER;
BEGIN
  -- Count existing users in user_roles
  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  
  -- First user gets admin, others get user role
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: expire_old_invitations(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expire_old_invitations() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.invitations
  SET status = 'expired'
  WHERE status = 'pending' 
    AND expires_at < now();
END;
$$;


--
-- Name: generate_estimate_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_estimate_number() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  current_year TEXT;
  seq_number INTEGER;
BEGIN
  current_year := TO_CHAR(NOW(), 'YY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM 5) AS INTEGER)), 0) + 1
  INTO seq_number
  FROM public.estimates
  WHERE number LIKE 'EST-' || current_year || '%';
  RETURN 'EST-' || current_year || LPAD(seq_number::TEXT, 5, '0');
END;
$$;


--
-- Name: generate_invoice_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_invoice_number() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  current_year TEXT;
  seq_number INTEGER;
BEGIN
  current_year := TO_CHAR(NOW(), 'YY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM 5) AS INTEGER)), 0) + 1
  INTO seq_number
  FROM public.invoices
  WHERE number LIKE 'INV-' || current_year || '%';
  RETURN 'INV-' || current_year || LPAD(seq_number::TEXT, 5, '0');
END;
$$;


--
-- Name: generate_job_order_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_job_order_number() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  current_year TEXT;
  seq_number INTEGER;
BEGIN
  current_year := TO_CHAR(NOW(), 'YY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM 4) AS INTEGER)), 0) + 1
  INTO seq_number
  FROM public.job_orders
  WHERE number LIKE 'JO-' || current_year || '%';
  RETURN 'JO-' || current_year || LPAD(seq_number::TEXT, 5, '0');
END;
$$;


--
-- Name: generate_personnel_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_personnel_number() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  current_year TEXT;
  seq_number INTEGER;
  new_number TEXT;
BEGIN
  current_year := TO_CHAR(NOW(), 'YY');
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(personnel_number FROM 4 FOR 5) AS INTEGER)
  ), 0) + 1
  INTO seq_number
  FROM public.personnel
  WHERE personnel_number LIKE 'P-' || current_year || '%';
  
  new_number := 'P-' || current_year || LPAD(seq_number::TEXT, 5, '0');
  RETURN new_number;
END;
$$;


--
-- Name: generate_purchase_order_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_purchase_order_number() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  current_year TEXT;
  seq_number INTEGER;
BEGIN
  current_year := TO_CHAR(NOW(), 'YY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM 4) AS INTEGER)), 0) + 1
  INTO seq_number
  FROM public.purchase_orders
  WHERE number LIKE 'PO-' || current_year || '%';
  RETURN 'PO-' || current_year || LPAD(seq_number::TEXT, 5, '0');
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', '')
  );
  RETURN new;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;


--
-- Name: set_estimate_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_estimate_number() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    NEW.number := public.generate_estimate_number();
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_invoice_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_invoice_number() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    NEW.number := public.generate_invoice_number();
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_job_order_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_job_order_number() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    NEW.number := public.generate_job_order_number();
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_personnel_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_personnel_number() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.personnel_number IS NULL OR NEW.personnel_number = '' THEN
    NEW.personnel_number := public.generate_personnel_number();
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_purchase_order_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_purchase_order_number() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    NEW.number := public.generate_purchase_order_number();
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: update_project_assignment_activity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_project_assignment_activity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.project_assignments
  SET last_time_entry_at = NEW.entry_date
  WHERE project_id = NEW.project_id
    AND user_id = NEW.user_id
    AND status = 'active';
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: badge_template_fields; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.badge_template_fields (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid NOT NULL,
    field_name text NOT NULL,
    is_enabled boolean DEFAULT true,
    position_x integer,
    position_y integer,
    font_size integer,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: badge_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.badge_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    is_default boolean DEFAULT false,
    orientation text DEFAULT 'portrait'::text,
    background_color text DEFAULT '#ffffff'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: company_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_name text DEFAULT 'My Company'::text NOT NULL,
    legal_name text,
    logo_url text,
    address text,
    city text,
    state text,
    zip text,
    phone text,
    email text,
    website text,
    tax_id text,
    default_tax_rate numeric DEFAULT 0,
    overtime_threshold numeric DEFAULT 8,
    weekly_overtime_threshold numeric DEFAULT 40,
    overtime_multiplier numeric DEFAULT 1.5,
    invoice_footer text,
    estimate_footer text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    phone text,
    company text,
    address text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    customer_type public.customer_type DEFAULT 'commercial'::public.customer_type,
    notes text
);


--
-- Name: emergency_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emergency_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    personnel_id uuid NOT NULL,
    contact_name text NOT NULL,
    relationship text,
    phone text NOT NULL,
    email text,
    is_primary boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: estimate_line_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estimate_line_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    estimate_id uuid NOT NULL,
    product_id uuid,
    description text NOT NULL,
    quantity numeric(10,2) NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    markup numeric(5,2) NOT NULL,
    total numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: estimates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estimates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    number text NOT NULL,
    customer_id uuid NOT NULL,
    customer_name text NOT NULL,
    project_id uuid,
    project_name text,
    status public.estimate_status DEFAULT 'draft'::public.estimate_status NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    tax_rate numeric(5,2) NOT NULL,
    tax_amount numeric(10,2) NOT NULL,
    total numeric(10,2) NOT NULL,
    notes text,
    valid_until date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    approval_token text,
    sent_at timestamp with time zone,
    customer_approved boolean DEFAULT false
);


--
-- Name: invitation_activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invitation_activity_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invitation_id uuid NOT NULL,
    action text NOT NULL,
    performed_by uuid,
    performed_by_email text,
    target_email text NOT NULL,
    target_role public.app_role NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT invitation_activity_log_action_check CHECK ((action = ANY (ARRAY['sent'::text, 'resent'::text, 'accepted'::text, 'cancelled'::text, 'expired'::text, 'reminder_sent'::text])))
);

ALTER TABLE ONLY public.invitation_activity_log REPLICA IDENTITY FULL;


--
-- Name: invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    role public.app_role NOT NULL,
    token text NOT NULL,
    invited_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    used_at timestamp with time zone,
    status text DEFAULT 'pending'::text NOT NULL,
    CONSTRAINT invitations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text, 'cancelled'::text])))
);


--
-- Name: invoice_line_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_line_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    description text NOT NULL,
    quantity numeric(10,2) NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    markup numeric(5,2) DEFAULT 0 NOT NULL,
    total numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    number text NOT NULL,
    job_order_id uuid,
    job_order_number text,
    estimate_id uuid,
    customer_id uuid NOT NULL,
    customer_name text NOT NULL,
    project_name text,
    status public.invoice_status DEFAULT 'draft'::public.invoice_status NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    tax_rate numeric(5,2) NOT NULL,
    tax_amount numeric(10,2) NOT NULL,
    total numeric(10,2) NOT NULL,
    due_date date NOT NULL,
    paid_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: job_order_line_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_order_line_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_order_id uuid NOT NULL,
    description text NOT NULL,
    quantity numeric(10,2) NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    markup numeric(5,2) NOT NULL,
    total numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: job_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    number text NOT NULL,
    estimate_id uuid,
    customer_id uuid NOT NULL,
    customer_name text NOT NULL,
    project_id uuid NOT NULL,
    project_name text NOT NULL,
    status public.job_order_status DEFAULT 'active'::public.job_order_status NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    tax_rate numeric(5,2) NOT NULL,
    tax_amount numeric(10,2) NOT NULL,
    total numeric(10,2) NOT NULL,
    invoiced_amount numeric(10,2) DEFAULT 0 NOT NULL,
    remaining_amount numeric(10,2) NOT NULL,
    start_date date NOT NULL,
    completion_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: milestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    due_date date NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    completion_percentage integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT milestones_completion_percentage_check CHECK (((completion_percentage >= 0) AND (completion_percentage <= 100))),
    CONSTRAINT milestones_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in-progress'::text, 'completed'::text, 'delayed'::text])))
);


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    event_accepted boolean DEFAULT true,
    event_expired boolean DEFAULT true,
    event_cancelled boolean DEFAULT true,
    event_reminder_sent boolean DEFAULT true,
    event_sent boolean DEFAULT false,
    event_resent boolean DEFAULT false,
    notification_toast boolean DEFAULT true,
    notification_sound boolean DEFAULT false,
    notification_browser boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    po_submitted_for_approval boolean DEFAULT true,
    po_approved boolean DEFAULT true,
    po_rejected boolean DEFAULT true,
    po_sent boolean DEFAULT true,
    po_status_changed boolean DEFAULT true
);


--
-- Name: personnel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personnel (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    personnel_number text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text NOT NULL,
    phone text,
    address text,
    city text,
    state text,
    zip text,
    date_of_birth date,
    photo_url text,
    hourly_rate numeric DEFAULT 0,
    rating numeric,
    status public.personnel_status DEFAULT 'active'::public.personnel_status,
    ssn_last_four text,
    work_authorization_status text,
    work_authorization_type public.work_auth_type,
    work_auth_expiry date,
    id_document_url text,
    i9_completed_at timestamp with time zone,
    everify_status public.everify_status DEFAULT 'pending'::public.everify_status,
    everify_case_number text,
    everify_verified_at timestamp with time zone,
    everify_expiry date,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: personnel_capabilities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personnel_capabilities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    personnel_id uuid NOT NULL,
    capability text NOT NULL,
    years_experience integer,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: personnel_certifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personnel_certifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    personnel_id uuid NOT NULL,
    certification_name text NOT NULL,
    issuing_organization text,
    issue_date date,
    expiry_date date,
    certificate_number text,
    document_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: personnel_languages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personnel_languages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    personnel_id uuid NOT NULL,
    language text NOT NULL,
    proficiency text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: po_line_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.po_line_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_order_id uuid NOT NULL,
    description text NOT NULL,
    quantity numeric(10,2) NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    markup numeric(5,2) DEFAULT 0 NOT NULL,
    total numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    cost numeric(10,2) NOT NULL,
    markup numeric(5,2) NOT NULL,
    price numeric(10,2) NOT NULL,
    unit text NOT NULL,
    category text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    first_name text,
    last_name text,
    email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    hourly_rate numeric DEFAULT 0
);


--
-- Name: project_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    assigned_by uuid,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    last_time_entry_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT project_assignments_status_check CHECK ((status = ANY (ARRAY['active'::text, 'removed'::text])))
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    customer_id uuid NOT NULL,
    status public.project_status DEFAULT 'active'::public.project_status NOT NULL,
    start_date date NOT NULL,
    end_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    number text NOT NULL,
    job_order_id uuid NOT NULL,
    job_order_number text NOT NULL,
    vendor_id uuid NOT NULL,
    vendor_name text NOT NULL,
    project_id uuid NOT NULL,
    project_name text NOT NULL,
    customer_id uuid NOT NULL,
    customer_name text NOT NULL,
    status public.purchase_order_status DEFAULT 'draft'::public.purchase_order_status NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    tax_rate numeric(5,2) NOT NULL,
    tax_amount numeric(10,2) NOT NULL,
    total numeric(10,2) NOT NULL,
    notes text,
    due_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    submitted_for_approval_at timestamp with time zone DEFAULT now(),
    submitted_by uuid
);


--
-- Name: time_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.time_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    project_id uuid NOT NULL,
    job_order_id uuid,
    entry_date date NOT NULL,
    hours numeric(4,2) NOT NULL,
    description text,
    billable boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'pending'::text,
    regular_hours numeric DEFAULT 0,
    overtime_hours numeric DEFAULT 0,
    invoice_id uuid,
    invoiced_at timestamp with time zone,
    CONSTRAINT time_entries_hours_check CHECK (((hours > (0)::numeric) AND (hours <= (24)::numeric))),
    CONSTRAINT time_entries_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'invoiced'::text, 'approved'::text])))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vendor_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    vendor_id uuid NOT NULL,
    document_type text NOT NULL,
    document_name text NOT NULL,
    document_url text NOT NULL,
    expiry_date date,
    uploaded_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    phone text,
    company text,
    specialty text,
    status public.vendor_status DEFAULT 'active'::public.vendor_status NOT NULL,
    rating numeric(2,1),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    insurance_expiry date,
    license_number text,
    w9_on_file boolean DEFAULT false
);


--
-- Name: badge_template_fields badge_template_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.badge_template_fields
    ADD CONSTRAINT badge_template_fields_pkey PRIMARY KEY (id);


--
-- Name: badge_templates badge_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.badge_templates
    ADD CONSTRAINT badge_templates_pkey PRIMARY KEY (id);


--
-- Name: company_settings company_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_settings
    ADD CONSTRAINT company_settings_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: emergency_contacts emergency_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_contacts
    ADD CONSTRAINT emergency_contacts_pkey PRIMARY KEY (id);


--
-- Name: estimate_line_items estimate_line_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_line_items
    ADD CONSTRAINT estimate_line_items_pkey PRIMARY KEY (id);


--
-- Name: estimates estimates_approval_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_approval_token_key UNIQUE (approval_token);


--
-- Name: estimates estimates_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_number_key UNIQUE (number);


--
-- Name: estimates estimates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_pkey PRIMARY KEY (id);


--
-- Name: invitation_activity_log invitation_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitation_activity_log
    ADD CONSTRAINT invitation_activity_log_pkey PRIMARY KEY (id);


--
-- Name: invitations invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);


--
-- Name: invitations invitations_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_token_key UNIQUE (token);


--
-- Name: invoice_line_items invoice_line_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_number_key UNIQUE (number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: job_order_line_items job_order_line_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_order_line_items
    ADD CONSTRAINT job_order_line_items_pkey PRIMARY KEY (id);


--
-- Name: job_orders job_orders_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_orders
    ADD CONSTRAINT job_orders_number_key UNIQUE (number);


--
-- Name: job_orders job_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_orders
    ADD CONSTRAINT job_orders_pkey PRIMARY KEY (id);


--
-- Name: milestones milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.milestones
    ADD CONSTRAINT milestones_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_key UNIQUE (user_id);


--
-- Name: personnel_capabilities personnel_capabilities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_capabilities
    ADD CONSTRAINT personnel_capabilities_pkey PRIMARY KEY (id);


--
-- Name: personnel_certifications personnel_certifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_certifications
    ADD CONSTRAINT personnel_certifications_pkey PRIMARY KEY (id);


--
-- Name: personnel_languages personnel_languages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_languages
    ADD CONSTRAINT personnel_languages_pkey PRIMARY KEY (id);


--
-- Name: personnel personnel_personnel_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel
    ADD CONSTRAINT personnel_personnel_number_key UNIQUE (personnel_number);


--
-- Name: personnel personnel_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel
    ADD CONSTRAINT personnel_pkey PRIMARY KEY (id);


--
-- Name: po_line_items po_line_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.po_line_items
    ADD CONSTRAINT po_line_items_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: project_assignments project_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assignments
    ADD CONSTRAINT project_assignments_pkey PRIMARY KEY (id);


--
-- Name: project_assignments project_assignments_project_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assignments
    ADD CONSTRAINT project_assignments_project_id_user_id_key UNIQUE (project_id, user_id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_number_key UNIQUE (number);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: time_entries time_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_pkey PRIMARY KEY (id);


--
-- Name: time_entries time_entries_user_id_project_id_entry_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_user_id_project_id_entry_date_key UNIQUE (user_id, project_id, entry_date);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: vendor_documents vendor_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_documents
    ADD CONSTRAINT vendor_documents_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: company_settings_singleton; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX company_settings_singleton ON public.company_settings USING btree ((true));


--
-- Name: idx_estimates_approval_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_estimates_approval_token ON public.estimates USING btree (approval_token);


--
-- Name: idx_invitation_activity_log_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invitation_activity_log_created_at ON public.invitation_activity_log USING btree (created_at DESC);


--
-- Name: idx_invitation_activity_log_invitation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invitation_activity_log_invitation_id ON public.invitation_activity_log USING btree (invitation_id);


--
-- Name: idx_invitations_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invitations_email ON public.invitations USING btree (email);


--
-- Name: idx_invitations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invitations_status ON public.invitations USING btree (status);


--
-- Name: idx_invitations_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invitations_token ON public.invitations USING btree (token);


--
-- Name: idx_milestones_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_milestones_due_date ON public.milestones USING btree (due_date);


--
-- Name: idx_milestones_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_milestones_project_id ON public.milestones USING btree (project_id);


--
-- Name: idx_milestones_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_milestones_status ON public.milestones USING btree (status);


--
-- Name: idx_project_assignments_last_entry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_assignments_last_entry ON public.project_assignments USING btree (last_time_entry_at) WHERE (status = 'active'::text);


--
-- Name: idx_project_assignments_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_assignments_user_status ON public.project_assignments USING btree (user_id, status);


--
-- Name: profiles on_profile_created_assign_role; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_profile_created_assign_role AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.assign_user_role();


--
-- Name: estimates set_estimate_number_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_estimate_number_trigger BEFORE INSERT ON public.estimates FOR EACH ROW EXECUTE FUNCTION public.set_estimate_number();


--
-- Name: invoices set_invoice_number_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_invoice_number_trigger BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_invoice_number();


--
-- Name: job_orders set_job_order_number_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_job_order_number_trigger BEFORE INSERT ON public.job_orders FOR EACH ROW EXECUTE FUNCTION public.set_job_order_number();


--
-- Name: purchase_orders set_purchase_order_number_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_purchase_order_number_trigger BEFORE INSERT ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.set_purchase_order_number();


--
-- Name: personnel trigger_set_personnel_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_set_personnel_number BEFORE INSERT ON public.personnel FOR EACH ROW EXECUTE FUNCTION public.set_personnel_number();


--
-- Name: time_entries update_assignment_on_time_entry; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_assignment_on_time_entry AFTER INSERT ON public.time_entries FOR EACH ROW EXECUTE FUNCTION public.update_project_assignment_activity();


--
-- Name: badge_templates update_badge_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_badge_templates_updated_at BEFORE UPDATE ON public.badge_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: personnel_certifications update_certifications_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_certifications_updated_at BEFORE UPDATE ON public.personnel_certifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: company_settings update_company_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_company_settings_updated_at BEFORE UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: customers update_customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: emergency_contacts update_emergency_contacts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_emergency_contacts_updated_at BEFORE UPDATE ON public.emergency_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: estimates update_estimates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_estimates_updated_at BEFORE UPDATE ON public.estimates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: invoices update_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: job_orders update_job_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_job_orders_updated_at BEFORE UPDATE ON public.job_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: milestones update_milestones_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_milestones_updated_at BEFORE UPDATE ON public.milestones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notification_preferences update_notification_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: personnel update_personnel_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_personnel_updated_at BEFORE UPDATE ON public.personnel FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: project_assignments update_project_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_project_assignments_updated_at BEFORE UPDATE ON public.project_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: projects update_projects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: purchase_orders update_purchase_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: time_entries update_time_entries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON public.time_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: vendors update_vendors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: badge_template_fields badge_template_fields_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.badge_template_fields
    ADD CONSTRAINT badge_template_fields_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.badge_templates(id) ON DELETE CASCADE;


--
-- Name: emergency_contacts emergency_contacts_personnel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_contacts
    ADD CONSTRAINT emergency_contacts_personnel_id_fkey FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;


--
-- Name: estimate_line_items estimate_line_items_estimate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_line_items
    ADD CONSTRAINT estimate_line_items_estimate_id_fkey FOREIGN KEY (estimate_id) REFERENCES public.estimates(id) ON DELETE CASCADE;


--
-- Name: estimate_line_items estimate_line_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_line_items
    ADD CONSTRAINT estimate_line_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: estimates estimates_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: estimates estimates_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: estimates estimates_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: invitation_activity_log invitation_activity_log_invitation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitation_activity_log
    ADD CONSTRAINT invitation_activity_log_invitation_id_fkey FOREIGN KEY (invitation_id) REFERENCES public.invitations(id) ON DELETE CASCADE;


--
-- Name: invitation_activity_log invitation_activity_log_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitation_activity_log
    ADD CONSTRAINT invitation_activity_log_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: invitations invitations_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: invoice_line_items invoice_line_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_estimate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_estimate_id_fkey FOREIGN KEY (estimate_id) REFERENCES public.estimates(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_job_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_job_order_id_fkey FOREIGN KEY (job_order_id) REFERENCES public.job_orders(id) ON DELETE SET NULL;


--
-- Name: job_order_line_items job_order_line_items_job_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_order_line_items
    ADD CONSTRAINT job_order_line_items_job_order_id_fkey FOREIGN KEY (job_order_id) REFERENCES public.job_orders(id) ON DELETE CASCADE;


--
-- Name: job_orders job_orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_orders
    ADD CONSTRAINT job_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: job_orders job_orders_estimate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_orders
    ADD CONSTRAINT job_orders_estimate_id_fkey FOREIGN KEY (estimate_id) REFERENCES public.estimates(id) ON DELETE SET NULL;


--
-- Name: job_orders job_orders_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_orders
    ADD CONSTRAINT job_orders_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: milestones milestones_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.milestones
    ADD CONSTRAINT milestones_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: notification_preferences notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: personnel_capabilities personnel_capabilities_personnel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_capabilities
    ADD CONSTRAINT personnel_capabilities_personnel_id_fkey FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;


--
-- Name: personnel_certifications personnel_certifications_personnel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_certifications
    ADD CONSTRAINT personnel_certifications_personnel_id_fkey FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;


--
-- Name: personnel_languages personnel_languages_personnel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personnel_languages
    ADD CONSTRAINT personnel_languages_personnel_id_fkey FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;


--
-- Name: po_line_items po_line_items_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.po_line_items
    ADD CONSTRAINT po_line_items_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: project_assignments project_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assignments
    ADD CONSTRAINT project_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id);


--
-- Name: project_assignments project_assignments_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assignments
    ADD CONSTRAINT project_assignments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_assignments project_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assignments
    ADD CONSTRAINT project_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: project_assignments project_assignments_user_id_profiles_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_assignments
    ADD CONSTRAINT project_assignments_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: projects projects_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.profiles(id);


--
-- Name: purchase_orders purchase_orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_job_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_job_order_id_fkey FOREIGN KEY (job_order_id) REFERENCES public.job_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.profiles(id);


--
-- Name: purchase_orders purchase_orders_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;


--
-- Name: time_entries time_entries_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;


--
-- Name: time_entries time_entries_job_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_job_order_id_fkey FOREIGN KEY (job_order_id) REFERENCES public.job_orders(id) ON DELETE SET NULL;


--
-- Name: time_entries time_entries_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: time_entries time_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: time_entries time_entries_user_id_profiles_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: vendor_documents vendor_documents_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_documents
    ADD CONSTRAINT vendor_documents_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;


--
-- Name: project_assignments Admins and managers can manage assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can manage assignments" ON public.project_assignments USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: badge_template_fields Admins and managers can manage badge fields; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can manage badge fields" ON public.badge_template_fields USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: badge_templates Admins and managers can manage badge templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can manage badge templates" ON public.badge_templates USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: personnel_capabilities Admins and managers can manage capabilities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can manage capabilities" ON public.personnel_capabilities USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: personnel_certifications Admins and managers can manage certifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can manage certifications" ON public.personnel_certifications USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: customers Admins and managers can manage customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can manage customers" ON public.customers USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: emergency_contacts Admins and managers can manage emergency contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can manage emergency contacts" ON public.emergency_contacts USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: estimate_line_items Admins and managers can manage estimate line items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can manage estimate line items" ON public.estimate_line_items USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: estimates Admins and managers can manage estimates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can manage estimates" ON public.estimates USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: invoice_line_items Admins and managers can manage invoice line items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can manage invoice line items" ON public.invoice_line_items USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: invoices Admins and managers can manage invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can manage invoices" ON public.invoices USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: job_order_line_items Admins and managers can manage job order line items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can manage job order line items" ON public.job_order_line_items USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: job_orders Admins and managers can manage job orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can manage job orders" ON public.job_orders USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: personnel_languages Admins and managers can manage languages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can manage languages" ON public.personnel_languages USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: milestones Admins and managers can manage milestones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can manage milestones" ON public.milestones USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: personnel Admins and managers can manage personnel; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can manage personnel" ON public.personnel USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: po_line_items Admins and managers can manage po line items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can manage po line items" ON public.po_line_items USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: products Admins and managers can manage products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can manage products" ON public.products USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: projects Admins and managers can manage projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can manage projects" ON public.projects USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: purchase_orders Admins and managers can manage purchase orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can manage purchase orders" ON public.purchase_orders USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: vendor_documents Admins and managers can manage vendor documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can manage vendor documents" ON public.vendor_documents USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: vendors Admins and managers can manage vendors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can manage vendors" ON public.vendors USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: project_assignments Admins and managers can view all assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and managers can view all assignments" ON public.project_assignments FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: user_roles Admins can manage all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all roles" ON public.user_roles USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: invitations Admins can manage invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage invitations" ON public.invitations USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: company_settings Admins can update company settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update company settings" ON public.company_settings FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: invitation_activity_log Admins can view all activity logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all activity logs" ON public.invitation_activity_log FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: time_entries Admins can view all time entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all time entries" ON public.time_entries FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


--
-- Name: company_settings Anyone can view company settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view company settings" ON public.company_settings FOR SELECT USING (true);


--
-- Name: badge_template_fields Authenticated users can view badge fields; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view badge fields" ON public.badge_template_fields FOR SELECT USING (true);


--
-- Name: badge_templates Authenticated users can view badge templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view badge templates" ON public.badge_templates FOR SELECT USING (true);


--
-- Name: personnel_capabilities Authenticated users can view capabilities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view capabilities" ON public.personnel_capabilities FOR SELECT USING (true);


--
-- Name: personnel_certifications Authenticated users can view certifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view certifications" ON public.personnel_certifications FOR SELECT USING (true);


--
-- Name: customers Authenticated users can view customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view customers" ON public.customers FOR SELECT TO authenticated USING (true);


--
-- Name: emergency_contacts Authenticated users can view emergency contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view emergency contacts" ON public.emergency_contacts FOR SELECT USING (true);


--
-- Name: estimate_line_items Authenticated users can view estimate line items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view estimate line items" ON public.estimate_line_items FOR SELECT TO authenticated USING (true);


--
-- Name: estimates Authenticated users can view estimates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view estimates" ON public.estimates FOR SELECT TO authenticated USING (true);


--
-- Name: invoice_line_items Authenticated users can view invoice line items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view invoice line items" ON public.invoice_line_items FOR SELECT TO authenticated USING (true);


--
-- Name: invoices Authenticated users can view invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view invoices" ON public.invoices FOR SELECT TO authenticated USING (true);


--
-- Name: job_order_line_items Authenticated users can view job order line items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view job order line items" ON public.job_order_line_items FOR SELECT TO authenticated USING (true);


--
-- Name: job_orders Authenticated users can view job orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view job orders" ON public.job_orders FOR SELECT TO authenticated USING (true);


--
-- Name: personnel_languages Authenticated users can view languages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view languages" ON public.personnel_languages FOR SELECT USING (true);


--
-- Name: milestones Authenticated users can view milestones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view milestones" ON public.milestones FOR SELECT USING (true);


--
-- Name: personnel Authenticated users can view personnel; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view personnel" ON public.personnel FOR SELECT USING (true);


--
-- Name: po_line_items Authenticated users can view po line items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view po line items" ON public.po_line_items FOR SELECT TO authenticated USING (true);


--
-- Name: products Authenticated users can view products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view products" ON public.products FOR SELECT TO authenticated USING (true);


--
-- Name: projects Authenticated users can view projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view projects" ON public.projects FOR SELECT TO authenticated USING (true);


--
-- Name: purchase_orders Authenticated users can view purchase orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view purchase orders" ON public.purchase_orders FOR SELECT TO authenticated USING (true);


--
-- Name: vendor_documents Authenticated users can view vendor documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view vendor documents" ON public.vendor_documents FOR SELECT USING (true);


--
-- Name: vendors Authenticated users can view vendors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view vendors" ON public.vendors FOR SELECT TO authenticated USING (true);


--
-- Name: time_entries Users can create their own time entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own time entries" ON public.time_entries FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: time_entries Users can delete their own time entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own time entries" ON public.time_entries FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: notification_preferences Users can insert their own notification preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own notification preferences" ON public.notification_preferences FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: notification_preferences Users can update their own notification preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own notification preferences" ON public.notification_preferences FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: time_entries Users can update their own time entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own time entries" ON public.time_entries FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: project_assignments Users can view their own assignments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own assignments" ON public.project_assignments FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: notification_preferences Users can view their own notification preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own notification preferences" ON public.notification_preferences FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: time_entries Users can view their own time entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own time entries" ON public.time_entries FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: badge_template_fields; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.badge_template_fields ENABLE ROW LEVEL SECURITY;

--
-- Name: badge_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.badge_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: company_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: emergency_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: estimate_line_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.estimate_line_items ENABLE ROW LEVEL SECURITY;

--
-- Name: estimates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

--
-- Name: invitation_activity_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invitation_activity_log ENABLE ROW LEVEL SECURITY;

--
-- Name: invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_line_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: job_order_line_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_order_line_items ENABLE ROW LEVEL SECURITY;

--
-- Name: job_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: milestones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: personnel; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.personnel ENABLE ROW LEVEL SECURITY;

--
-- Name: personnel_capabilities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.personnel_capabilities ENABLE ROW LEVEL SECURITY;

--
-- Name: personnel_certifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.personnel_certifications ENABLE ROW LEVEL SECURITY;

--
-- Name: personnel_languages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.personnel_languages ENABLE ROW LEVEL SECURITY;

--
-- Name: po_line_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.po_line_items ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: project_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: time_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: vendor_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vendor_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: vendors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


