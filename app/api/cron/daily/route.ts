import { NextResponse } from "next/server";
import { Resend } from "resend";

import { getAppBaseUrl } from "@/lib/cycleEmail";
import { getCycleScheduleFromMonthKey, getLoveLetterToday } from "@/lib/loveLetterDate";
import { loadActivePrompt } from "@/lib/prompts";

// Daily dispatcher for the monthly cycle emails.
// Vercel cron hits this once a day (GET). It checks today against the active
// cycle schedule and triggers the matching send — prompt on the 1st, reminder
// on the 4th, reveal on the 15th. Each underlying route is idempotent via
// email_events, so this can never double-send, and a manual trigger of those
// routes still works independently.

function readProvidedSecret(request: Request) {
  const authHeader = request.headers.get("authorization")?.trim() ?? "";
  const bearerPrefix = "Bearer ";
  if (authHeader.startsWith(bearerPrefix)) {
    return authHeader.slice(bearerPrefix.length).trim();
  }

  const headerSecret = request.headers.get("x-cron-secret")?.trim();
  if (headerSecret) {
    return headerSecret;
  }

  return new URL(request.url).searchParams.get("cronSecret")?.trim() ?? "";
}

function isAuthorized(request: Request) {
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  const configuredSecret = process.env.CRON_SECRET?.trim();
  const adminSecret = process.env.ADMIN_SECRET?.trim();
  const providedSecret = readProvidedSecret(request);

  if (configuredSecret || adminSecret) {
    return (
      Boolean(providedSecret) &&
      (providedSecret === configuredSecret || providedSecret === adminSecret)
    );
  }

  // If no secret is configured, only allow genuine Vercel cron invocations.
  return request.headers.get("x-vercel-cron") === "1";
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

async function triggerRoute(path: string, headers: Record<string, string>, body: unknown) {
  const url = `${getAppBaseUrl()}${path}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body ?? {}),
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Request failed",
    };
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional ?date=YYYY-MM-DD override for testing (the route is already secret-gated).
  const override = new URL(request.url).searchParams.get("date");
  const parsedOverride = override ? new Date(override) : null;
  const today =
    parsedOverride && !Number.isNaN(parsedOverride.getTime())
      ? parsedOverride
      : getLoveLetterToday();

  const activePrompt = await loadActivePrompt();
  if (!activePrompt) {
    return NextResponse.json({ ran: [], reason: "No active prompt" });
  }

  const cycle = getCycleScheduleFromMonthKey(activePrompt.month_key);
  if (!cycle) {
    return NextResponse.json({ ran: [], reason: "Invalid cycle month key" });
  }

  const adminKey = process.env.SEND_PROMPT_ADMIN_KEY ?? "";
  const cronSecret = process.env.CRON_SECRET?.trim() || process.env.ADMIN_SECRET?.trim() || "";
  const cycleBody = { cycleKey: cycle.cycleKey, cycle_key: cycle.cycleKey };

  const results: Array<{ action: string; result: unknown }> = [];

  if (isSameDay(today, cycle.promptSendDate)) {
    results.push({
      action: "prompt",
      result: await triggerRoute(
        "/api/dev/send-cycle-prompt",
        { "x-admin-key": adminKey },
        cycleBody
      ),
    });
  }

  if (isSameDay(today, cycle.reminderSendDate)) {
    results.push({
      action: "reminder",
      result: await triggerRoute(
        "/api/dev/send-cycle-reminder",
        { "x-admin-key": adminKey },
        cycleBody
      ),
    });
  }

  if (isSameDay(today, cycle.revealDate)) {
    results.push({
      action: "reveal",
      result: await triggerRoute(
        "/api/send-reveal",
        { authorization: `Bearer ${cronSecret}` },
        cycleBody
      ),
    });
  }

  const summary = {
    date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`,
    cycleKey: cycle.cycleKey,
    ran: results.map((entry) => entry.action),
    results,
  };

  console.log("[cron/daily] run summary", JSON.stringify(summary));

  // Notify yourself whenever the cron actually triggered a send, so you know it ran.
  const notifyEmail = process.env.CRON_SUMMARY_EMAIL?.trim();
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  if (results.length > 0 && notifyEmail && resendApiKey) {
    try {
      const resend = new Resend(resendApiKey);
      await resend.emails.send({
        from: "Love Letter Cron <hello@theloveletter.co>",
        to: notifyEmail,
        subject: `Love Letter cron — ${summary.ran.join(", ")} (${summary.cycleKey})`,
        text: `The daily cron ran on ${summary.date} for cycle ${summary.cycleKey}.\n\nActions: ${summary.ran.join(", ")}\n\nDetails:\n${JSON.stringify(summary.results, null, 2)}`,
      });
    } catch (error) {
      console.error("[cron/daily] summary notification failed", error);
    }
  }

  return NextResponse.json(summary);
}
