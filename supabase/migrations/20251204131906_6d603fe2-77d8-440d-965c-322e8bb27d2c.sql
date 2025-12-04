-- Create personnel_registration_invites table
CREATE TABLE public.personnel_registration_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  first_name text,
  last_name text,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.personnel_registration_invites ENABLE ROW LEVEL SECURITY;

-- Admins and managers can manage invites
CREATE POLICY "Admins and managers can manage invites"
  ON public.personnel_registration_invites FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Anyone can view invites by token (for registration page)
CREATE POLICY "Anyone can view invites by token"
  ON public.personnel_registration_invites FOR SELECT
  USING (true);

-- Anyone can update invite status (for completing registration)
CREATE POLICY "Anyone can complete invites"
  ON public.personnel_registration_invites FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_personnel_registration_invites_updated_at
  BEFORE UPDATE ON public.personnel_registration_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create personnel-photos storage bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('personnel-photos', 'personnel-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy for personnel photos - anyone can upload
CREATE POLICY "Anyone can upload personnel photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'personnel-photos');

-- Storage policy for personnel photos - public read
CREATE POLICY "Personnel photos are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'personnel-photos');