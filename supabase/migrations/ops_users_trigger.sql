-- ============================================================
-- Trigger: auto-insert a row in public.ops_users when a new
-- user is created in auth.users via Supabase Auth.
-- Role defaults to NULL and must be set manually by an admin
-- in the Supabase dashboard.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_ops_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ops_users (auth_id, role, assigned_zone)
  VALUES (NEW.id, NULL, NULL)
  ON CONFLICT (auth_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop trigger first to allow re-running this script idempotently
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_ops_user();
