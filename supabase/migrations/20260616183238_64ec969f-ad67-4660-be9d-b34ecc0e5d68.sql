
ALTER TABLE public.athletes DROP COLUMN IF EXISTS rg;
ALTER TABLE public.athletes DROP COLUMN IF EXISTS whatsapp;
ALTER TABLE public.athletes DROP COLUMN IF EXISTS birth_date;

DROP POLICY IF EXISTS "Anyone can insert athletes" ON public.athletes;
DROP POLICY IF EXISTS "Anyone can insert teams" ON public.teams;
REVOKE INSERT ON public.athletes FROM anon, authenticated;
REVOKE INSERT ON public.teams FROM anon, authenticated;

DROP POLICY IF EXISTS "Anyone can read settings" ON public.app_settings;
REVOKE SELECT ON public.app_settings FROM anon;
CREATE POLICY "Admins read settings"
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can upload comprovantes" ON storage.objects;
CREATE POLICY "Public can upload comprovante files"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'comprovantes'
    AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','heic','pdf')
    AND char_length(name) BETWEEN 5 AND 200
  );
