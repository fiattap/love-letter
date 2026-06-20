import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";

import { createRouteHandlerSupabaseAuthClient } from "@/lib/supabaseAuthServer";
import { supabaseServer } from "@/lib/supabaseServer";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripePriceId = process.env.STRIPE_PRICE_ID;

if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY is not configured.");
}

if (!stripePriceId) {
  throw new Error("STRIPE_PRICE_ID is not configured.");
}

const stripe = new Stripe(stripeSecretKey);

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true }, { status: 200 });
  const supabase = createRouteHandlerSupabaseAuthClient(request, response);
  const authorizationHeader = request.headers.get("authorization") ?? "";
  const bearerToken = authorizationHeader.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length).trim()
    : "";

  const {
    data: { user: bearerUser },
    error: bearerAuthError,
  } = bearerToken ? await supabase.auth.getUser(bearerToken) : await supabase.auth.getUser();

  let user = bearerUser;
  let authError = bearerAuthError;

  if (!user && !bearerToken) {
    const fallbackResult = await supabase.auth.getUser();
    user = fallbackResult.data.user;
    authError = fallbackResult.error;
  }

  console.log("[stripe checkout] server user", user?.email);
  console.log("[stripe checkout] auth error", authError);

  const userEmail = user?.email?.trim().toLowerCase() ?? "";
  if (!userEmail) {
    return NextResponse.json({ error: "Not authenticated on server" }, { status: 401 });
  }

  const { data: member } = await supabaseServer
    .from("members")
    .select("id")
    .ilike("email", userEmail)
    .maybeSingle();

  const { data: couple } = await supabaseServer
    .from("couples")
    .select("id, subscription_status")
    .or(`partner_one_email.ilike.${userEmail},partner_two_email.ilike.${userEmail}`)
    .limit(1)
    .maybeSingle();

  // Billing is per couple — if either partner already upgraded, don't let the
  // other one pay again.
  if (couple?.subscription_status === "premium") {
    return NextResponse.json(
      {
        error:
          "Your couple already has the printed letter subscription — you're all set. Refresh to see it.",
      },
      { status: 409 }
    );
  }

  const metadata = {
    user_email: userEmail,
    member_id: member?.id ? String(member.id) : "",
    couple_id: couple?.id ? String(couple.id) : "",
  };

  const origin = request.nextUrl.origin;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: stripePriceId, quantity: 1 }],
    customer_email: userEmail,
    // Collect a mailing address so we can ship the printed letters.
    shipping_address_collection: {
      allowed_countries: ["US", "CA"],
    },
    // Show the billing/cancellation policy at the payment step.
    custom_text: {
      submit: {
        message:
          "Subscription auto-renews monthly on your billing date. Cancel anytime — you keep access through the paid month. No refunds. By subscribing you agree to our Terms at theloveletter.co/terms.",
      },
    },
    success_url: `${origin}/dashboard?upgrade=success`,
    cancel_url: `${origin}/dashboard?upgrade=cancelled`,
    metadata,
    subscription_data: {
      metadata,
    },
  });

  return NextResponse.json({ url: session.url }, { status: 200 });
}
