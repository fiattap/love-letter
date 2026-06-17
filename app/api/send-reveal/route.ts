import { NextResponse } from "next/server";
import { Resend } from "resend";

import { buildStationeryEmailHtml, buildStationeryEmailText, getAppBaseUrl } from "@/lib/cycleEmail";
import {
  getCycleScheduleFromMonthKey,
  getLoveLetterToday,
  getRevealDateFromMonthKey,
  getWritingWindowForRevealDate,
  isRevealAvailable,
} from "@/lib/loveLetterDate";
import { supabaseServer } from "@/lib/supabaseServer";

type RequestBody = {
  cycleKey?: string;
  cycle_key?: string;
  devDate?: string;
  force?: boolean;
  forceResend?: boolean;
  backfillOnly?: boolean;
};

type SerializedDbError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

type RevealEventInsertResult =
  | { ok: true; mode: "primary" | "fallback" }
  | {
      ok: false;
      mode: "failed";
      primaryError: SerializedDbError;
      fallbackError: SerializedDbError;
    };

function serializeDbError(error: {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}): SerializedDbError {
  return {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  };
}

function readProvidedCronSecret(request: Request) {
  const authHeader = request.headers.get("authorization")?.trim() ?? "";
  const bearerPrefix = "Bearer ";
  if (authHeader.startsWith(bearerPrefix)) {
    return authHeader.slice(bearerPrefix.length).trim();
  }

  const headerSecret = request.headers.get("x-cron-secret")?.trim();
  if (headerSecret) {
    return headerSecret;
  }

  const url = new URL(request.url);
  return url.searchParams.get("cronSecret")?.trim() ?? "";
}

function isAuthorizedRevealTrigger(request: Request) {
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  const configuredSecret = process.env.CRON_SECRET?.trim();
  const adminSecret = process.env.ADMIN_SECRET?.trim();
  const providedSecret = readProvidedCronSecret(request);

  if (configuredSecret || adminSecret) {
    return (
      Boolean(providedSecret) &&
      (providedSecret === configuredSecret || providedSecret === adminSecret)
    );
  }

  // If CRON_SECRET is not configured, only allow Vercel cron invocations.
  return request.headers.get("x-vercel-cron") === "1";
}

async function hasSentRevealEmail(email: string, cycleKey: string) {
  const { data: emailMatch, error: emailError } = await supabaseServer
    .from("email_events")
    .select("id")
    .eq("email", email)
    .eq("event_type", "reveal_sent")
    .eq("cycle_key", cycleKey)
    .eq("status", "sent")
    .limit(1)
    .maybeSingle();

  if (emailError) {
    console.error("send-reveal duplicate check failed (email)", emailError);
    return false;
  }

  return Boolean(emailMatch);
}

async function logRevealEmailEvent(options: {
  recipientEmail: string;
  coupleId: number;
  cycleKey: string;
  status: "sent" | "error";
  resendId?: string | null;
  errorMessage?: string | null;
}): Promise<RevealEventInsertResult> {
  const primaryInsert = await supabaseServer.from("email_events").insert({
    email: options.recipientEmail,
    event_type: "reveal_sent",
    cycle_key: options.cycleKey,
    status: options.status,
    error_message: options.errorMessage ?? null,
  });

  if (!primaryInsert.error) {
    console.log("[send-reveal] email event inserted", {
      cycle_key: options.cycleKey,
      couple_id: options.coupleId,
      recipient_email: options.recipientEmail,
      event_type: "reveal_sent",
      status: options.status,
      provider_message_id: options.resendId ?? null,
      error_message: options.errorMessage ?? null,
      mode: "primary",
    });
    return { ok: true, mode: "primary" };
  }

  const fallbackInsert = await supabaseServer.from("email_events").insert({
    email: options.recipientEmail,
    event_type: "reveal_sent",
    cycle_key: options.cycleKey,
    status: options.status,
    error_message: options.errorMessage ?? null,
  });

  if (fallbackInsert.error) {
    const primaryError = serializeDbError(primaryInsert.error);
    const fallbackError = serializeDbError(fallbackInsert.error);

    console.error("[send-reveal] email event insert failed", {
      cycle_key: options.cycleKey,
      couple_id: options.coupleId,
      recipient_email: options.recipientEmail,
      event_type: "reveal_sent",
      status: options.status,
      primary_error: primaryError,
      fallback_error: fallbackError,
    });

    return {
      ok: false,
      mode: "failed",
      primaryError,
      fallbackError,
    };
  }

  console.log("[send-reveal] email event inserted", {
    cycle_key: options.cycleKey,
    couple_id: options.coupleId,
    recipient_email: options.recipientEmail,
    event_type: "reveal_sent",
    status: options.status,
    provider_message_id: options.resendId ?? null,
    error_message: options.errorMessage ?? null,
    mode: "fallback",
  });

  return { ok: true, mode: "fallback" };
}

