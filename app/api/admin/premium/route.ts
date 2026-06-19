import { NextResponse } from "next/server";
import Stripe from "stripe";

import { ensureManualRouteGuard } from "@/lib/cycleEmail";
import { supabaseServer } from "@/lib/supabaseServer";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY is not configured.");
}

const stripe = new Stripe(stripeSecretKey);

type CoupleRow = {
  id: string;
  partner_one_email: string | null;
  partner_two_email: string | null;
  shipping_name: string | null;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
};

type MemberRow = { email: string | null; name: string | null };

export async function GET(request: Request) {
  const guardError = ensureManualRouteGuard(request);
  if (guardError) {
    return NextResponse.json({ error: guardError }, { status: 403 });
  }

  const { data: couplesData, error: couplesError } = await supabaseServer
    .from("couples")
    .select(
      "id, partner_one_email, partner_two_email, shipping_name, subscription_status, stripe_subscription_id"
    );

  if (couplesError) {
    return NextResponse.json({ error: "Could not load couples." }, { status: 500 });
  }

  const couples = (couplesData ?? []) as CoupleRow[];

  const { data: membersData } = await supabaseServer.from("members").select("email, name");
  const nameByEmail = new Map<string, string>();
  for (const member of (membersData ?? []) as MemberRow[]) {
    if (member.email) {
      nameByEmail.set(member.email.toLowerCase(), member.name ?? "");
    }
  }

  // Live subscription status/dates from Stripe, keyed by subscription id.
  const subsById = new Map<string, Stripe.Subscription>();
  try {
    const list = await stripe.subscriptions.list({ status: "all", limit: 100 });
    for (const sub of list.data) {
      subsById.set(sub.id, sub);
    }
  } catch {
    // Fall back to DB-only status if Stripe is unreachable.
  }

  const subscribers = couples
    .filter(
      (couple) =>
        couple.stripe_subscription_id ||
        couple.subscription_status === "premium" ||
        couple.subscription_status === "canceled"
    )
    .map((couple) => {
      const sub = couple.stripe_subscription_id
        ? subsById.get(couple.stripe_subscription_id)
        : undefined;

      // current_period_end lives in different spots across Stripe API versions.
      const subShape = sub as unknown as {
        current_period_end?: number;
        items?: { data?: Array<{ current_period_end?: number }> };
      } | undefined;
      const currentPeriodEndUnix =
        subShape?.current_period_end ??
        subShape?.items?.data?.[0]?.current_period_end ??
        null;

      const oneEmail = couple.partner_one_email?.toLowerCase() ?? "";
      const twoEmail = couple.partner_two_email?.toLowerCase() ?? "";

      const status =
        sub?.status ??
        (couple.subscription_status === "premium" ? "active" : couple.subscription_status ?? "unknown");

      return {
        coupleId: couple.id,
        partnerOneEmail: couple.partner_one_email,
        partnerOneName: nameByEmail.get(oneEmail) || couple.shipping_name || null,
        partnerTwoEmail: couple.partner_two_email,
        partnerTwoName: nameByEmail.get(twoEmail) || null,
        status,
        cancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
        createdUnix: sub?.created ?? null,
        currentPeriodEndUnix,
      };
    });

  const activeCount = subscribers.filter(
    (item) => item.status === "active" || item.status === "trialing"
  ).length;

  return NextResponse.json({ activeCount, subscribers });
}
