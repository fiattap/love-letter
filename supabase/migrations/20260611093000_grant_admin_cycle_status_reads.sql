-- Ensure service_role can read admin cycle status tables even if grants were restricted.
GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT ON TABLE public.couples TO service_role;
GRANT SELECT ON TABLE public.letters TO service_role;
GRANT SELECT ON TABLE public.email_events TO service_role;
GRANT SELECT ON TABLE public.members TO service_role;
GRANT SELECT ON TABLE public.prompts TO service_role;
