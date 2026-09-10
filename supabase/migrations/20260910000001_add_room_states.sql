CREATE TABLE IF NOT EXISTS public.room_states (
  room_code VARCHAR(10) PRIMARY KEY,
  state JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.room_states;

GRANT ALL ON TABLE public.room_states TO anon, authenticated, service_role;

ALTER TABLE public.room_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public all access to room_states" ON public.room_states;
CREATE POLICY "Allow public all access to room_states" ON public.room_states FOR ALL USING (true) WITH CHECK (true);
