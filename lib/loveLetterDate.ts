export const LOVE_LETTER_DEV_DATE_KEY = "love-letter-dev-date";

type WritingWindow = {
  writingOpens: Date;
  writingCloses: Date;
  revealUnlocks: Date;
};

export type CycleSchedule = {
  cycleKey: string;
  promptSendDate: Date;
  reminderSendDate: Date;
  writingCloseDate: Date;
  revealDate: Date;
};

export type SignupCycleState = {
  phase: "before" | "during" | "after";
  writingWindow: WritingWindow;
  nextWritingOpens: Date;
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function isValidDate(value: Date) {
  return !Number.isNaN(value.getTime());
}

export function getLoveLetterToday() {
  const now = new Date();

  if (process.env.NODE_ENV !== "development") {
    return now;
  }

  if (typeof window === "undefined") {
    return now;
  }

  const storedDate = window.localStorage.getItem(LOVE_LETTER_DEV_DATE_KEY);
  if (!storedDate) {
    return now;
  }

  const overrideDate = new Date(storedDate);
  if (!isValidDate(overrideDate)) {
    return now;
  }

  return overrideDate;
}

export function getRevealDateFromMonthKey(monthKey: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    return null;
  }

  const revealDate = new Date(year, month - 1, 15);
  return isValidDate(revealDate) ? revealDate : null;
}

function formatMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function getRevealDateForToday(today = getLoveLetterToday()) {
  const baseDate = startOfDay(today);
  let year = baseDate.getFullYear();
  let month = baseDate.getMonth();

  if (baseDate.getDate() > 5) {
    month += 1;
  }

  if (month > 11) {
    month = 0;
    year += 1;
  }

  return new Date(year, month, 15);
}

// The cycle the couple is currently "in" for display/prompt selection.
// Through reveal day (the 15th) you're in this month's cycle; after the 15th,
// the cycle has revealed and you move to next month's cycle.
export function getCurrentCycleRevealDate(today = getLoveLetterToday()) {
  const baseDate = startOfDay(today);
  if (baseDate.getDate() > 15) {
    return new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 15);
  }
  return new Date(baseDate.getFullYear(), baseDate.getMonth(), 15);
}

export function getCurrentCycleKey(today = getLoveLetterToday()) {
  return formatMonthKey(getCurrentCycleRevealDate(today));
}

export function getCycleScheduleForRevealDate(revealDate: Date): CycleSchedule {
  return {
    cycleKey: formatMonthKey(revealDate),
    promptSendDate: new Date(revealDate.getFullYear(), revealDate.getMonth(), 1),
    reminderSendDate: new Date(revealDate.getFullYear(), revealDate.getMonth(), 4),
    writingCloseDate: new Date(revealDate.getFullYear(), revealDate.getMonth(), 5),
    revealDate,
  };
}

export function getCycleScheduleFromMonthKey(monthKey: string): CycleSchedule | null {
  const revealDate = getRevealDateFromMonthKey(monthKey);
  if (!revealDate) {
    return null;
  }

  return getCycleScheduleForRevealDate(revealDate);
}

export function getWritingWindowForRevealDate(revealDate: Date): WritingWindow {
  const year = revealDate.getFullYear();
  const month = revealDate.getMonth();

  return {
    writingOpens: new Date(year, month, 1),
    writingCloses: new Date(year, month, 5),
    revealUnlocks: new Date(year, month, 15),
  };
}

export function isWithinWritingWindow(today: Date, writingWindow: WritingWindow) {
  const normalizedToday = startOfDay(today);
  return (
    normalizedToday >= startOfDay(writingWindow.writingOpens) &&
    normalizedToday <= endOfDay(writingWindow.writingCloses)
  );
}

export function isRevealAvailable(today: Date, writingWindow: WritingWindow) {
  const normalizedToday = startOfDay(today);
  return normalizedToday >= startOfDay(writingWindow.revealUnlocks);
}

export function isPromptEmailEligibleToSend(today: Date, revealDate: Date) {
  return isWithinWritingWindow(today, getWritingWindowForRevealDate(revealDate));
}

export function getSignupCycleState(today: Date, revealDate: Date): SignupCycleState {
  const writingWindow = getWritingWindowForRevealDate(revealDate);
  const normalizedToday = startOfDay(today);
  const writingOpens = startOfDay(writingWindow.writingOpens);
  const writingCloses = endOfDay(writingWindow.writingCloses);

  if (normalizedToday < writingOpens) {
    return {
      phase: "before",
      writingWindow,
      nextWritingOpens: writingWindow.writingOpens,
    };
  }

  if (normalizedToday <= writingCloses) {
    return {
      phase: "during",
      writingWindow,
      nextWritingOpens: writingWindow.writingOpens,
    };
  }

  return {
    phase: "after",
    writingWindow,
    nextWritingOpens: new Date(revealDate.getFullYear(), revealDate.getMonth() + 1, 1),
  };
}
