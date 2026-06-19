"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Subscriber = {
  coupleId: string;
  partnerOneEmail: string | null;
  partnerOneName: string | null;
  partnerTwoEmail: string | null;
  partnerTwoName: string | null;
  status: string;
  cancelAtPeriodEnd: boolean;
  createdUnix: number | null;
  currentPeriodEndUnix: number | null;
};

type PremiumResponse = {
  activeCount: number;
  subscribers: Subscriber[];
  error?: string;
};

function monthKeyFromUnix(unix: number | null): string | null {
  if (!unix) {
    return null;
  }
  const date = new Date(unix * 1000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function statusInfo(sub: Subscriber): { label: string; className: string } {
  if (sub.status === "active" || sub.status === "trialing") {
    if (sub.cancelAtPeriodEnd) {
      const end = monthKeyFromUnix(sub.currentPeriodEndUnix);
      return {
        label: end ? `Canceling · last ${monthLabel(end)}` : "Canceling",
        className: "border-[#e4d2b0] bg-[#fdf6e8] text-[#8a6f3a]",
      };
    }
    return { label: "Active", className: "border-[#cdd9c3] bg-[#f4f8ef] text-[#5b7b52]" };
  }
  if (sub.status === "canceled") {
    return { label: "Canceled", className: "border-[#e7c9c5] bg-[#fff6f5] text-[#b2564f]" };
  }
  return { label: sub.status, className: "border-[#e2d2c4] bg-[#fbf6f1] text-[#9a8a82]" };
}

export default function PremiumClient({ adminSecret }: { adminSecret: string }) {
  const [data, setData] = useState<PremiumResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());

  const apiUrl = useMemo(
    () =>
      adminSecret
        ? `/api/admin/premium?secret=${encodeURIComponent(adminSecret)}`
        : "/api/admin/premium",
    [adminSecret]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(apiUrl, { method: "GET", cache: "no-store" });
      const body = (await response.json()) as PremiumResponse;
      if (!response.ok || body.error) {
        setError(body.error ?? "Could not load premium subscribers.");
        setData(null);
        return;
      }
      setData(body);
    } catch {
      setError("Could not load premium subscribers.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Next 12 cycle months, starting this month.
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return { key, label: monthLabel(key) };
    });
  }, []);

  const currentMonthKey = months[0]?.key ?? "";

  const subscribersForMonth = useCallback(
    (monthKey: string): Subscriber[] => {
      if (!data) {
        return [];
      }
      return data.subscribers.filter((sub) => {
        const firstMonth = monthKeyFromUnix(sub.createdUnix) ?? currentMonthKey;
        const ongoing =
          (sub.status === "active" || sub.status === "trialing") && !sub.cancelAtPeriodEnd;
        const endMonth =
          sub.cancelAtPeriodEnd || sub.status === "canceled"
            ? monthKeyFromUnix(sub.currentPeriodEndUnix) ?? firstMonth
            : null;
        if (monthKey < firstMonth) {
          return false;
        }
        if (endMonth) {
          return monthKey <= endMonth;
        }
        return ongoing;
      });
    },
    [data, currentMonthKey]
  );

  const toggleMonth = (key: string) => {
    setOpenMonths((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <main className="min-h-screen bg-[#fbf6f1] px-5 py-8 text-[#161313] sm:px-8 sm:py-10 lg:px-12">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-4xl leading-tight sm:text-5xl">Premium</h1>
          <Link
            href="/admin"
            className="text-xs font-bold uppercase tracking-[0.16em] text-[#c97972] hover:underline"
          >
            ← Admin
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border border-[#eadbd0] bg-[#fffdfb] p-6 shadow-[0_10px_30px_rgba(53,35,31,0.07)]">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#6f5b58]">
            Active premium couples
          </p>
          <p className="mt-2 font-serif text-5xl text-[#342d2a]">
            {loading ? "…" : data?.activeCount ?? 0}
          </p>
          <p className="mt-1 text-sm text-[#8d7a72]">
            Couples currently subscribed (excludes canceled).
          </p>
        </div>

        {error ? (
          <p className="mt-4 text-sm text-[#b2564f]">{error}</p>
        ) : (
          <div className="mt-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#6f5b58]">
              By shipment month
            </p>
            <p className="mt-1 text-sm text-[#8d7a72]">
              Click a month to see the couples shipping that cycle.
            </p>

            <div className="mt-4 space-y-2">
              {months.map((month) => {
                const subs = subscribersForMonth(month.key);
                const isOpen = openMonths.has(month.key);
                return (
                  <div
                    key={month.key}
                    className="overflow-hidden rounded-xl border border-[#eadbd0] bg-[#fffdfb]"
                  >
                    <button
                      type="button"
                      onClick={() => toggleMonth(month.key)}
                      className="flex w-full items-center justify-between px-5 py-4 text-left"
                    >
                      <span className="font-serif text-lg text-[#342d2a]">{month.label}</span>
                      <span className="flex items-center gap-3">
                        <span className="text-sm text-[#6f5b58]">
                          {subs.length} {subs.length === 1 ? "couple" : "couples"}
                        </span>
                        <span className="text-[#c97972]">{isOpen ? "−" : "+"}</span>
                      </span>
                    </button>

                    {isOpen ? (
                      <div className="border-t border-[#f1e7dd] px-5 py-3">
                        {subs.length === 0 ? (
                          <p className="py-2 text-sm text-[#8d7a72]">
                            No couples shipping this month.
                          </p>
                        ) : (
                          <ul className="divide-y divide-[#f1e7dd]">
                            {subs.map((sub) => {
                              const badge = statusInfo(sub);
                              return (
                                <li
                                  key={sub.coupleId}
                                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div className="text-sm text-[#4e4440]">
                                    <div className="font-semibold">
                                      {sub.partnerOneName || sub.partnerOneEmail || "Partner one"}
                                      {sub.partnerTwoName || sub.partnerTwoEmail ? (
                                        <span className="text-[#9a8a82]">
                                          {" & "}
                                          {sub.partnerTwoName || sub.partnerTwoEmail}
                                        </span>
                                      ) : null}
                                    </div>
                                    <div className="text-xs text-[#8d7a72]">
                                      {sub.partnerOneEmail}
                                      {sub.partnerTwoEmail ? ` · ${sub.partnerTwoEmail}` : ""}
                                    </div>
                                  </div>
                                  <span
                                    className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.12em] ${badge.className}`}
                                  >
                                    {badge.label}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
