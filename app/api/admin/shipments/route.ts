import { NextResponse } from "next/server";

import { ensureManualRouteGuard } from "@/lib/cycleEmail";
import { getCurrentCycleKey } from "@/lib/loveLetterDate";
import { supabaseServer } from "@/lib/supabaseServer";

type CoupleRow = {
  id: string;
  partner_one_email: string | null;
  partner_two_email: string | null;
  shipping_name: string | null;
  shipping_address: unknown;
};

type ShipmentRow = {
  couple_id: string;
  status: string;
  shipped_at: string | null;
};

export async function GET(request: Request) {
  const guardError = ensureManualRouteGuard(request);
  if (guardError) {
    return NextResponse.json({ error: guardError }, { status: 403 });
  }

  const url = new URL(request.url);
  const cycleKey = url.searchParams.get("cycleKey")?.trim() || getCurrentCycleKey();

  const { data: couples, error: couplesError } = await supabaseServer
    .from("couples")
    .select("id, partner_one_email, partner_two_email, shipping_name, shipping_address")
    .in("subscription_status", ["premium", "active"]);

  if (couplesError) {
    return NextResponse.json({ error: "Could not load premium couples." }, { status: 500 });
  }

  const coupleRows = (couples ?? []) as CoupleRow[];
  const coupleIds = coupleRows.map((couple) => couple.id);

  let shipmentsByCouple = new Map<string, ShipmentRow>();
  if (coupleIds.length > 0) {
    const { data: shipments, error: shipmentsError } = await supabaseServer
      .from("shipments")
      .select("couple_id, status, shipped_at")
      .eq("cycle_key", cycleKey)
      .in("couple_id", coupleIds);

    if (shipmentsError) {
      return NextResponse.json({ error: "Could not load shipment statuses." }, { status: 500 });
    }

    shipmentsByCouple = new Map(
      ((shipments ?? []) as ShipmentRow[]).map((row) => [row.couple_id, row])
    );
  }

  const rows = coupleRows.map((couple) => {
    const shipment = shipmentsByCouple.get(couple.id);
    return {
      coupleId: couple.id,
      partnerOneEmail: couple.partner_one_email,
      partnerTwoEmail: couple.partner_two_email,
      shippingName: couple.shipping_name,
      shippingAddress: couple.shipping_address ?? null,
      status: shipment?.status === "shipped" ? "shipped" : "pending",
      shippedAt: shipment?.shipped_at ?? null,
    };
  });

  return NextResponse.json({ cycleKey, couples: rows });
}

export async function POST(request: Request) {
  const guardError = ensureManualRouteGuard(request);
  if (guardError) {
    return NextResponse.json({ error: guardError }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    coupleId?: string;
    cycleKey?: string;
    shipped?: boolean;
  };

  const coupleId = body.coupleId ? String(body.coupleId).trim() : "";
  const cycleKey = body.cycleKey?.trim();
  const shipped = body.shipped !== false; // default to marking shipped

  if (!coupleId || !cycleKey) {
    return NextResponse.json({ error: "coupleId and cycleKey are required." }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from("shipments")
    .upsert(
      {
        couple_id: coupleId,
        cycle_key: cycleKey,
        status: shipped ? "shipped" : "pending",
        shipped_at: shipped ? new Date().toISOString() : null,
      },
      { onConflict: "couple_id,cycle_key" }
    );

  if (error) {
    return NextResponse.json({ error: "Could not update shipment status." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, coupleId, cycleKey, shipped });
}
