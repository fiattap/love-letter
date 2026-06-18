import { NextResponse } from "next/server";
import Stripe from "stripe";

import { supabaseServer } from "@/lib/supabaseServer";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY is not configured.");
}

if (!stripeWebhookSecret) {
  throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
}

const stripe = new Stripe(stripeSecretKey);

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

// The subscription is billed per couple, so the couple row is the source of
// truth both partners read from. Update by couple_id when we have it (most
// reliable), otherwise match either partner's email.
async function updateCoupleSubscription(params: {
  coupleId: string | null;
  email: string | null;
  status: "premium" | "canceled";
  customerId: string | null;
  subscriptionId: string | null;
  shippingName?: string | null;
  shippingAddress?: unknown;
}) {
  const update: Record<string, unknown> = {
    subscription_status: params.status,
    stripe_customer_id: params.customerId,
    stripe_subscription_id: params.subscriptionId,
  };

  if (params.shippingName !== undefined) {
    update.shipping_name = params.shippingName;
  }
  if (params.shippingAddress !== undefined) {
    update.shipping_address = params.shippingAddress;
  }

  // Match by email (the stable identifier — couples are keyed by partner
  // emails, and matching email-only is proven to work for the member update).
  // Fall back to couple_id only when no email is available.
  let result;
  if (params.email) {
    result = await supabaseServer
      .from("couples")
      .update(update)
      .or(
        `partner_one_email.ilike.${params.email},partner_two_email.ilike.${params.email}`
      )
      .select("id, subscription_status");
  } else if (params.coupleId) {
    result = await supabaseServer
      .from("couples")
      .update(update)
      .eq("id", params.coupleId)
      .select("id, subscription_status");
  } else {
    return;
  }

  const { data, error } = result;
  console.log("[stripe webhook] couple subscription update", {
    coupleId: params.coupleId,
    email: params.email,
    status: params.status,
    updated: data?.length ?? 0,
    error,
  });
}

