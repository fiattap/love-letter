import { NextResponse } from "next/server";
import { Resend } from "resend";

import {
  buildStationeryEmailHtml,
  buildStationeryEmailText,
  getAppBaseUrl,
  hasSentEmailEvent,
  logEmailEvent,
} from "@/lib/cycleEmail";
import {
  getLoveLetterToday,
  getRevealDateForToday,
  getRevealDateFromMonthKey,
  isPromptEmailEligibleToSend,
} from "@/lib/loveLetterDate";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(request: Request) {
  let email = "";
  let trigger: "test" | "signup" = "test";
  let devDate = "";

  try {
    const body = (await request.json()) as {
      email?: string;
      trigger?: "test" | "signup";
      devDate?: string | null;
    };
    email = body.email?.trim() ?? "";
    trigger = body.trigger === "signup" ? "signup" : "test";
    devDate = body.devDate?.trim() ?? "";
  } catch {
    return NextResponse.json(
      { error: "Please provide an email address." },
      { status: 400 }
    );
  }

  const isDevelopment = process.env.NODE_ENV === "development";
  const adminGuardKey = process.env.SEND_PROMPT_ADMIN_KEY;
  const requestAdminKey = request.headers.get("x-admin-key");

  if (!isDevelopment && trigger !== "signup") {
    if (!adminGuardKey) {
      return NextResponse.json(
        { error: "Prompt email test route is disabled." },
        { status: 403 }
      );
    }

    if (!requestAdminKey || requestAdminKey !== adminGuardKey) {
      return NextResponse.json(
        { error: "You are not allowed to send test prompt emails." },
        { status: 403 }
      );
    }
  }

  if (!email) {
    return NextResponse.json(
      { error: "Please provide an email address." },
      { status: 400 }
    );
  }

  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not configured." },
      { status: 500 }
    );
  }

  const { data: activePrompt, error: activePromptError } = await supabaseServer
    .from("prompts")
    .select("id, month_key, title, prompt")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  console.info("send-prompt active prompt query", {
    data: activePrompt,
    error: activePromptError,
  });

  if (activePromptError) {
    return NextResponse.json(
      {
        error: isDevelopment
          ? `Active prompt query failed: ${activePromptError.message}`
          : "Our next Love Letter is being prepared.",
      },
      { status: 400 }
    );
  }

  if (!activePrompt) {
    return NextResponse.json(
      { error: "Our next Love Letter is being prepared." },
      { status: 400 }
    );
  }

  const parsedDevDate = devDate ? new Date(devDate) : null;
  const hasValidDevDate =
    isDevelopment &&
    parsedDevDate instanceof Date &&
    !Number.isNaN(parsedDevDate.getTime());

  if (hasValidDevDate) {
    console.log(`Using dev date for send-prompt: ${devDate}`);
  }

  const today = hasValidDevDate ? parsedDevDate : getLoveLetterToday();
  const revealDate =
    getRevealDateFromMonthKey(activePrompt.month_key) ?? getRevealDateForToday(today);

  if (!isPromptEmailEligibleToSend(today, revealDate)) {
    return NextResponse.json(
      { error: "Prompt email can only be sent during the writing window." },
      { status: 400 }
    );
  }

  const resend = new Resend(resendApiKey);
  const writeUrl = `${getAppBaseUrl()}/write`;

  const { data: couple, error: coupleError } = await supabaseServer
    .from("couples")
    .select("partner_one_email, partner_two_email")
    .or(`partner_one_email.eq.${email},partner_two_email.eq.${email}`)
    .maybeSingle();

  if (coupleError) {
    console.info("send-prompt couple query error", coupleError);
  }

  const recipientEmails = [
    couple?.partner_one_email,
    couple?.partner_two_email,
  ].filter((recipientEmail): recipientEmail is string => Boolean(recipientEmail));

  if (!recipientEmails.length) {
    recipientEmails.push(email);
  }

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

  const sendResults = await Promise.allSettled(
    recipientEmails.map(async (recipientEmail) => {
      const alreadySent = await hasSentEmailEvent(
        recipientEmail,
        "prompt_sent",
        activePrompt.month_key
      );

      if (alreadySent) {
        return { email: recipientEmail, skipped: true as const };
      }

      try {
        const response = await resend.emails.send({
          from: "Love Letter Team <hello@theloveletter.co>",
          to: recipientEmail,
          subject: `Your ${activePrompt.title} ♡`,
          html,
          text,
        });

        if (response.error) {
          console.error("send-prompt Resend API error", response.error);
          await logEmailEvent({
            email: recipientEmail,
            eventType: "prompt_sent",
            cycleKey: activePrompt.month_key,
            status: "failed",
            error: response.error.message,
          });

          return {
            email: recipientEmail,
            failed: true as const,
            error: response.error.message,
          };
        }

        await logEmailEvent({
          email: recipientEmail,
          eventType: "prompt_sent",
          cycleKey: activePrompt.month_key,
          status: "sent",
          resendId: response.data?.id ?? null,
        });

        return {
          email: recipientEmail,
          skipped: false as const,
          failed: false as const,
          id: response.data?.id ?? null,
        };
      } catch (sendError) {
        console.error("send-prompt unexpected error while sending email", sendError);
        await logEmailEvent({
          email: recipientEmail,
          eventType: "prompt_sent",
          cycleKey: activePrompt.month_key,
          status: "failed",
          error: sendError instanceof Error ? sendError.message : "Unexpected send failure",
        });

        return {
          email: recipientEmail,
          failed: true as const,
          error: sendError instanceof Error ? sendError.message : "Unexpected send failure",
        };
      }
    })
  );

  const normalizedResults = sendResults.map((result) =>
    result.status === "fulfilled"
      ? result.value
      : {
          email,
          failed: true as const,
          error: result.reason instanceof Error ? result.reason.message : "Unexpected send failure",
        }
  );

  const failedResults = normalizedResults.filter((result) => "failed" in result && result.failed);
  const failedEmails = failedResults.map((result) => result.email);
  const successfulEmails = normalizedResults
    .filter((result) => !("failed" in result && result.failed))
    .map((result) => result.email);

  if (failedResults.length === normalizedResults.length) {
    return NextResponse.json(
      {
        error:
          failedResults[0] && "error" in failedResults[0]
            ? failedResults[0].error
            : "We couldn't send the prompt email right now.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    recipients: successfulEmails,
    failedRecipients: failedEmails,
    partialFailure: failedResults.length > 0,
  });
}