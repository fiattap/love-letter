"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type CycleStatusRow = {
  cycle_key: string;
  prompt_open_date: string;
  reminder_date: string;
  writing_close_date: string;
  reveal_date: string;
  prompt_title: string;
  prompt_text: string;
  total_couples: number;
  couples_ready_for_reveal: number;
  couples_missing_letters: number;
  total_letters_written: number;
  reveal_emails_sent: number;
  reveal_email_errors: number;
  reveal_email_status: "Not sent" | "Sent" | "Partial" | "Error";
  prompt_emails_sent: number;
  reminder_emails_sent: number;
  physical_requests: number;
};

type CycleStatusResponse = {
  current_cycle_key: string;
  total_members: number;
  premium_subscribers: number;
  configured_total_couples?: number;
  reveal_emails_skipped_count: number;
  physical_interest_count: number;
  physical_members_count: number;
  cycles: CycleStatusRow[];
  error?: string;
  debug?: unknown;
  partial?: boolean;
};

type SendResult = {
  cycleKey?: string;
  sentCount?: number;
  backfilledCount?: number;
  skippedCount?: number;
  failedCount?: number;
  failedInserts?: Array<{
    recipient_email: string;
    primary_error?: { message?: string; code?: string };
    fallback_error?: { message?: string; code?: string };
  }>;
  error?: string;
};

