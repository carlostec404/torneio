
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
-- authenticated keeps EXECUTE so RLS policies that reference has_role work.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
