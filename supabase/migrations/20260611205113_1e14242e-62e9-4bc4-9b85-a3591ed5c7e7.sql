
CREATE POLICY "Anyone can upload comprovantes"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'comprovantes');

CREATE POLICY "Admins read comprovantes"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'comprovantes' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete comprovantes"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'comprovantes' AND public.has_role(auth.uid(), 'admin'));