function StatusPill({ value }: { value: string }) {
  const styles =
    value === "Sent"
      ? "border-[#cdd9c3] bg-[#f4f8ef] text-[#5b7b52]"
      : value === "Partial"
        ? "border-[#e4d2b0] bg-[#fdf6e8] text-[#8a6f3a]"
        : value === "Error"
          ? "border-[#e7c9c5] bg-[#fff6f5] text-[#b2564f]"
          : "border-[#e2d2c4] bg-[#fbf6f1] text-[#9a8a82]";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.12em] ${styles}`}
    >
      {value}
    </span>
  );
}

export default function AdminDashboardClient({
  adminSecret,
}: {
  adminSecret: string;
}) {
  const isDevelopment = process.env.NODE_ENV === "development";
  const [status, setStatus] = useState<CycleStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState("");

  const [sendingCycleKey, setSendingCycleKey] = useState<string | null>(null);
  const [sendingPromptCycleKey, setSendingPromptCycleKey] = useState<string | null>(null);
  const [sendingReminderCycleKey, setSendingReminderCycleKey] = useState<string | null>(null);
  const [sendResultsByCycle, setSendResultsByCycle] = useState<Record<string, SendResult>>({});

  const getSimulatedDate = useCallback(() => {
    if (!isDevelopment || typeof window === "undefined") {
      return "";
    }

    return window.localStorage.getItem("love-letter-dev-date") ?? "";
  }, [isDevelopment]);

  const statusApiUrl = useMemo(() => {
    const params = new URLSearchParams();

    if (adminSecret) {
      params.set("secret", adminSecret);
    }

    const devDate = getSimulatedDate();
    if (devDate) {
      params.set("devDate", devDate);
    }

    const query = params.toString();
    return query ? `/api/admin/cycle-status?${query}` : "/api/admin/cycle-status";
  }, [adminSecret, getSimulatedDate]);

  const sendRevealApiUrl = useMemo(() => {
    if (adminSecret) {
      return `/api/send-reveal?cronSecret=${encodeURIComponent(adminSecret)}`;
    }

    return "/api/send-reveal";
  }, [adminSecret]);

  const promptApiUrl = useMemo(
    () =>
      adminSecret
        ? `/api/dev/send-cycle-prompt?secret=${encodeURIComponent(adminSecret)}`
        : "/api/dev/send-cycle-prompt",
    [adminSecret]
  );

  const reminderApiUrl = useMemo(
    () =>
      adminSecret
        ? `/api/dev/send-cycle-reminder?secret=${encodeURIComponent(adminSecret)}`
        : "/api/dev/send-cycle-reminder",
    [adminSecret]
  );

  const loadCycleStatus = useCallback(async () => {
    setLoadingStatus(true);
    setStatusError("");

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => {
        controller.abort();
      }, 10000);

      const response = await fetch(statusApiUrl, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);

      const rawBody = await response.text();
      console.log("[admin] cycle-status response status", response.status);
      console.log("[admin] cycle-status response body", rawBody);

      let result: CycleStatusResponse | null = null;
      try {
        result = JSON.parse(rawBody) as CycleStatusResponse;
      } catch (parseError) {
        const parseMessage =
          parseError instanceof Error ? parseError.message : "Could not parse JSON response.";
        const message = isDevelopment
          ? `Debug: ${parseMessage}`
          : "Could not load baseline metrics.";
        console.error("[admin] cycle-status JSON parse error", {
          status: response.status,
          body: rawBody,
          error: parseMessage,
        });
        setStatusError(message);
        setStatus(null);
        return;
      }

      if (!response.ok || result.error) {
        console.error("[admin] cycle-status error", {
          status: response.status,
          result,
        });
      } else if (process.env.NODE_ENV === "development") {
        console.log("[admin] cycle-status loaded", result);
      }

      if (!response.ok) {
        const message =
          isDevelopment && result.error
            ? `Debug: ${result.error}`
            : result.error ?? "Could not load baseline metrics.";
        setStatusError(message);
        if (Array.isArray(result.cycles)) {
          setStatus(result);
        } else {
          setStatus(null);
        }
        return;
      }

      setStatus(result);
      if (result.error) {
        setStatusError(isDevelopment ? `Debug: ${result.error}` : "Could not load baseline metrics.");
      }
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === "AbortError";
      const message =
        error instanceof Error
          ? error.message
          : "Could not load baseline metrics.";
      console.error("[admin] cycle-status caught error", error);
      setStatusError(
        isDevelopment
          ? `Debug: ${isAbort ? "Request timed out after 10 seconds." : message}`
          : "Could not load baseline metrics."
      );
      setStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  }, [isDevelopment, statusApiUrl]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCycleStatus();
  }, [loadCycleStatus]);

  const handleSendRevealEmails = async (cycleKey: string, revealDate: string) => {
    setSendingCycleKey(cycleKey);
    setSendResultsByCycle((current) => {
      const next = { ...current };
      delete next[cycleKey];
      return next;
    });

    const devDate = getSimulatedDate();
    const requestDevDate = revealDate || devDate || null;

    try {
      const response = await fetch(sendRevealApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cycleKey,
          cycle_key: cycleKey,
          devDate: requestDevDate,
          force: true,
          forceResend: false,
        }),
      });

      const result = (await response.json()) as SendResult;
      if (!response.ok) {
        setSendResultsByCycle((current) => ({
          ...current,
          [cycleKey]: {
            error: result.error ?? "Could not send reveal emails.",
          },
        }));
        setSendingCycleKey(null);
        return;
      }

      setSendResultsByCycle((current) => ({
        ...current,
        [cycleKey]: {
          cycleKey: result.cycleKey,
          sentCount: result.sentCount ?? 0,
          skippedCount: result.skippedCount ?? 0,
          failedCount: result.failedCount ?? 0,
        },
      }));

      await loadCycleStatus();
    } catch {
      setSendResultsByCycle((current) => ({
        ...current,
        [cycleKey]: {
          error: "Could not send reveal emails.",
        },
      }));
    }

    setSendingCycleKey(null);
  };

  const handleSendPrompt = async (cycleKey: string) => {
    setSendingPromptCycleKey(cycleKey);
    setSendResultsByCycle((current) => {
      const next = { ...current };
      delete next[cycleKey];
      return next;
    });

    try {
      const response = await fetch(promptApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simulatedDate: getSimulatedDate() || null }),
      });
      const result = (await response.json()) as SendResult;

      if (!response.ok) {
        setSendResultsByCycle((current) => ({
          ...current,
          [cycleKey]: { error: result.error ?? "Could not send prompt emails." },
        }));
      } else {
        setSendResultsByCycle((current) => ({
          ...current,
          [cycleKey]: {
            sentCount: result.sentCount ?? 0,
            skippedCount: result.skippedCount ?? 0,
            failedCount: result.failedCount ?? 0,
          },
        }));
        await loadCycleStatus();
      }
    } catch {
      setSendResultsByCycle((current) => ({
        ...current,
        [cycleKey]: { error: "Could not send prompt emails." },
      }));
    }

    setSendingPromptCycleKey(null);
  };

  const handleSendReminder = async (cycleKey: string) => {
    setSendingReminderCycleKey(cycleKey);
    setSendResultsByCycle((current) => {
      const next = { ...current };
      delete next[cycleKey];
      return next;
    });

    try {
      const response = await fetch(reminderApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simulatedDate: getSimulatedDate() || null }),
      });
      const result = (await response.json()) as SendResult;

      if (!response.ok) {
        setSendResultsByCycle((current) => ({
          ...current,
          [cycleKey]: { error: result.error ?? "Could not send reminder emails." },
        }));
      } else {
        setSendResultsByCycle((current) => ({
          ...current,
          [cycleKey]: {
            sentCount: result.sentCount ?? 0,
            skippedCount: result.skippedCount ?? 0,
            failedCount: result.failedCount ?? 0,
          },
        }));
        await loadCycleStatus();
      }
    } catch {
      setSendResultsByCycle((current) => ({
        ...current,
        [cycleKey]: { error: "Could not send reminder emails." },
      }));
    }

    setSendingReminderCycleKey(null);
  };

  const currentCycle =
    status?.cycles.find((cycle) => cycle.cycle_key === status.current_cycle_key) ??
    status?.cycles[0] ??
    null;

  const currentRevealDateUi = currentCycle
    ? new Date(`${currentCycle.reveal_date}T00:00:00`).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "-";

  return (
    <main className="min-h-screen bg-[#fbf6f1] px-5 py-8 text-[#161313] sm:px-8 sm:py-10 lg:px-12">
      <div className="mx-auto w-full max-w-[1180px]">
        <header className="border-b border-[#eadbd0] pb-7 sm:pb-8">
          <p className="font-serif text-2xl tracking-[0.2em] sm:text-3xl sm:tracking-[0.22em]">
            LOVE LETTER ADMIN
          </p>
        </header>

        <section className="mt-8 rounded-2xl border border-[#eadbd0] bg-[#fffaf6] p-6 shadow-[0_16px_42px_rgba(53,35,31,0.09)] sm:p-8">
          <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
            {currentCycle ? `${currentRevealDateUi} Reveal` : "Reveal Cycle"}
          </h1>

          {loadingStatus ? (
            <p className="mt-4 text-sm text-[#6f5b58]">Loading cycle metrics...</p>
          ) : statusError ? (
            <p className="mt-4 text-sm text-[#b2564f]">{statusError}</p>
          ) : null}

          {status && currentCycle ? (
            <>
              <p className="mt-4 text-base text-[#4e4440]">{currentCycle.prompt_title}</p>
              <p className="mt-2 text-base text-[#4e4440]">
                {currentCycle.prompt_text
                  ? `Current prompt: "${currentCycle.prompt_text}"`
                  : "No prompt configured for this cycle."}
              </p>

              <div className="mt-6 grid gap-3 rounded-xl border border-[#eadbd0] bg-[#fffdfb] p-4 text-sm text-[#4e4440] sm:grid-cols-2 lg:grid-cols-3">
                <p>Reveal date: {currentRevealDateUi}</p>
                <p>Total couples: {currentCycle.total_couples}</p>
                <p>
                  Premium couples: {status.premium_subscribers ?? 0}{" "}
                  <a
                    href={
                      adminSecret
                        ? `/admin/premium?secret=${encodeURIComponent(adminSecret)}`
                        : "/admin/premium"
                    }
                    className="font-semibold text-[#c97972] underline underline-offset-2"
                  >
                    Manage →
                  </a>
                </p>
                <p>Couples ready for reveal: {currentCycle.couples_ready_for_reveal}</p>
                <p>Couples missing letters: {currentCycle.couples_missing_letters}</p>
                <p>Total letters written: {currentCycle.total_letters_written}</p>
                <p>Reveal emails sent: {currentCycle.reveal_emails_sent}</p>
                <p>Reveal email errors: {currentCycle.reveal_email_errors}</p>
                <p>Physical requested: {currentCycle.physical_requests}</p>
              </div>

              <div className="mt-6 rounded-xl border border-[#eadbd0] bg-[#fffdfb] p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6f5b58]">
                  Send this cycle manually
                </p>
                <p className="mt-1 text-xs text-[#8d7a72]">
                  Active cycle {currentCycle.cycle_key} · prompt the 1st, reminder the 4th, reveal the
                  15th. Sends are idempotent — they won&apos;t double-send.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => handleSendPrompt(currentCycle.cycle_key)}
                    disabled={sendingPromptCycleKey === currentCycle.cycle_key}
                    className="rounded-md border border-[#cdb196] bg-[#f3ece1] px-5 py-3 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[#6f5b58] transition enabled:hover:bg-[#ece2d3] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {sendingPromptCycleKey === currentCycle.cycle_key
                      ? "Sending..."
                      : "1 · Send Prompt (Writing Opens)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendReminder(currentCycle.cycle_key)}
                    disabled={sendingReminderCycleKey === currentCycle.cycle_key}
                    className="rounded-md border border-[#cdb196] bg-[#f3ece1] px-5 py-3 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[#6f5b58] transition enabled:hover:bg-[#ece2d3] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {sendingReminderCycleKey === currentCycle.cycle_key
                      ? "Sending..."
                      : "2 · Send Reminder"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleSendRevealEmails(currentCycle.cycle_key, currentCycle.reveal_date)
                    }
                    disabled={sendingCycleKey === currentCycle.cycle_key}
                    className="rounded-md bg-[#c97972] px-5 py-3 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-white shadow-[0_10px_20px_rgba(201,121,114,0.2)] transition enabled:hover:bg-[#b86b65] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {sendingCycleKey === currentCycle.cycle_key
                      ? "Sending..."
                      : "3 · Send the Letter (Reveal)"}
                  </button>
                </div>
                {sendResultsByCycle[currentCycle.cycle_key] ? (
                  sendResultsByCycle[currentCycle.cycle_key].error ? (
                    <p className="mt-3 text-xs text-[#b2564f]">
                      {sendResultsByCycle[currentCycle.cycle_key].error}
                    </p>
                  ) : (
                    <p className="mt-3 text-xs text-[#6f5b58]">
                      Sent: {sendResultsByCycle[currentCycle.cycle_key].sentCount ?? 0} · Skipped:{" "}
                      {sendResultsByCycle[currentCycle.cycle_key].skippedCount ?? 0} · Errors:{" "}
                      {sendResultsByCycle[currentCycle.cycle_key].failedCount ?? 0}
                    </p>
                  )
                ) : null}
              </div>

              <div className="mt-6 overflow-x-auto rounded-xl border border-[#eadbd0] bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#fff8f2] text-[#6f5b58]">
                    <tr>
                      <th className="px-4 py-3 font-bold">Cycle</th>
                      <th className="px-4 py-3 font-bold">Reveal Date</th>
                      <th className="px-4 py-3 font-bold">Couples Completed</th>
                      <th className="px-4 py-3 font-bold">Prompt</th>
                      <th className="px-4 py-3 font-bold">Reminder</th>
                      <th className="px-4 py-3 font-bold">Reveal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.cycles.map((cycle) => (
                      <tr key={cycle.cycle_key} className="border-t border-[#eadbd0] text-[#342d2a]">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span>{cycle.cycle_key}</span>
                            {status.current_cycle_key === cycle.cycle_key ? (
                              <span className="rounded-full border border-[#d9c3b4] bg-[#fff3ea] px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-[#8f4f4a]">
                                Active
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">{cycle.reveal_date}</td>
                        <td className="px-4 py-3">
                          {cycle.couples_ready_for_reveal} / {cycle.total_couples}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill value={cycle.prompt_emails_sent > 0 ? "Sent" : "Not sent"} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill value={cycle.reminder_emails_sent > 0 ? "Sent" : "Not sent"} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill value={cycle.reveal_email_status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <PrintedLettersPanel adminSecret={adminSecret} cycleKey={currentCycle.cycle_key} />
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}

type ShipmentAddress = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
} | null;

type ShipmentCouple = {
  coupleId: string;
  partnerOneEmail: string | null;
  partnerTwoEmail: string | null;
  shippingName: string | null;
  shippingAddress: ShipmentAddress;
  status: "pending" | "shipped";
  shippedAt: string | null;
};

function formatShippingAddress(address: ShipmentAddress) {
  if (!address) {
    return "No address on file";
  }

  const cityLine = [address.city, address.state, address.postal_code]
    .filter(Boolean)
    .join(", ");
  const parts = [address.line1, address.line2, cityLine, address.country].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "No address on file";
}

function PrintedLettersPanel({
  adminSecret,
  cycleKey,
}: {
  adminSecret: string;
  cycleKey: string;
}) {
  const [couples, setCouples] = useState<ShipmentCouple[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (adminSecret) {
      params.set("secret", adminSecret);
    }
    if (cycleKey) {
      params.set("cycleKey", cycleKey);
    }
    const query = params.toString();
    return query ? `/api/admin/shipments?${query}` : "/api/admin/shipments";
  }, [adminSecret, cycleKey]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(apiUrl, { method: "GET", cache: "no-store" });
      const data = (await response.json()) as { couples?: ShipmentCouple[]; error?: string };
      if (!response.ok || data.error) {
        setError(data.error ?? "Could not load printed-letter shipments.");
        setCouples([]);
        return;
      }
      setCouples(data.couples ?? []);
    } catch {
      setError("Could not load printed-letter shipments.");
      setCouples([]);
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const markShipped = async (coupleId: string, shipped: boolean) => {
    setSavingId(coupleId);
    try {
      const params = new URLSearchParams();
      if (adminSecret) {
        params.set("secret", adminSecret);
      }
      const query = params.toString();
      const response = await fetch(
        query ? `/api/admin/shipments?${query}` : "/api/admin/shipments",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coupleId, cycleKey, shipped }),
        }
      );
      if (response.ok) {
        await load();
      }
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="mt-8 rounded-xl border border-[#eadbd0] bg-[#fffdfb] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6f5b58]">
        Printed letters · {cycleKey}
      </p>
      <p className="mt-1 text-xs text-[#8d7a72]">
        Premium couples for this cycle. Mark each as shipped once you mail their printed letters.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-[#8d7a72]">Loading…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-[#b2564f]">{error}</p>
      ) : couples.length === 0 ? (
        <p className="mt-4 text-sm text-[#8d7a72]">No premium couples yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#eadbd0] text-[0.7rem] uppercase tracking-[0.12em] text-[#9a8a82]">
                <th className="px-3 py-2 font-bold">Couple</th>
                <th className="px-3 py-2 font-bold">Mailing address</th>
                <th className="px-3 py-2 font-bold">Status</th>
                <th className="px-3 py-2 font-bold">Action</th>
              </tr>
            </thead>
            <tbody>
              {couples.map((couple) => (
                <tr key={couple.coupleId} className="border-b border-[#f1e7dd] align-top">
                  <td className="px-3 py-3 text-[#4e4440]">
                    {couple.shippingName ? (
                      <div className="font-semibold">{couple.shippingName}</div>
                    ) : null}
                    <div className="text-xs text-[#8d7a72]">{couple.partnerOneEmail}</div>
                    <div className="text-xs text-[#8d7a72]">{couple.partnerTwoEmail}</div>
                  </td>
                  <td className="px-3 py-3 text-xs text-[#6f5b58]">
                    {formatShippingAddress(couple.shippingAddress)}
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill value={couple.status === "shipped" ? "Sent" : "Not sent"} />
                    {couple.shippedAt ? (
                      <div className="mt-1 text-[0.65rem] text-[#9a8a82]">
                        {new Date(couple.shippedAt).toLocaleDateString()}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      disabled={savingId === couple.coupleId}
                      onClick={() => markShipped(couple.coupleId, couple.status !== "shipped")}
                      className="rounded-md border border-[#d9c7ba] bg-[#fff8f2] px-3 py-2 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[#6f5b58] transition hover:bg-[#fbeee3] disabled:opacity-50"
                    >
                      {savingId === couple.coupleId
                        ? "Saving…"
                        : couple.status === "shipped"
                          ? "Mark not shipped"
                          : "Mark shipped"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
