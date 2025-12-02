-- Create a secure function to accept invitations
-- This bypasses RLS since users need to update their own roles
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
BEGIN
  -- Get the invitation and validate it
  SELECT * INTO _invitation
  FROM public.invitations
  WHERE id = _invitation_id
    AND status = 'pending'
    AND expires_at > now();
  
  -- Check if invitation exists and is valid
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;
  
  -- Get user email from profiles
  SELECT email INTO _user_email
  FROM public.profiles
  WHERE id = _user_id;
  
  -- Verify the user's email matches the invitation
  IF _user_email IS NULL OR _user_email != _invitation.email THEN
    RAISE EXCEPTION 'User email does not match invitation';
  END IF;
  
  -- Delete existing role for this user (if any)
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  
  -- Insert the new role from the invitation
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _invitation.role);
  
  -- Mark invitation as accepted
  UPDATE public.invitations
  SET status = 'accepted', used_at = now()
  WHERE id = _invitation_id;
  
  -- Return success with role info
  RETURN json_build_object(
    'success', true,
    'role', _invitation.role
  );
END;
$$;