export async function POST(request: Request) {
  console.log("[stripe webhook] request received");

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  if (!stripeWebhookSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not configured." }, { status: 500 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, stripeWebhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Stripe signature.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  console.log("[stripe webhook] event type", event.type);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        try {
          const session = event.data.object as Stripe.Checkout.Session;

          console.log("[stripe webhook] REAL CHECKOUT HIT", {
            sessionId: session.id,
            customerEmail: session.customer_email,
            customerDetailsEmail: session.customer_details?.email,
            metadata: session.metadata,
            customer: session.customer,
            subscription: session.subscription,
          });

          const rawEmail =
            session.metadata?.user_email ??
            session.customer_email ??
            session.customer_details?.email ??
            null;
          const email = rawEmail ? rawEmail.trim().toLowerCase() : null;
          const customerId =
            typeof session.customer === "string" ? session.customer : null;
          const subscriptionId =
            typeof session.subscription === "string" ? session.subscription : null;

          console.log("[stripe webhook] resolved values", {
            resolvedEmail: email,
            metadataUserEmail: session.metadata?.user_email,
            metadataMemberId: session.metadata?.member_id,
            metadataCoupleId: session.metadata?.couple_id,
            customerId,
            subscriptionId,
          });

          if (!email) {
            console.log("[stripe webhook] no email found, skipping member update");
            return NextResponse.json({ received: true }, { status: 200 });
          }

          // Pull the mailing address Checkout collected (handles older and
          // newer Stripe payload shapes), falling back to billing details.
          const sessionWithShipping = session as unknown as {
            shipping_details?: { name?: string | null; address?: unknown } | null;
            collected_information?: {
              shipping_details?: { name?: string | null; address?: unknown } | null;
            } | null;
          };
          const shipping =
            sessionWithShipping.collected_information?.shipping_details ??
            sessionWithShipping.shipping_details ??
            null;
          const shippingAddress = shipping?.address ?? session.customer_details?.address ?? null;
          const shippingName = shipping?.name ?? session.customer_details?.name ?? null;

          // Source of truth: mark the couple premium (works no matter which
          // partner paid). Runs before the member update's early returns.
          await updateCoupleSubscription({
            coupleId: session.metadata?.couple_id?.trim() || null,
            email,
            status: "premium",
            customerId,
            subscriptionId,
            shippingName,
            shippingAddress,
          });

          console.log("[stripe webhook] updating by email", {
            email,
            customerId,
            subscriptionId,
          });

          const { data: updatedRows, error: updateError } = await supabaseServer
            .from("members")
            .update({
              subscription_status: "premium",
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
            })
            .or(`email.ilike.${email},partner_email.ilike.${email}`)
            .select("email, partner_email, subscription_status, stripe_customer_id, stripe_subscription_id");

          console.log("[stripe webhook] supabase update response", {
            data: updatedRows,
            error: updateError,
          });

          console.log("[stripe webhook] updated row count", updatedRows?.length ?? 0);

          if (updateError) {
            console.error("[stripe webhook] member update failed", {
              email,
              customerId,
              subscriptionId,
              updateError,
            });
            return NextResponse.json({ received: true }, { status: 200 });
          }

          if (!updatedRows || updatedRows.length === 0) {
            console.log("[stripe webhook] no members updated");
            return NextResponse.json({ received: true }, { status: 200 });
          }
        } catch (error) {
          console.error("[stripe webhook] checkout.session.completed error", error);
          return NextResponse.json({ received: true }, { status: 200 });
        }

        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        try {
          const subscription = event.data.object as Stripe.Subscription;
          const email = normalizeEmail(subscription.metadata?.user_email ?? null);
          const isPremium = subscription.status === "active" || subscription.status === "trialing";
          const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
          const subscriptionId = subscription.id;

          console.log("[stripe webhook] subscription event", {
            eventType: event.type,
            email,
            customerId,
            subscriptionId,
            stripeStatus: subscription.status,
            isPremium,
          });

          if (!email) {
            console.log("[stripe webhook] no email found, skipping member update");
            return NextResponse.json({ received: true }, { status: 200 });
          }

          await updateCoupleSubscription({
            coupleId: subscription.metadata?.couple_id?.trim() || null,
            email,
            status: isPremium ? "premium" : "canceled",
            customerId,
            subscriptionId,
          });

          console.log("[stripe webhook] updating by email", {
            email,
            customerId,
            subscriptionId,
          });

          const { data: updatedRows, error: updateError } = await supabaseServer
            .from("members")
            .update({
              subscription_status: isPremium ? "premium" : "canceled",
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
            })
            .or(`email.ilike.${email},partner_email.ilike.${email}`)
            .select("email, partner_email, subscription_status, stripe_customer_id, stripe_subscription_id");

          console.log("[stripe webhook] supabase update response", {
            data: updatedRows,
            error: updateError,
          });

          console.log("[stripe webhook] updated row count", updatedRows?.length ?? 0);

          if (updateError) {
            console.error("[stripe webhook] member update failed", {
              email,
              customerId,
              subscriptionId,
              updateError,
            });
          }
        } catch (error) {
          console.error(`[stripe webhook] ${event.type} error`, error);
        }
        break;
      }
      case "customer.subscription.deleted": {
        try {
          const subscription = event.data.object as Stripe.Subscription;
          const email = normalizeEmail(subscription.metadata?.user_email ?? null);
          const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
          const subscriptionId = subscription.id;

          console.log("[stripe webhook] subscription event", {
            eventType: event.type,
            email,
            customerId,
            subscriptionId,
          });

          if (!email) {
            console.log("[stripe webhook] no email found, skipping member update");
            return NextResponse.json({ received: true }, { status: 200 });
          }

          await updateCoupleSubscription({
            coupleId: subscription.metadata?.couple_id?.trim() || null,
            email,
            status: "canceled",
            customerId,
            subscriptionId,
          });

          console.log("[stripe webhook] updating by email", {
            email,
            customerId,
            subscriptionId,
          });

          const { data: updatedRows, error: updateError } = await supabaseServer
            .from("members")
            .update({
              subscription_status: "canceled",
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
            })
            .or(`email.ilike.${email},partner_email.ilike.${email}`)
            .select("email, partner_email, subscription_status, stripe_customer_id, stripe_subscription_id");

          console.log("[stripe webhook] supabase update response", {
            data: updatedRows,
            error: updateError,
          });

          console.log("[stripe webhook] updated row count", updatedRows?.length ?? 0);

          if (updateError) {
            console.error("[stripe webhook] member update failed", {
              email,
              customerId,
              subscriptionId,
              updateError,
            });
          }
        } catch (error) {
          console.error("[stripe webhook] customer.subscription.deleted error", error);
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("[stripe webhook] webhook handling failed", error);
    const message = error instanceof Error ? error.message : "Webhook handling failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
