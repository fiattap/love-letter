-- Allow service_role API handlers to persist reveal email event tracking.
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT ON TABLE public.email_events TO service_role;
