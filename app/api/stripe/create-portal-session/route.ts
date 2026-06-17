import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";

import { createRouteHandlerSupabaseAuthClient } from "@/lib/supabaseAuthServer";
import { supabaseServer } from "@/lib/supabaseServer";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY is not configured.");
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
  } = bearerToken ? await supabase.auth.getUser(bearerToken) : await supabase.auth.getUser();

  let user = bearerUser;
  if (!user && !bearerToken) {
    const fallbackResult = await supabase.auth.getUser();
    user = fallbackResult.data.user;
  }

  const userEmail = user?.email?.trim().toLowerCase() ?? "";
  if (!userEmail) {
    return NextResponse.json({ error: "Not authenticated on server" }, { status: 401 });
  }

  // The Stripe customer lives on the couple (billing is per couple), so either
  // partner can open the portal to manage or cancel.
  const { data: couple } = await supabaseServer
    .from("couples")
    .select("stripe_customer_id")
    .or(`partner_one_email.ilike.${userEmail},partner_two_email.ilike.${userEmail}`)
    .limit(1)
    .maybeSingle();

  const customerId = couple?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json(
      { error: "No active subscription found to manage." },
      { status: 400 }
    );
  }

  const origin = request.nextUrl.origin;
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/dashboard`,
  });

  return NextResponse.json({ url: portalSession.url }, { status: 200 });
}
