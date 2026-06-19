-- The Stripe webhook (service role) must be able to write subscription + shipping
-- fields on couples, and shipment rows. Without these grants the service role can
-- read but not UPDATE couples, so premium status silently fails to save.

grant select, insert, update, delete on public.couples to service_role;
grant select, insert, update, delete on public.shipments to service_role;
