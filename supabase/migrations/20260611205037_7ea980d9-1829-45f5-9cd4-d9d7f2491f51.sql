
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS comprovante_url text,
  ADD COLUMN IF NOT EXISTS seed integer;

CREATE TABLE IF NOT EXISTS public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round integer NOT NULL,
  position integer NOT NULL,
  team_a_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  team_b_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  winner_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round, position)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage matches"
  ON public.matches FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read matches"
  ON public.matches FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins to insert user_roles (for adding more admins from admin area)
CREATE POLICY "Admins manage user_roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
