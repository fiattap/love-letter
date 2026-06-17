# Love Letter — Pre-Launch Checklist

Everything below is **configuration, not code** — the app itself is built. Work top to bottom; the three "must do" sections are what gate taking real payments.

---

## 1. Stripe → go live (MUST DO before real cards)

- [ ] Switch Stripe dashboard to **Live mode** (top-right toggle).
- [ ] Create the **live** product/price ($9.99/mo per couple). Copy the **live Price ID**.
- [ ] In **Vercel → Environment Variables (Production)** set the live values:
  - [ ] `STRIPE_SECRET_KEY` = `sk_live_…`
  - [ ] `STRIPE_PRICE_ID` = live price id
  - [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (if used) = `pk_live_…`
- [ ] **Register the production webhook**: Stripe → Developers → Webhooks → Add endpoint
  - URL: `https://www.theloveletter.co/api/stripe/webhook`
  - Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
  - [ ] Copy the **Signing secret** → Vercel `STRIPE_WEBHOOK_SECRET` (live value)
- [ ] **Activate the Customer Portal** (for cancel/manage): Stripe → Settings → Billing → Customer portal → activate in **Live** mode.
  - [ ] Allow cancellation, set to **"at end of billing period"** (matches the "cancel before the 5th, no refunds" terms).
  - [ ] Allow payment-method + shipping-address updates.
- [ ] **Redeploy** after changing env vars (they only apply to new builds).

> ⚠️ `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, and `STRIPE_WEBHOOK_SECRET` must **all be live** (or all test). Mixing silently breaks the webhook.

---

## 2. Supabase → reliable signup emails (MUST DO)

The built-in auth mailer is low-cap and poor deliverability — it drops the second partner's magic link under any real traffic.

- [ ] Supabase → **Project Settings → Authentication → SMTP Settings → Enable custom SMTP**:
  - Host: `smtp.resend.com`
  - Port: `465`
  - Username: `resend`
  - Password: your **Resend API key**
  - Sender: `hello@theloveletter.co` · Name: `Love Letter`
- [ ] Supabase → Authentication → **Rate Limits** → raise emails/hour.
- [ ] Test a fresh signup → confirm **both** partners get the magic link.

---

## 3. Auth redirect config (verify — already mostly set)

- [ ] Supabase → Authentication → URL Configuration:
  - Site URL = `https://www.theloveletter.co`
  - Redirect URLs include `https://www.theloveletter.co/auth/callback` and `https://www.theloveletter.co/**`
- [ ] Vercel env: `NEXT_PUBLIC_APP_URL` and `APP_BASE_URL` = `https://www.theloveletter.co`
- [ ] Cloudflare DNS: apex `A @ → 76.76.21.21` + `CNAME www → cname.vercel-dns.com` (both **DNS only / grey cloud**) — done.

---

## 4. Database migrations (confirm run in Supabase prod)

Run any not yet applied (all are `if not exists`, safe to re-run):

- [ ] `add_couple_subscription` — subscription columns on `couples`
- [ ] `add_shipments_and_addresses` — `shipments` table + address fields
- [ ] `seed_cycle_prompts` — prompts seeded through 2027 (✅ done)
- [ ] `add_lookup_indexes` — search indexes

---

## 5. Other env vars (Vercel Production)

- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `RESEND_API_KEY`
- [ ] `ADMIN_SECRET` (the admin password), `SEND_PROMPT_ADMIN_KEY`, `CRON_SECRET`
- [ ] `CRON_SUMMARY_EMAIL` = `hello@theloveletter.co`

---

## 6. Final smoke test on the live site

- [ ] Sign up a real couple → both get magic links → both can log in.
- [ ] Pay with a **real card** (small live charge) → both partners see "You're all set."
- [ ] Second partner clicking "Get printed letters" gets the "already subscribed" message (no double charge).
- [ ] **Manage Subscription** opens the Stripe portal; test cancel → couple reverts to free.
- [ ] Admin (`/admin`, log in with `ADMIN_SECRET`): pipeline + Printed Letters panel load; mark-shipped works.
- [ ] Resend dashboard verifies `theloveletter.co` is a **verified sending domain**.

---

## 7. Nice-to-have (post-launch OK)

- [ ] "First shipment → Next shipment" true tracking (needs subscribe date).
- [ ] Login-based admin gate (instead of shared password).
- [ ] Purge any test data (test couples/letters/members) before going public.
- [ ] Image compression for the hero/stationery photos.

---

**Status:** Code complete — magic-link auth, per-couple billing (no double-pay), prompt/reminder/reveal to both partners, premium fulfillment (addresses + shipments + admin panel), and cancel/manage flow are all built. What's left is the config above.
