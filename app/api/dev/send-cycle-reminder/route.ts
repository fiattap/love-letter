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

  const { data: members, error: membersError } = await supabase
    .from("members")
    .select("email, delivery_type")
    .order("created_at", { ascending: false });

  if (membersError || !members) {
    return NextResponse.json(
      { error: "Could not load members for this cycle." },
      { status: 500 }
    );
  }

  const { data: submittedLetters, error: lettersError } = await supabase
    .from("letters")
    .select("writer_email")
    .eq("prompt", activePrompt.prompt)
    .eq("status", "sealed");

  if (lettersError) {
    return NextResponse.json(
      { error: "Could not load submitted letters for this cycle." },
      { status: 500 }
    );
  }

  const submittedEmails = new Set((submittedLetters ?? []).map((item) => item.writer_email));
  const recipients = members.filter((item) => !submittedEmails.has(item.email));

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

  for (const member of recipients) {
    const result = await sendSingleCycleEmail({
      resend,
      email: member.email,
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

  const physicalRequested = recipients
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
