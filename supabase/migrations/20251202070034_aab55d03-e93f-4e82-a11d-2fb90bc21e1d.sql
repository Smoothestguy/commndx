-- Create the missing trigger that auto-creates profiles for new users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update accept_invitation function to ensure profile exists before assigning role
CREATE OR REPLACE FUNCTION public.accept_invitation(
  _invitation_id uuid,
  _user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invitation RECORD;
  _user_email text;
  _user_meta jsonb;
BEGIN
  -- Get the invitation and validate it
  SELECT * INTO _invitation
  FROM public.invitations
  WHERE id = _invitation_id
    AND status = 'pending'
    AND expires_at > now();
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;
  
  -- Get user email and metadata from auth.users
  SELECT email, raw_user_meta_data INTO _user_email, _user_meta
  FROM auth.users
  WHERE id = _user_id;
  
  IF _user_email IS NULL OR _user_email != _invitation.email THEN
    RAISE EXCEPTION 'User email does not match invitation';
  END IF;
  
  -- Ensure profile exists (create if missing for existing users without profiles)
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    _user_id,
    _user_email,
    COALESCE(_user_meta->>'first_name', ''),
    COALESCE(_user_meta->>'last_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Delete existing role for this user (if any)
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  
  -- Insert the new role from the invitation
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _invitation.role);
  
  -- Mark invitation as accepted
  UPDATE public.invitations
  SET status = 'accepted', used_at = now()
  WHERE id = _invitation_id;
  
  RETURN json_build_object(
    'success', true,
    'role', _invitation.role
  );
END;
$$;