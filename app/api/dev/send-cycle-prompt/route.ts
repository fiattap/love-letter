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

  const body = (await request.json().catch(() => ({}))) as { simulatedDate?: string };
  const parsedSimulatedDate = body.simulatedDate ? new Date(body.simulatedDate) : null;
  const today =
    parsedSimulatedDate && !Number.isNaN(parsedSimulatedDate.getTime())
      ? parsedSimulatedDate
      : getLoveLetterToday();

  // Select the prompt for the (possibly simulated) "today" so the cycle and the
  // writing-window check below stay consistent.
  const activePrompt = await loadActivePrompt(today);
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

  if (!isPromptEmailEligibleToSend(today, cycle.revealDate)) {
    return NextResponse.json(
      { error: "Prompt emails can only be sent during the writing window." },
      { status: 400 }
    );
  }

  // Both partners must receive the prompt. The couples table holds both emails;
  // a member row only exists for the person who signed up.
  const { data: couples, error: couplesError } = await supabase
    .from("couples")
    .select("partner_one_email, partner_two_email");

  if (couplesError || !couples) {
    return NextResponse.json(
      { error: "Could not load couples for this cycle." },
      { status: 500 }
    );
  }

  const recipients = Array.from(
    new Set(
      couples
        .flatMap((couple) => [couple.partner_one_email, couple.partner_two_email])
        .filter((email): email is string => Boolean(email))
        .map((email) => email.trim().toLowerCase())
    )
  );

  const { data: physicalMembers } = await supabase
    .from("members")
    .select("email, delivery_type");

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

  for (const email of recipients) {
    const result = await sendSingleCycleEmail({
      resend,
      email,
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

  const physicalRequested = (physicalMembers ?? [])
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
