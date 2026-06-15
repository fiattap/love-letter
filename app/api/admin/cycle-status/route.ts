import { NextResponse } from "next/server";

import { getCurrentCycleRevealDate, getLoveLetterToday } from "@/lib/loveLetterDate";
import { supabaseServer } from "@/lib/supabaseServer";

type CycleRow = {
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

type MemberPreferenceRow = {
  email: string;
  physical_interest: boolean | null;
  delivery_type: string | null;
  subscription_status: string | null;
};

function readProvidedAdminSecret(request: Request) {
  const fromHeader = request.headers.get("x-admin-secret")?.trim();
  if (fromHeader) {
    return fromHeader;
  }

  const authHeader = request.headers.get("authorization")?.trim() ?? "";
  const bearerPrefix = "Bearer ";
  if (authHeader.startsWith(bearerPrefix)) {
    return authHeader.slice(bearerPrefix.length).trim();
  }

  const url = new URL(request.url);
  return url.searchParams.get("secret")?.trim() ?? "";
}

function isAuthorizedAdminRequest(request: Request) {
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  const expectedSecret = process.env.ADMIN_SECRET?.trim();
  if (!expectedSecret) {
    return false;
  }

  return readProvidedAdminSecret(request) === expectedSecret;
}

function padMonth(value: number) {
  return String(value).padStart(2, "0");
}

function toCycleKeyFromRevealDate(revealDate: Date) {
  return `${revealDate.getFullYear()}-${padMonth(revealDate.getMonth() + 1)}`;
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = padMonth(date.getMonth() + 1);
  const day = padMonth(date.getDate());
  return `${year}-${month}-${day}`;
}

function getRevealDateWithOffset(baseRevealDate: Date, monthOffset: number) {
  return new Date(baseRevealDate.getFullYear(), baseRevealDate.getMonth() + monthOffset, 15);
}

function getRequestedToday(request: Request) {
  const isDevelopment = process.env.NODE_ENV === "development";
  const requestUrl = new URL(request.url);
  const devDateRaw = requestUrl.searchParams.get("devDate")?.trim();

  if (!isDevelopment || !devDateRaw) {
    return getLoveLetterToday();
  }

  const parsedDevDate = new Date(devDateRaw);
  if (Number.isNaN(parsedDevDate.getTime())) {
    return getLoveLetterToday();
  }

  return parsedDevDate;
}

export async function GET(request: Request) {
  const isDevelopment = process.env.NODE_ENV === "development";

  try {

    if (!isAuthorizedAdminRequest(request)) {
      return NextResponse.json({ error: "Not authorized." }, { status: 401 });
    }

    const today = getRequestedToday(request);
    const currentRevealDate = getCurrentCycleRevealDate(today);
    const currentCycleKey = toCycleKeyFromRevealDate(currentRevealDate);

    console.log("[admin/cycle-status] Current cycle key:", currentCycleKey);

    const cycles = Array.from({ length: 9 }, (_, index) => {
      const monthOffset = index - 2;
      const revealDate = getRevealDateWithOffset(currentRevealDate, monthOffset);
      const cycleKey = toCycleKeyFromRevealDate(revealDate);

      return {
        cycleKey,
        revealDate,
        promptOpenDate: new Date(revealDate.getFullYear(), revealDate.getMonth(), 1),
        reminderDate: new Date(revealDate.getFullYear(), revealDate.getMonth(), 4),
        writingCloseDate: new Date(revealDate.getFullYear(), revealDate.getMonth(), 5),
      };
    });

    const cycleKeys = cycles.map((cycle) => cycle.cycleKey);

    const { count: totalCouples, error: couplesCountError } = await supabaseServer
      .from("couples")
      .select("*", { count: "exact", head: true });
    console.log("[admin/cycle-status] Total couples query result:", {
      count: totalCouples,
      error: couplesCountError,
    });

    const { count: totalMembers, error: membersCountError } = await supabaseServer
      .from("members")
      .select("*", { count: "exact", head: true });
    console.log("[admin/cycle-status] Total members query result:", {
      count: totalMembers,
      error: membersCountError,
    });

    const { data: membersWithPrefs, error: membersWithPrefsError } = await supabaseServer
      .from("members")
      .select("email, physical_interest, delivery_type, subscription_status");

    const memberPrefsByEmail = new Map(
      ((membersWithPrefs ?? []) as MemberPreferenceRow[])
        .filter((member) => Boolean(member.email))
        .map((member) => [member.email, member])
    );

    const premiumSubscribers = ((membersWithPrefs ?? []) as MemberPreferenceRow[]).filter(
      (member) =>
        member.subscription_status === "premium" || member.subscription_status === "active"
    ).length;

    const physicalInterestCount = ((membersWithPrefs ?? []) as MemberPreferenceRow[]).filter(
      (member) => member.physical_interest === true
    ).length;

    const physicalMembersCount = ((membersWithPrefs ?? []) as MemberPreferenceRow[]).filter(
      (member) => member.delivery_type === "physical"
    ).length;

    const baselineErrors = [
      couplesCountError && `total couples: ${couplesCountError.message}`,
      membersCountError && `total members: ${membersCountError.message}`,
      membersWithPrefsError && `members prefs: ${membersWithPrefsError.message}`,
    ].filter(Boolean) as string[];

    if (baselineErrors.length > 0) {
      console.error("[admin/cycle-status] Baseline metrics errors:", {
        errors: baselineErrors,
        couplesCountError,
        membersCountError,
        membersWithPrefsError,
      });
    }

    const { data: couples, error: couplesError } = await supabaseServer
      .from("couples")
      .select("id, partner_one_email, partner_two_email");

    if (couplesError) {
      console.error("[admin/cycle-status] couples query error:", couplesError);
    }

    const { data: prompts, error: promptsError } = await supabaseServer
      .from("prompts")
      .select("month_key, title, prompt")
      .in("month_key", cycleKeys);

    if (promptsError) {
      console.error("[admin/cycle-status] prompts query error:", promptsError);
    }

    const promptByCycleKey = new Map(
      (prompts ?? []).map((prompt) => [prompt.month_key, { title: prompt.title, prompt: prompt.prompt }])
    );

    const lettersByCycleKey = new Map<
      string,
      Array<{ writer_email: string; couple_id: number | null }>
    >();

    const { data: letters, error: lettersError } = await supabaseServer
      .from("letters")
      .select("cycle_key, writer_email, couple_id")
      .in("cycle_key", cycleKeys)
      .eq("status", "sealed");

    console.log("[admin/cycle-status] Total letters query result:", {
      count: letters?.length ?? 0,
      error: lettersError,
    });

    if (lettersError) {
      console.error("[admin/cycle-status] letters query error:", lettersError);
    }

    for (const letter of letters ?? []) {
      if (!lettersByCycleKey.has(letter.cycle_key)) {
        lettersByCycleKey.set(letter.cycle_key, []);
      }

      lettersByCycleKey.get(letter.cycle_key)?.push({
        writer_email: letter.writer_email,
        couple_id: letter.couple_id,
      });
    }

    if (isDevelopment) {
    const currentCycleLetters = lettersByCycleKey.get(currentCycleKey) ?? [];
    const writersByCurrentCouple = new Map<number, Set<string>>();

    for (const letter of currentCycleLetters) {
      if (!letter.couple_id) {
        continue;
      }

      if (!writersByCurrentCouple.has(letter.couple_id)) {
        writersByCurrentCouple.set(letter.couple_id, new Set<string>());
      }

      writersByCurrentCouple.get(letter.couple_id)?.add(letter.writer_email);
    }

    const couplesWithBothLetters = Array.from(writersByCurrentCouple.values()).filter(
      (writers) => writers.size >= 2
    ).length;

    console.log("[admin/cycle-status] current cycle letter verification", {
      cycleKey: currentCycleKey,
      lettersInCycle: currentCycleLetters.length,
      lettersMissingCoupleId: currentCycleLetters.filter((letter) => !letter.couple_id).length,
      couplesWithBothLetters,
    });
  }

    if (isDevelopment) {
    const { data: schemaColumns, error: schemaError } = await supabaseServer
      .schema("information_schema")
      .from("columns")
      .select("table_name, column_name, data_type, ordinal_position")
      .eq("table_schema", "public")
      .in("table_name", ["letters", "couples", "members"])
      .order("table_name", { ascending: true })
      .order("ordinal_position", { ascending: true });

    if (schemaError) {
      console.error("[admin/cycle-status] schema report error:", schemaError);
    } else {
      const grouped = {
        letters: (schemaColumns ?? []).filter((column) => column.table_name === "letters"),
        couples: (schemaColumns ?? []).filter((column) => column.table_name === "couples"),
        members: (schemaColumns ?? []).filter((column) => column.table_name === "members"),
      };

      console.log("[admin/cycle-status] schema report", grouped);
    }
  }

    const { data: revealEvents, error: revealEventsError } = await supabaseServer
      .from("email_events")
      .select("cycle_key, status")
      .eq("event_type", "reveal_sent")
      .in("cycle_key", cycleKeys);

    console.log("[admin/cycle-status] email_events query result:", {
      count: revealEvents?.length ?? 0,
      error: revealEventsError,
    });

    if (revealEventsError) {
      console.error("[admin/cycle-status] email_events query error:", revealEventsError);
    }

    console.log("[admin] reveal sent events", {
      total: revealEvents?.length ?? 0,
      sent: (revealEvents ?? []).filter((event) => event.status === "sent").length,
      error: (revealEvents ?? []).filter(
        (event) => event.status === "failed" || event.status === "error"
      ).length,
      sent_by_cycle: Object.fromEntries(
        cycleKeys.map((cycleKey) => [
          cycleKey,
          (revealEvents ?? []).filter(
            (event) => event.cycle_key === cycleKey && event.status === "sent"
          ).length,
        ])
      ),
    });

    const sentByCycle = new Map<string, number>();
    const errorByCycle = new Map<string, number>();
    const skippedByCycle = new Map<string, number>();

    for (const event of revealEvents ?? []) {
    if (event.status === "sent") {
      sentByCycle.set(event.cycle_key, (sentByCycle.get(event.cycle_key) ?? 0) + 1);
      continue;
    }

    if (event.status === "skipped") {
      skippedByCycle.set(event.cycle_key, (skippedByCycle.get(event.cycle_key) ?? 0) + 1);
      continue;
    }

    if (event.status === "failed" || event.status === "error") {
      errorByCycle.set(event.cycle_key, (errorByCycle.get(event.cycle_key) ?? 0) + 1);
    }
  }

    const { data: pipelineEvents, error: pipelineEventsError } = await supabaseServer
      .from("email_events")
      .select("cycle_key, status, event_type")
      .in("event_type", ["prompt", "prompt_sent", "reminder"])
      .in("cycle_key", cycleKeys);

    if (pipelineEventsError) {
      console.error("[admin/cycle-status] pipeline email_events query error:", pipelineEventsError);
    }

    const promptSentByCycle = new Map<string, number>();
    const reminderSentByCycle = new Map<string, number>();

    for (const event of pipelineEvents ?? []) {
      if (event.status !== "sent") {
        continue;
      }

      if (event.event_type === "reminder") {
        reminderSentByCycle.set(event.cycle_key, (reminderSentByCycle.get(event.cycle_key) ?? 0) + 1);
      } else {
        promptSentByCycle.set(event.cycle_key, (promptSentByCycle.get(event.cycle_key) ?? 0) + 1);
      }
    }

    const totalCouplesValue = totalCouples ?? 0;
    const couplesById = new Map((couples ?? []).map((couple) => [couple.id, couple]));

    const cycleRows: CycleRow[] = cycles.map((cycle) => {
    const promptRecord = promptByCycleKey.get(cycle.cycleKey);
    const promptText = promptRecord?.prompt ?? "";
    const promptTitle = promptRecord?.title ?? "Love Letter";
    const cycleLetters = lettersByCycleKey.get(cycle.cycleKey) ?? [];
    const writersByCoupleId = new Map<number, Set<string>>();

    for (const letter of cycleLetters) {
      if (!letter.couple_id) {
        continue;
      }

      if (!writersByCoupleId.has(letter.couple_id)) {
        writersByCoupleId.set(letter.couple_id, new Set<string>());
      }

      writersByCoupleId.get(letter.couple_id)?.add(letter.writer_email);
    }

    const couplesReadyForReveal = (couples ?? []).filter((couple) => {
      if (!couple.id || !couple.partner_one_email || !couple.partner_two_email) {
        return false;
      }

      const coupleWriters = writersByCoupleId.get(couple.id);
      if (!coupleWriters) {
        return false;
      }

      return (
        coupleWriters.has(couple.partner_one_email) &&
        coupleWriters.has(couple.partner_two_email)
      );
    }).length;

    const activeCouplesInCycle = writersByCoupleId.size;

    const physicalRequests = Array.from(writersByCoupleId.keys()).filter((coupleId) => {
      const couple = couplesById.get(coupleId);
      if (!couple) {
        return false;
      }

      const partnerOne = couple.partner_one_email
        ? memberPrefsByEmail.get(couple.partner_one_email)
        : null;
      const partnerTwo = couple.partner_two_email
        ? memberPrefsByEmail.get(couple.partner_two_email)
        : null;

      const partnerOneRequested =
        partnerOne?.physical_interest === true || partnerOne?.delivery_type === "physical";
      const partnerTwoRequested =
        partnerTwo?.physical_interest === true || partnerTwo?.delivery_type === "physical";

      return partnerOneRequested || partnerTwoRequested;
    }).length;

    const couplesMissingLetters = Math.max(activeCouplesInCycle - couplesReadyForReveal, 0);

    return {
      cycle_key: cycle.cycleKey,
      prompt_open_date: toIsoDate(cycle.promptOpenDate),
      reminder_date: toIsoDate(cycle.reminderDate),
      writing_close_date: toIsoDate(cycle.writingCloseDate),
      reveal_date: toIsoDate(cycle.revealDate),
      prompt_title: promptTitle,
      prompt_text: promptText,
      total_couples: activeCouplesInCycle,
      couples_ready_for_reveal: couplesReadyForReveal,
      couples_missing_letters: couplesMissingLetters,
      total_letters_written: cycleLetters.length,
      reveal_emails_sent: sentByCycle.get(cycle.cycleKey) ?? 0,
      reveal_email_errors: errorByCycle.get(cycle.cycleKey) ?? 0,
      reveal_email_status: (() => {
        const sentCount = sentByCycle.get(cycle.cycleKey) ?? 0;
        const errorCount = errorByCycle.get(cycle.cycleKey) ?? 0;
        const expectedRecipients = couplesReadyForReveal * 2;

        if (errorCount > 0) {
          return "Error";
        }

        if (sentCount === 0) {
          return "Not sent";
        }

        if (expectedRecipients > 0 && sentCount >= expectedRecipients) {
          return "Sent";
        }

        return "Partial";
      })(),
      prompt_emails_sent: promptSentByCycle.get(cycle.cycleKey) ?? 0,
      reminder_emails_sent: reminderSentByCycle.get(cycle.cycleKey) ?? 0,
      physical_requests: physicalRequests,
    };
  });

    const responsePayload = {
      current_cycle_key: currentCycleKey,
      total_members: totalMembers ?? 0,
      premium_subscribers: premiumSubscribers,
      configured_total_couples: totalCouplesValue,
      raw_counts: {
        couples: couples?.length ?? 0,
        letters: letters?.length ?? 0,
        email_events: revealEvents?.length ?? 0,
      },
      reveal_emails_skipped_count: cycleRows.reduce(
        (sum, cycleRow) => sum + (skippedByCycle.get(cycleRow.cycle_key) ?? 0),
        0
      ),
      physical_interest_count: physicalInterestCount ?? 0,
      physical_members_count: physicalMembersCount ?? 0,
      cycles: cycleRows,
    };

    const queryDebug = {
      currentCycleKey,
      baseline: {
        couplesCountError: couplesCountError?.message,
        membersCountError: membersCountError?.message,
        membersWithPrefsError: membersWithPrefsError?.message,
      },
      couplesError: couplesError?.message,
      promptsError: promptsError?.message,
      lettersError: lettersError?.message,
      revealEventsError: revealEventsError?.message,
    };

    const nonFatalErrors = [
      ...baselineErrors,
      couplesError && `couples rows: ${couplesError.message}`,
      promptsError && `prompts: ${promptsError.message}`,
      lettersError && `letters: ${lettersError.message}`,
      revealEventsError && `email_events: ${revealEventsError.message}`,
    ].filter(Boolean) as string[];

    if (nonFatalErrors.length > 0) {
      const debugMessage = nonFatalErrors.join(" | ");
      return NextResponse.json({
        ...responsePayload,
        error: isDevelopment ? debugMessage : "Could not load baseline metrics.",
        debug: {
          ...queryDebug,
          errors: nonFatalErrors,
        },
        partial: true,
      });
    }

    return NextResponse.json(responsePayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected cycle status failure.";
    console.error("[admin/cycle-status] uncaught error", error);

    return NextResponse.json(
      {
        error: "Could not load baseline metrics.",
        debug: {
          message,
        },
      },
      { status: 500 }
    );
  }
}
