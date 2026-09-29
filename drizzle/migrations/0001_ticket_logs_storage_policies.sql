CREATE POLICY "Authenticated can read ticket logs" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'ticket-logs');

CREATE POLICY "Authenticated can upload ticket logs" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ticket-logs');