export async function POST(request: Request) {
  const isDevelopment = process.env.NODE_ENV === "development";

  // Cron schedule is defined in vercel.json as "0 8 15 * *" and runs in UTC.
  // If we want 8:00 AM Pacific, schedule the equivalent UTC hour for that date.

  if (!isAuthorizedRevealTrigger(request)) {
    return NextResponse.json({ error: "Unauthorized reveal email trigger." }, { status: 401 });
  }

  let body: RequestBody = {};
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    body = {};
  }

  const backfillOnly = Boolean(body.backfillOnly);
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!backfillOnly && !resendApiKey) {
    return NextResponse.json({ error: "RESEND_API_KEY is not configured." }, { status: 500 });
  }

  const force = Boolean(body.force);
  const forceResend = Boolean(body.forceResend || body.force);
  const parsedDevDate = body.devDate ? new Date(body.devDate) : null;
  const hasValidDevDate = Boolean(parsedDevDate && !Number.isNaN(parsedDevDate.getTime()));
  const today = force && hasValidDevDate ? (parsedDevDate as Date) : getLoveLetterToday();

  const requestedCycleKey = body.cycleKey?.trim() || body.cycle_key?.trim();

  if (backfillOnly) {
    const { data: emailEventColumns, error: schemaError } = await supabaseServer
      .schema("information_schema")
      .from("columns")
      .select("column_name, data_type, is_nullable, column_default")
      .eq("table_schema", "public")
      .eq("table_name", "email_events")
      .order("ordinal_position", { ascending: true });

    if (schemaError) {
      console.error("[send-reveal] email_events schema check failed", serializeDbError(schemaError));
    } else {
      console.log("[send-reveal] email_events schema", emailEventColumns ?? []);
    }

    const { data: grantRows, error: grantError } = await supabaseServer
      .schema("information_schema")
      .from("role_table_grants")
      .select("grantee, privilege_type, table_schema, table_name")
      .eq("table_schema", "public")
      .eq("table_name", "email_events")
      .eq("grantee", "service_role");

    if (grantError) {
      console.error("[send-reveal] email_events grant check failed", serializeDbError(grantError));
    } else {
      console.log("[send-reveal] email_events service_role grants", grantRows ?? []);
    }
  }

  const { data: activePrompt, error: promptError } = await supabaseServer
    .from("prompts")
    .select("month_key, title, prompt, is_active")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (promptError) {
    return NextResponse.json({ error: `Active prompt query failed: ${promptError.message}` }, { status: 500 });
  }

  if (!activePrompt) {
    return NextResponse.json({ error: "Our next Love Letter is being prepared." }, { status: 400 });
  }

  const cycleKey = requestedCycleKey || activePrompt.month_key;

  const { data: cyclePrompt, error: cyclePromptError } = await supabaseServer
    .from("prompts")
    .select("month_key, title, prompt")
    .eq("month_key", cycleKey)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cyclePromptError) {
    return NextResponse.json(
      { error: `Cycle prompt query failed: ${cyclePromptError.message}` },
      { status: 500 }
    );
  }

  if (!cyclePrompt) {
    return NextResponse.json(
      { error: `No prompt configured for cycle ${cycleKey}.` },
      { status: 400 }
    );
  }

  const cycle = getCycleScheduleFromMonthKey(cycleKey);
  if (!cycle) {
    return NextResponse.json({ error: "Requested cycle has an invalid month key." }, { status: 400 });
  }

  const revealDate = getRevealDateFromMonthKey(cycleKey);
  if (!revealDate) {
    return NextResponse.json({ error: "Requested cycle has an invalid reveal date." }, { status: 400 });
  }

  if (!force && !isRevealAvailable(today, getWritingWindowForRevealDate(revealDate))) {
    return NextResponse.json(
      { error: "Reveal emails can only be sent on reveal day or after reveal opens." },
      { status: 400 }
    );
  }

  const { data: couples, error: couplesError } = await supabaseServer
    .from("couples")
    .select("id, partner_one_email, partner_two_email");

  if (couplesError) {
    return NextResponse.json({ error: "Could not load couples for reveal checks." }, { status: 500 });
  }

  const { data: sealedLetters, error: lettersError } = await supabaseServer
    .from("letters")
    .select("couple_id, writer_email")
    .eq("cycle_key", cycle.cycleKey)
    .eq("status", "sealed");

  if (lettersError) {
    return NextResponse.json({ error: "Could not load sealed letters for reveal checks." }, { status: 500 });
  }

  const writersByCoupleId = new Map<number, Set<string>>();
  for (const letter of sealedLetters ?? []) {
    if (!letter.couple_id) {
      continue;
    }

    if (!writersByCoupleId.has(letter.couple_id)) {
      writersByCoupleId.set(letter.couple_id, new Set<string>());
    }

    const writerEmail = letter.writer_email?.trim().toLowerCase();
    if (writerEmail) {
      writersByCoupleId.get(letter.couple_id)?.add(writerEmail);
    }
  }

  const readyCouples = (couples ?? []).filter((couple) => {
    if (!couple.id || !couple.partner_one_email || !couple.partner_two_email) {
      return false;
    }

    const coupleWriters = writersByCoupleId.get(couple.id);
    if (!coupleWriters) {
      return false;
    }

    return (
      coupleWriters.has(couple.partner_one_email.trim().toLowerCase()) &&
      coupleWriters.has(couple.partner_two_email.trim().toLowerCase())
    );
  });

  if (readyCouples.length === 0) {
    return NextResponse.json({
      cycleKey: cycle.cycleKey,
      sentCount: 0,
      skippedCount: 0,
      failedCount: 0,
      note: "No couples have both sealed letters yet.",
    });
  }

  const resend = backfillOnly ? null : new Resend(resendApiKey as string);
  const revealUrl = `${getAppBaseUrl()}/reveal`;
  const html = buildStationeryEmailHtml({
    title: `Your ${cyclePrompt.title} is ready.`,
    promptText: cyclePrompt.prompt,
    leadText: "Both letters are sealed.",
    supportingText: "Your reveal is open.",
    buttonText: "Open Reveal",
    buttonUrl: revealUrl,
  });
  const text = buildStationeryEmailText({
    title: `Your ${cyclePrompt.title} is ready.`,
    promptText: cyclePrompt.prompt,
    leadText: "Both letters are sealed.",
    supportingText: "Your reveal is open.",
    buttonText: "Open Reveal",
    buttonUrl: revealUrl,
  });

  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let backfilledCount = 0;
  const failedInserts: Array<{
    cycle_key: string;
    couple_id: number;
    recipient_email: string;
    status: "sent" | "error";
    primary_error: SerializedDbError;
    fallback_error: SerializedDbError;
  }> = [];

  for (const couple of readyCouples) {
    for (const recipientEmail of [couple.partner_one_email, couple.partner_two_email]) {
      if (!recipientEmail) {
        continue;
      }

      const alreadySent = await hasSentRevealEmail(recipientEmail, cycle.cycleKey);
      if (alreadySent && !forceResend) {
        skippedCount += 1;
        if (isDevelopment) {
          console.log("send-reveal skipped duplicate", recipientEmail, cycle.cycleKey);
        }
        continue;
      }

      if (backfillOnly) {
        const loggedSent = await logRevealEmailEvent({
          recipientEmail,
          coupleId: couple.id,
          cycleKey: cycle.cycleKey,
          status: "sent",
          resendId: null,
          errorMessage: null,
        });

        if (!loggedSent.ok) {
          failedCount += 1;
          failedInserts.push({
            cycle_key: cycle.cycleKey,
            couple_id: couple.id,
            recipient_email: recipientEmail,
            status: "sent",
            primary_error: loggedSent.primaryError,
            fallback_error: loggedSent.fallbackError,
          });
          continue;
        }

        backfilledCount += 1;
        continue;
      }

      try {
        if (!resend) {
          failedCount += 1;
          continue;
        }

        const response = await resend.emails.send({
          from: "Love Letter Team <hello@theloveletter.co>",
          to: recipientEmail,
          subject: "Your July Love Letter is ready ♡",
          html,
          text,
        });

        if (response.error) {
          failedCount += 1;
          const loggedError = await logRevealEmailEvent({
            recipientEmail,
            coupleId: couple.id,
            cycleKey: cycle.cycleKey,
            status: "error",
            errorMessage: response.error.message,
          });

          if (!loggedError.ok) {
            console.error("[send-reveal] failed email event was not persisted", {
              cycle_key: cycle.cycleKey,
              recipient_email: recipientEmail,
              primary_error: loggedError.primaryError,
              fallback_error: loggedError.fallbackError,
            });
            failedInserts.push({
              cycle_key: cycle.cycleKey,
              couple_id: couple.id,
              recipient_email: recipientEmail,
              status: "error",
              primary_error: loggedError.primaryError,
              fallback_error: loggedError.fallbackError,
            });
          }

          if (isDevelopment) {
            console.log("send-reveal failed", recipientEmail, response.error.message);
          }

          continue;
        }

        const loggedSent = await logRevealEmailEvent({
          recipientEmail,
          coupleId: couple.id,
          cycleKey: cycle.cycleKey,
          status: "sent",
          resendId: response.data?.id ?? null,
        });

        if (!loggedSent.ok) {
          failedCount += 1;
          console.error("[send-reveal] sent email event was not persisted", {
            cycle_key: cycle.cycleKey,
            recipient_email: recipientEmail,
            provider_message_id: response.data?.id ?? null,
            primary_error: loggedSent.primaryError,
            fallback_error: loggedSent.fallbackError,
          });
          failedInserts.push({
            cycle_key: cycle.cycleKey,
            couple_id: couple.id,
            recipient_email: recipientEmail,
            status: "sent",
            primary_error: loggedSent.primaryError,
            fallback_error: loggedSent.fallbackError,
          });
          continue;
        }

        sentCount += 1;

        if (isDevelopment) {
          console.log("send-reveal sent", recipientEmail, response.data?.id ?? null);
        }
      } catch (sendError) {
        failedCount += 1;
        const errorMessage = sendError instanceof Error ? sendError.message : "Unexpected send failure";
        const loggedError = await logRevealEmailEvent({
          recipientEmail,
          coupleId: couple.id,
          cycleKey: cycle.cycleKey,
          status: "error",
          errorMessage,
        });

        if (!loggedError.ok) {
          console.error("[send-reveal] unexpected-error email event was not persisted", {
            cycle_key: cycle.cycleKey,
            recipient_email: recipientEmail,
            primary_error: loggedError.primaryError,
            fallback_error: loggedError.fallbackError,
          });
          failedInserts.push({
            cycle_key: cycle.cycleKey,
            couple_id: couple.id,
            recipient_email: recipientEmail,
            status: "error",
            primary_error: loggedError.primaryError,
            fallback_error: loggedError.fallbackError,
          });
        }

        if (isDevelopment) {
          console.log("send-reveal unexpected error", recipientEmail, errorMessage);
        }
      }
    }
  }

  return NextResponse.json({
    cycleKey: cycle.cycleKey,
    sentCount,
    backfilledCount,
    skippedCount,
    failedCount,
    failedInserts,
  });
}