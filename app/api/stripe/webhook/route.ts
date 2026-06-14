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
