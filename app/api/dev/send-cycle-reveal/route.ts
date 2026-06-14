import { NextResponse } from "next/server";
import { Resend } from "resend";

import {
  buildStationeryEmailHtml,
  buildStationeryEmailText,
  ensureManualRouteGuard,
  getAppBaseUrl,
  sendSingleCycleEmail,
} from "@/lib/cycleEmail";
import { getCycleScheduleFromMonthKey } from "@/lib/loveLetterDate";
import { loadActivePrompt } from "@/lib/prompts";
import { supabase } from "@/lib/supabase";

type ReadyCouple = {
  memberEmail: string;
  partnerEmail: string | null;
  deliveryType: string;
};

export async function POST(request: Request) {
  const guardError = ensureManualRouteGuard(request);
  if (guardError) {
    return NextResponse.json({ error: guardError }, { status: 403 });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not configured." },
      { status: 500 }
    );
  }

  const activePrompt = await loadActivePrompt();
  if (!activePrompt) {
    return NextResponse.json(
      { error: "Our next Love Letter is being prepared." },
      { status: 400 }
    );
  }

  const cycle = getCycleScheduleFromMonthKey(activePrompt.month_key);
  if (!cycle) {
    return NextResponse.json(
      { error: "Active prompt has an invalid month key." },
      { status: 400 }
    );
  }

  const { data: letters, error: lettersError } = await supabase
    .from("letters")
    .select("couple_id")
    .eq("prompt", activePrompt.prompt)
    .eq("status", "sealed")
    .not("couple_id", "is", null);

  if (lettersError) {
    return NextResponse.json(
      { error: "Could not load letters for reveal checks." },
      { status: 500 }
    );
  }

  const countsByCouple = new Map<number, number>();
  for (const row of letters ?? []) {
    const coupleId = row.couple_id as number;
    countsByCouple.set(coupleId, (countsByCouple.get(coupleId) ?? 0) + 1);
  }

  const readyCoupleIds = [...countsByCouple.entries()]
    .filter(([, count]) => count >= 2)
    .map(([coupleId]) => coupleId);

  if (readyCoupleIds.length === 0) {
    return NextResponse.json({
      cycleKey: cycle.cycleKey,
      sentCount: 0,
      skippedCount: 0,
      failedCount: 0,
      physicalRequested: [],
      note: "No couples have both letters yet.",
    });
  }

  const { data: couples, error: couplesError } = await supabase
    .from("couples")
    .select("id, member_id, partner_email")
    .in("id", readyCoupleIds);

  if (couplesError || !couples) {
    return NextResponse.json(
      { error: "Could not load ready couples." },
      { status: 500 }
    );
  }

  const memberIds = couples.map((item) => item.member_id);
  const { data: members, error: membersError } = await supabase
    .from("members")
    .select("id, email, delivery_type")
    .in("id", memberIds);

  if (membersError || !members) {
    return NextResponse.json(
      { error: "Could not load member emails for ready couples." },
      { status: 500 }
    );
  }

  const memberById = new Map(members.map((item) => [item.id, item]));
  const readyAudience: ReadyCouple[] = couples
    .map((couple) => {
      const member = memberById.get(couple.member_id);
      if (!member) {
        return null;
      }

      return {
        memberEmail: member.email,
        partnerEmail: couple.partner_email,
        deliveryType: member.delivery_type,
      };
    })
    .filter((item): item is ReadyCouple => Boolean(item));

  const resend = new Resend(resendApiKey);
  const revealUrl = `${getAppBaseUrl()}/reveal`;
  const html = buildStationeryEmailHtml({
    title: `Your ${activePrompt.title} reveal is ready.`,
    promptText: activePrompt.prompt,
    leadText: "Both letters are sealed and ready to open together.",
    supportingText: "Set aside a quiet moment and step into your reveal.",
    buttonText: "Open Reveal",
    buttonUrl: revealUrl,
  });
  const text = buildStationeryEmailText({
    title: `Your ${activePrompt.title} reveal is ready.`,
    promptText: activePrompt.prompt,
    leadText: "Both letters are sealed and ready to open together.",
    supportingText: "Set aside a quiet moment and step into your reveal.",
    buttonText: "Open Reveal",
    buttonUrl: revealUrl,
  });

  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const audience of readyAudience) {
    const primaryResult = await sendSingleCycleEmail({
      resend,
      email: audience.memberEmail,
      eventType: "reveal",
      cycleKey: cycle.cycleKey,
      subject: `Reveal ready: ${activePrompt.title} ♡`,
      html,
      text,
    });

    if (primaryResult.skipped) {
      skippedCount += 1;
    } else if (primaryResult.failed) {
      failedCount += 1;
    } else {
      sentCount += 1;
    }

    if (audience.partnerEmail) {
      const partnerResult = await sendSingleCycleEmail({
        resend,
        email: audience.partnerEmail,
        eventType: "reveal",
        cycleKey: cycle.cycleKey,
        subject: `Reveal ready: ${activePrompt.title} ♡`,
        html,
        text,
      });

      if (partnerResult.skipped) {
        skippedCount += 1;
      } else if (partnerResult.failed) {
        failedCount += 1;
      } else {
        sentCount += 1;
      }
    }
  }

  const physicalRequested = readyAudience
    .filter((item) => item.deliveryType === "physical")
    .map((item) => item.memberEmail);

  return NextResponse.json({
    cycleKey: cycle.cycleKey,
    sentCount,
    skippedCount,
    failedCount,
    physicalRequested,
  });
}
