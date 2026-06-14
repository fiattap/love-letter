import { NextResponse } from "next/server";
import { Resend } from "resend";

import {
  buildStationeryEmailHtml,
  buildStationeryEmailText,
  ensureManualRouteGuard,
  getAppBaseUrl,
  sendSingleCycleEmail,
} from "@/lib/cycleEmail";
import {
  getCycleScheduleFromMonthKey,
  getLoveLetterToday,
  isPromptEmailEligibleToSend,
} from "@/lib/loveLetterDate";
import { loadActivePrompt } from "@/lib/prompts";
import { supabase } from "@/lib/supabase";

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

  const body = (await request.json().catch(() => ({}))) as { simulatedDate?: string };
  const parsedSimulatedDate = body.simulatedDate ? new Date(body.simulatedDate) : null;
  const today =
    parsedSimulatedDate && !Number.isNaN(parsedSimulatedDate.getTime())
      ? parsedSimulatedDate
      : getLoveLetterToday();

  if (!isPromptEmailEligibleToSend(today, cycle.revealDate)) {
    return NextResponse.json(
      { error: "Prompt emails can only be sent during the writing window." },
      { status: 400 }
    );
  }

  const { data: members, error } = await supabase
    .from("members")
    .select("email, delivery_type")
    .order("created_at", { ascending: false });

  if (error || !members) {
    return NextResponse.json(
      { error: "Could not load members for this cycle." },
      { status: 500 }
    );
  }

  const resend = new Resend(resendApiKey);
  const writeUrl = `${getAppBaseUrl()}/write`;
  const html = buildStationeryEmailHtml({
    title: `Your ${activePrompt.title} is ready.`,
    promptText: activePrompt.prompt,
    leadText: "Take a few quiet minutes to write from the heart.",
    supportingText:
      "Your letter will remain sealed until both of you have finished writing.",
    buttonText: "Write My Letter",
    buttonUrl: writeUrl,
  });
  const text = buildStationeryEmailText({
    title: `Your ${activePrompt.title} is ready.`,
    promptText: activePrompt.prompt,
    leadText: "Take a few quiet minutes to write from the heart.",
    supportingText:
      "Your letter will remain sealed until both of you have finished writing.",
    buttonText: "Write My Letter",
    buttonUrl: writeUrl,
  });

  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const member of members) {
    const result = await sendSingleCycleEmail({
      resend,
      email: member.email,
      eventType: "prompt",
      cycleKey: cycle.cycleKey,
      subject: `Your ${activePrompt.title} ♡`,
      html,
      text,
    });

    if (result.skipped) {
      skippedCount += 1;
      continue;
    }

    if (result.failed) {
      failedCount += 1;
      continue;
    }

    sentCount += 1;
  }

  const physicalRequested = members
    .filter((item) => item.delivery_type === "physical")
    .map((item) => item.email);

  return NextResponse.json({
    cycleKey: cycle.cycleKey,
    sentCount,
    skippedCount,
    failedCount,
    physicalRequested,
  });
}
