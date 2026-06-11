CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings" ON public.app_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins manage settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.app_settings (key, value) VALUES
  ('pix_key', '11092675418'),
  ('pix_amount', '150'),
  ('pix_merchant_name', 'TORNEIO FUTEBOL'),
  ('pix_merchant_city', 'SAO PAULO')
ON CONFLICT (key) DO NOTHING;