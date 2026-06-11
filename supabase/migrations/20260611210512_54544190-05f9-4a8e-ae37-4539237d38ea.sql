ALTER TABLE public.athletes ALTER COLUMN whatsapp DROP NOT NULL;
ALTER TABLE public.athletes ALTER COLUMN rg DROP NOT NULL;
ALTER TABLE public.athletes ALTER COLUMN birth_date DROP NOT NULL;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS captain_whatsapp text;