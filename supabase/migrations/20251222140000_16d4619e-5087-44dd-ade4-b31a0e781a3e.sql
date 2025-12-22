-- Remove the trigger that auto-assigns roles on profile creation
DROP TRIGGER IF EXISTS on_profile_created_assign_role ON public.profiles;

-- Now drop the function that auto-assigns roles
DROP FUNCTION IF EXISTS public.assign_user_role();