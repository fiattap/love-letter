import { Resend } from "resend";

import { supabase } from "@/lib/supabase";

type EmailType = "prompt" | "prompt_sent" | "reminder" | "reveal";

type StationeryEmailOptions = {
  title: string;
  promptText: string;
  leadText: string;
  supportingText: string;
  buttonText: string;
  buttonUrl: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildStationeryEmailHtml(options: StationeryEmailOptions) {
  const safeTitle = escapeHtml(options.title);
  const safePrompt = escapeHtml(options.promptText);
  const safeLead = escapeHtml(options.leadText);
  const safeSupporting = escapeHtml(options.supportingText);
  const safeButtonText = escapeHtml(options.buttonText);
  const safeButtonUrl = escapeHtml(options.buttonUrl);

  return `
    <div style="margin:0;background:#fbf6f1;padding:32px 16px;color:#161313;font-family:Georgia,'Times New Roman',serif;">
      <div style="margin:0 auto;max-width:620px;border:1px solid #eadbd0;border-radius:24px;background:#fffaf6;box-shadow:0 18px 40px rgba(53,35,31,0.08);overflow:hidden;">
        <div style="padding:40px 28px;text-align:center;">
          <div style="font-size:28px;letter-spacing:0.22em;line-height:1.2;">
            LOVE LETTER <span style="color:#c97972;">♡</span>
          </div>

          <h1 style="margin:28px 0 0;font-size:36px;line-height:1.15;font-weight:400;">
            ${safeTitle}
          </h1>

          <p style="margin:28px 0 0;font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:#6f5b58;font-family:Arial,Helvetica,sans-serif;font-weight:700;">
            This month’s question
          </p>

          <p style="margin:18px auto 0;max-width:460px;font-size:24px;line-height:1.7;color:#161313;">
            ${safePrompt}
          </p>

          <p style="margin:28px auto 0;max-width:470px;font-size:18px;line-height:1.8;color:#4e4440;">
            ${safeLead}
          </p>

          <p style="margin:12px auto 0;max-width:500px;font-size:18px;line-height:1.8;color:#4e4440;">
            ${safeSupporting}
          </p>

          <div style="margin-top:32px;">
            <a href="${safeButtonUrl}" style="display:inline-block;border-radius:8px;background:#c97972;color:#ffffff;text-decoration:none;padding:16px 28px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;font-weight:700;box-shadow:0 12px 30px rgba(201,121,114,0.22);">
              ${safeButtonText}
            </a>
          </div>

          <p style="margin:36px 0 0;font-size:18px;line-height:1.8;color:#4e4440;">
            With love,<br />
            Love Letter Team <span style="color:#c97972;">♡</span>
          </p>
        </div>
      </div>
    </div>
  `;
}

export function buildStationeryEmailText(options: StationeryEmailOptions) {
  return `LOVE LETTER ♡\n\n${options.title}\n\nThis month's question:\n${options.promptText}\n\n${options.leadText}\n\n${options.supportingText}\n\n${options.buttonText}: ${options.buttonUrl}\n\nWith love,\nLove Letter Team ♡`;
}

export function getAppBaseUrl() {
  const appBaseUrl =
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";
  return appBaseUrl.replace(/\/$/, "");
}

export function ensureManualRouteGuard(request: Request) {
  const isDevelopment = process.env.NODE_ENV === "development";
  if (isDevelopment) {
    return null;
  }

  const allowedSecrets = [
    process.env.SEND_PROMPT_ADMIN_KEY,
    process.env.ADMIN_SECRET,
    process.env.CRON_SECRET,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  if (allowedSecrets.length === 0) {
    return "Manual cycle routes are disabled.";
  }

  const headerKey = request.headers.get("x-admin-key")?.trim() ?? "";
  const authHeader = request.headers.get("authorization")?.trim() ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  const queryKey = new URL(request.url).searchParams.get("secret")?.trim() ?? "";
  const provided = headerKey || bearer || queryKey;

  if (provided && allowedSecrets.includes(provided)) {
    return null;
  }

  return "You are not allowed to trigger cycle emails.";
}

export async function hasSentEmailEvent(email: string, eventType: EmailType, cycleKey: string) {
  const { data, error } = await supabase
    .from("email_events")
    .select("id")
    .eq("email", email)
    .eq("event_type", eventType)
    .eq("cycle_key", cycleKey)
    .eq("status", "sent")
    .limit(1)
    .maybeSingle();

  if (error) {
    return false;
  }

  return Boolean(data);
}

export async function logEmailEvent(options: {
  email: string;
  eventType: EmailType;
  cycleKey: string;
  status: "sent" | "failed";
  resendId?: string | null;
  error?: string | null;
}) {
  await supabase.from("email_events").insert({
    email: options.email,
    event_type: options.eventType,
    cycle_key: options.cycleKey,
    status: options.status,
    resend_id: options.resendId ?? null,
    error: options.error ?? null,
  });
}

export async function sendSingleCycleEmail(options: {
  resend: Resend;
  email: string;
  eventType: EmailType;
  cycleKey: string;
  subject: string;
  html: string;
  text: string;
}) {
  const alreadySent = await hasSentEmailEvent(options.email, options.eventType, options.cycleKey);
  if (alreadySent) {
    return { skipped: true as const };
  }

  const response = await options.resend.emails.send({
    from: "Love Letter Team <hello@theloveletter.co>",
    to: options.email,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });

  if (response.error) {
    await logEmailEvent({
      email: options.email,
      eventType: options.eventType,
      cycleKey: options.cycleKey,
      status: "failed",
      error: response.error.message,
    });

    return {
      skipped: false as const,
      failed: true as const,
      error: response.error.message,
    };
  }

  await logEmailEvent({
    email: options.email,
    eventType: options.eventType,
    cycleKey: options.cycleKey,
    status: "sent",
    resendId: response.data?.id ?? null,
  });

  return {
    skipped: false as const,
    failed: false as const,
    id: response.data?.id ?? null,
  };
}
