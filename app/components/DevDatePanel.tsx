"use client";

import { useState } from "react";

import { LOVE_LETTER_DEV_DATE_KEY } from "@/lib/loveLetterDate";

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function DevDatePanel() {
  const isDevelopment = process.env.NODE_ENV === "development";
  const [dateValue, setDateValue] = useState(() => {
    if (!isDevelopment || typeof window === "undefined") {
      return "";
    }

    const storedDate = window.localStorage.getItem(LOVE_LETTER_DEV_DATE_KEY);
    if (!storedDate) {
      return "";
    }

    const parsed = new Date(storedDate);
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }

    return toDateInputValue(parsed);
  });

  if (!isDevelopment) {
    return null;
  }

  const handleSetDate = () => {
    if (typeof window === "undefined") {
      return;
    }

    if (!dateValue) {
      return;
    }

    const simulatedDate = new Date(`${dateValue}T12:00:00`);
    if (Number.isNaN(simulatedDate.getTime())) {
      return;
    }

    window.localStorage.setItem(
      LOVE_LETTER_DEV_DATE_KEY,
      simulatedDate.toISOString()
    );
    window.location.reload();
  };

  const handleResetDate = () => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.removeItem(LOVE_LETTER_DEV_DATE_KEY);
    setDateValue("");
    window.location.reload();
  };

  return (
    <div className="mt-8 border-t border-[#eadbd0] pt-8">
      <p className="text-center text-[0.68rem] font-bold uppercase tracking-[0.22em] text-[#6f5b58]">
        Dev Date
      </p>
      <div className="mx-auto mt-5 max-w-xl rounded-xl border border-[#eadbd0] bg-[#fffdfb] p-4 sm:p-5">
        <label className="grid gap-2 text-sm font-bold text-[#342d2a]">
          Date
          <input
            type="date"
            value={dateValue}
            onChange={(event) => setDateValue(event.target.value)}
            className="rounded-md border border-[#eadbd0] bg-white px-4 py-3 text-base outline-none transition focus:border-[#c97972]"
          />
        </label>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSetDate}
            className="w-full rounded-md border border-[#d9c7ba] bg-[#fff8f2] px-6 py-4 text-center text-xs font-bold uppercase tracking-[0.18em] text-[#6f5b58] shadow-[0_10px_24px_rgba(53,35,31,0.08)] transition hover:-translate-y-0.5 hover:border-[#cbb2a2] sm:w-fit"
          >
            Set Date
          </button>
          <button
            type="button"
            onClick={handleResetDate}
            className="w-full rounded-md border border-[#d9c7ba] bg-white px-6 py-4 text-center text-xs font-bold uppercase tracking-[0.18em] text-[#6f5b58] shadow-[0_10px_24px_rgba(53,35,31,0.08)] transition hover:-translate-y-0.5 hover:border-[#cbb2a2] sm:w-fit"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
