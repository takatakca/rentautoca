CREATE TABLE public.concierge_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.concierge_threads TO authenticated;
GRANT ALL ON public.concierge_threads TO service_role;
ALTER TABLE public.concierge_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own threads select" ON public.concierge_threads FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own threads insert" ON public.concierge_threads FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own threads update" ON public.concierge_threads FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own threads delete" ON public.concierge_threads FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER set_concierge_threads_updated_at BEFORE UPDATE ON public.concierge_threads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.concierge_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.concierge_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  client_message_id text,
  message jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_concierge_messages_thread ON public.concierge_messages (thread_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.concierge_messages TO authenticated;
GRANT ALL ON public.concierge_messages TO service_role;
ALTER TABLE public.concierge_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages select" ON public.concierge_messages FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own messages insert" ON public.concierge_messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.concierge_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()));
CREATE POLICY "own messages delete" ON public.concierge_messages FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.travel_itineraries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  origin text,
  arrival_at timestamptz,
  departure_at timestamptz,
  passengers integer NOT NULL DEFAULT 1,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.travel_itineraries TO authenticated;
GRANT ALL ON public.travel_itineraries TO service_role;
ALTER TABLE public.travel_itineraries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own itineraries select" ON public.travel_itineraries FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own itineraries insert" ON public.travel_itineraries FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own itineraries update" ON public.travel_itineraries FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own itineraries delete" ON public.travel_itineraries FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER set_travel_itineraries_updated_at BEFORE UPDATE ON public.travel_itineraries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();