import { NextResponse } from "next/server";
import { Resend } from "resend";

import {
  buildStationeryEmailHtml,
  buildStationeryEmailText,
  ensureManualRouteGuard,
  getAppBaseUrl,
  sendSingleCycleEmail,
} from "@/lib/cycleEmail";
import { getCycleScheduleFromMonthKey, getLoveLetterToday } from "@/lib/loveLetterDate";
import { loadActivePrompt } from "@/lib/prompts";
import { supabase } from "@/lib/supabase";
import { supabaseServer } from "@/lib/supabaseServer";

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

  // Both partners can need a reminder; the couples table holds both emails.
  const { data: couples, error: couplesError } = await supabase
    .from("couples")
    .select("partner_one_email, partner_two_email");

  if (couplesError || !couples) {
    return NextResponse.json(
      { error: "Could not load couples for this cycle." },
      { status: 500 }
    );
  }

  const { data: physicalMembers } = await supabase
    .from("members")
    .select("email, delivery_type");

  const { data: submittedLetters, error: lettersError } = await supabaseServer
    .from("letters")
    .select("writer_email")
    .eq("cycle_key", cycle.cycleKey)
    .eq("status", "sealed");

  if (lettersError) {
    return NextResponse.json(
      { error: "Could not load submitted letters for this cycle." },
      { status: 500 }
    );
  }

  const submittedEmails = new Set(
    (submittedLetters ?? [])
      .map((item) => item.writer_email?.trim().toLowerCase())
      .filter((email): email is string => Boolean(email))
  );

  // Both partners, minus anyone who already sealed their letter this cycle.
  const recipients = Array.from(
    new Set(
      couples
        .flatMap((couple) => [couple.partner_one_email, couple.partner_two_email])
        .filter((email): email is string => Boolean(email))
        .map((email) => email.trim().toLowerCase())
    )
  ).filter((email) => !submittedEmails.has(email));

  const resend = new Resend(resendApiKey);
  const writeUrl = `${getAppBaseUrl()}/write`;
  const html = buildStationeryEmailHtml({
    title: `A gentle reminder for ${activePrompt.title}.`,
    promptText: activePrompt.prompt,
    leadText: "If you have not written yet, this is your quiet nudge.",
    supportingText: "Your letter stays sealed until both of you have finished.",
    buttonText: "Write My Letter",
    buttonUrl: writeUrl,
  });
  const text = buildStationeryEmailText({
    title: `A gentle reminder for ${activePrompt.title}.`,
    promptText: activePrompt.prompt,
    leadText: "If you have not written yet, this is your quiet nudge.",
    supportingText: "Your letter stays sealed until both of you have finished.",
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
      eventType: "reminder",
      cycleKey: cycle.cycleKey,
      subject: `Reminder: ${activePrompt.title} ♡`,
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
