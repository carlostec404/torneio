ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS team_a_score integer,
  ADD COLUMN IF NOT EXISTS team_b_score integer;