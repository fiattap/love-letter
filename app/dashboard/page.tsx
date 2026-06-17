"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  getLoveLetterToday,
  getRevealDateFromMonthKey,
  getSignupCycleState,
  isRevealAvailable,
  LOVE_LETTER_DEV_DATE_KEY,
} from "@/lib/loveLetterDate";
import { loadActivePromptWithDebug, PROMPT_FALLBACK_TEXT } from "@/lib/prompts";
import { supabase } from "@/lib/supabase";
import DevDatePanel from "@/app/components/DevDatePanel";

const isDevelopment = process.env.NODE_ENV === "development";
const DASHBOARD_CACHE_KEY = "love-letter-dashboard-cache";

const HEART_PATH =
  "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";

function HeartDivider() {
  return (
    <div className="flex items-center justify-center gap-3" aria-hidden="true">
      <span className="h-px w-14 bg-[#e7d5c8] sm:w-20" />
      <svg width="15" height="15" viewBox="0 0 24 24" className="shrink-0">
        <path d={HEART_PATH} fill="#c97972" />
      </svg>
      <span className="h-px w-14 bg-[#e7d5c8] sm:w-20" />
    </div>
  );
}

function PencilIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 20h4L18 10a2.8 2.8 0 00-4-4L4 16v4z" stroke="#a8736a" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M13.5 6.5l4 4" stroke="#a8736a" strokeWidth="1.6" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" stroke="#a8736a" strokeWidth="1.6" />
      <path d="M4 7l8 6 8-6" stroke="#a8736a" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M9 6l6 6-6 6" stroke="#c0a99c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type DashboardState = {
  email: string | null;
  memberId: number | null;
  partnerDisplayName: string;
  partnerEmail: string | null;
  promptTitle: string;
  promptMonthText: string;
  promptText: string;
  revealDateText: string;
  writingOpenDateText: string;
  writingCloseDateText: string;
  cyclePhase: "before" | "during" | "after";
  revealAvailable: boolean;
  joined: boolean;
  myLetterSealed: boolean;
  partnerSealed: boolean;
  physicalInterest: boolean;
  deliveryType: "digital" | "physical";
  subscriptionStatus: string;
  firstShipmentText: string;
  nextWindowText: string;
  nextWindowMonthText: string;
  nextWindowDayText: string;
  writingOpenMonthText: string;
  writingOpenDayText: string;
  revealDayText: string;
};

type RevealSendStatus = "idle" | "loading" | "success" | "duplicate" | "error";

type RevealSendMessage = {
  text: string;
  cycleKey?: string;
  sentCount?: number;
  skippedCount?: number;
  errorMessage?: string;
};

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

const DEFAULT_DASHBOARD_STATE: DashboardState = {
  email: null,
  memberId: null,
  partnerDisplayName: "your partner",
  partnerEmail: null,
  promptTitle: "Your Love Letter",
  promptMonthText: "July",
  promptText: PROMPT_FALLBACK_TEXT,
  revealDateText: "July 15",
  writingOpenDateText: "the 1st",
  writingCloseDateText: "July 5",
  cyclePhase: "before",
  revealAvailable: false,
  joined: false,
  myLetterSealed: false,
  partnerSealed: false,
  physicalInterest: false,
  deliveryType: "digital",
  subscriptionStatus: "free",
  firstShipmentText: "the next full cycle",
  nextWindowText: "soon",
  nextWindowMonthText: "July",
  nextWindowDayText: "25",
  writingOpenMonthText: "July",
  writingOpenDayText: "1",
  revealDayText: "15",
};

function readCachedDashboardState(): DashboardState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const cached = window.localStorage.getItem(DASHBOARD_CACHE_KEY);
    return cached
      ? ({ ...DEFAULT_DASHBOARD_STATE, ...(JSON.parse(cached) as Partial<DashboardState>) })
      : null;
  } catch {
    return null;
  }
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [dashboardLoaded, setDashboardLoaded] = useState<boolean>(() => readCachedDashboardState() !== null);
  const loadedEmailRef = useRef<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [magicLinkStatus, setMagicLinkStatus] = useState("");
  const [magicLinkError, setMagicLinkError] = useState("");

  const [loadError, setLoadError] = useState("");
  const [isCreatingCheckoutSession, setIsCreatingCheckoutSession] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [upgradeAcknowledged, setUpgradeAcknowledged] = useState(false);
  const [premiumStatusMessage, setPremiumStatusMessage] = useState("");
  const [premiumErrorMessage, setPremiumErrorMessage] = useState("");
  const [isSendingRevealEmail, setIsSendingRevealEmail] = useState(false);
  const [revealSendStatus, setRevealSendStatus] = useState<RevealSendStatus>("idle");
  const [revealSendMessage, setRevealSendMessage] = useState<RevealSendMessage>({
    text: "",
  });
  const [state, setState] = useState<DashboardState>(
    () => readCachedDashboardState() ?? DEFAULT_DASHBOARD_STATE
  );
  const upgradeState = searchParams.get("upgrade");

  const loadDashboard = async (resolvedEmail: string) => {
    setLoadError("");
    const normalizedEmail = normalizeEmail(resolvedEmail);

    const promptResult = await loadActivePromptWithDebug();
    const activeCycleKey = promptResult.prompt?.month_key ?? null;
    const today = getLoveLetterToday();
    const revealDate = promptResult.prompt?.month_key
      ? getRevealDateFromMonthKey(promptResult.prompt.month_key)
      : null;
    const cycleState = revealDate ? getSignupCycleState(today, revealDate) : null;

    // First physical keepsake covers the next FULL cycle the couple writes
    // start-to-finish. If they upgrade before this cycle's writing window opens,
    // this cycle qualifies; otherwise the first keepsake is the following cycle.
    const firstShipmentRevealDate =
      revealDate && cycleState?.phase === "before"
        ? revealDate
        : revealDate
          ? new Date(revealDate.getFullYear(), revealDate.getMonth() + 1, 15)
          : null;
    const firstShipmentText = firstShipmentRevealDate
      ? firstShipmentRevealDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : "the next full cycle";

    const nextWindowText = cycleState
      ? cycleState.nextWritingOpens.toLocaleDateString("en-US", { month: "long", day: "numeric" })
      : "soon";
    const nextWindowMonthText = cycleState
      ? cycleState.nextWritingOpens.toLocaleDateString("en-US", { month: "long" })
      : "July";
    const nextWindowDayText = cycleState
      ? cycleState.nextWritingOpens.toLocaleDateString("en-US", { day: "numeric" })
      : "25";

    const revealDateText = (revealDate ?? new Date()).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    });
    const revealDayText = (revealDate ?? new Date()).toLocaleDateString("en-US", {
      day: "numeric",
    });
    const writingOpenDateText = cycleState?.writingWindow.writingOpens.toLocaleDateString(
      "en-US",
      {
        month: "long",
        day: "numeric",
      }
    ) ?? "the 1st";
    // Writing-open month/day for THIS cycle (the same cycle as the reveal),
    // so the "Your dates" tiles always describe one consistent cycle.
    const writingOpenMonthText = cycleState
      ? cycleState.writingWindow.writingOpens.toLocaleDateString("en-US", { month: "long" })
      : "July";
    const writingOpenDayText = cycleState
      ? cycleState.writingWindow.writingOpens.toLocaleDateString("en-US", { day: "numeric" })
      : "1";
    const writingCloseDateText = cycleState?.writingWindow.writingCloses.toLocaleDateString(
      "en-US",
      {
        month: "long",
        day: "numeric",
      }
    ) ?? "July 5";
    const promptMonthText = (revealDate ?? new Date()).toLocaleDateString("en-US", {
      month: "long",
    });
    const promptTitle =
      cycleState?.phase === "during"
        ? `Your ${promptMonthText} Love Letter is ready.`
        : cycleState?.phase === "after"
          ? "Writing is closed for this cycle."
          : `Your first Love Letter opens ${writingOpenDateText}.`;
    const promptText =
      cycleState?.phase === "during"
        ? promptResult.prompt?.prompt ?? PROMPT_FALLBACK_TEXT
        : cycleState?.phase === "after"
          ? `Reveal unlocks ${revealDateText}.`
          : `Prompt available ${writingOpenDateText}.`;

    // Render the hero + date cards as soon as the cycle is known, so the shimmer
    // doesn't wait on the slower member/couple/letter queries below.
    setState((current) => ({
      ...current,
      promptTitle,
      promptMonthText,
      promptText,
      revealDateText,
      revealDayText,
      writingOpenDateText,
      writingCloseDateText,
      cyclePhase: cycleState?.phase ?? "before",
      revealAvailable: cycleState ? isRevealAvailable(today, cycleState.writingWindow) : false,
      firstShipmentText,
      nextWindowText,
      nextWindowMonthText,
      nextWindowDayText,
      writingOpenMonthText,
      writingOpenDayText,
    }));
    setDashboardLoaded(true);

    // Wave 1: member, couple, and my-letter queries run together (independent).
    const [memberResult, coupleResult, myLetterResult] = await Promise.all([
      supabase
        .from("members")
        .select(
          "id, delivery_type, physical_interest, partner_display_name, subscription_status, stripe_customer_id, stripe_subscription_id"
        )
        .ilike("email", normalizedEmail)
        .maybeSingle(),
      supabase
        .from("couples")
        .select("partner_one_email, partner_two_email, subscription_status")
        .or(`partner_one_email.ilike.${normalizedEmail},partner_two_email.ilike.${normalizedEmail}`)
        .limit(1)
        .maybeSingle(),
      activeCycleKey
        ? supabase
            .from("letters")
            .select("id")
            .ilike("writer_email", normalizedEmail)
            .eq("cycle_key", activeCycleKey)
            .eq("status", "sealed")
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const member = memberResult.data;

    if (memberResult.error) {
      setLoadError(memberResult.error.message);
      return;
    }

    const joined = Boolean(member?.id);
    let partnerEmail: string | null = null;
    let partnerDisplayName = "your partner";
    const myLetterSealed = Boolean(myLetterResult.data);
    let partnerSealed = false;

    if (joined && coupleResult.data) {
      const couple = coupleResult.data;
      const oneEmail = normalizeEmail(couple.partner_one_email);
      const twoEmail = normalizeEmail(couple.partner_two_email);
      partnerEmail =
        oneEmail === normalizedEmail
          ? couple.partner_two_email
          : twoEmail === normalizedEmail
            ? couple.partner_one_email
            : couple.partner_two_email ?? couple.partner_one_email ?? null;
    }

    if (joined && partnerEmail) {
      // Wave 2: partner profile + partner letter run together.
      const [partnerMemberResult, partnerLetterResult] = await Promise.all([
        supabase.from("members").select("name, email").eq("email", partnerEmail).maybeSingle(),
        activeCycleKey
          ? supabase
              .from("letters")
              .select("id")
              .eq("writer_email", partnerEmail)
              .eq("cycle_key", activeCycleKey)
              .eq("status", "sealed")
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const partnerName = partnerMemberResult.data?.name?.trim();
      const persistedDisplayName = member?.partner_display_name?.trim() || "";
      partnerDisplayName = persistedDisplayName || partnerName || partnerEmail;
      partnerSealed = Boolean(partnerLetterResult.data);

      if (!persistedDisplayName) {
        await supabase
          .from("members")
          .update({ partner_display_name: partnerDisplayName })
          .ilike("email", normalizedEmail);
      }
    }

    const nextState: DashboardState = {
      email: resolvedEmail,
      memberId: member?.id ?? null,
      partnerDisplayName,
      partnerEmail,
      promptTitle,
      promptMonthText,
      promptText,
      revealDateText,
      writingOpenDateText,
      writingCloseDateText,
      cyclePhase: cycleState?.phase ?? "before",
      revealAvailable: cycleState ? isRevealAvailable(today, cycleState.writingWindow) : false,
      joined,
      myLetterSealed,
      partnerSealed,
      physicalInterest: Boolean(member?.physical_interest),
      deliveryType: member?.delivery_type === "physical" ? "physical" : "digital",
      // Billing is per couple, so the couple's status is the source of truth —
      // this is how the non-paying partner also sees "premium".
      subscriptionStatus:
        coupleResult.data?.subscription_status === "premium"
          ? "premium"
          : member?.subscription_status ?? "free",
      firstShipmentText,
      nextWindowText,
      nextWindowMonthText,
      nextWindowDayText,
      writingOpenMonthText,
      writingOpenDayText,
      revealDayText,
    };

    setState(nextState);
    setDashboardLoaded(true);

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(nextState));
      } catch {
        // ignore storage failures
      }
    }
  };

  useEffect(() => {
    let isMounted = true;

    const syncSession = async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (sessionError) {
        setLoadError(sessionError.message);
        setUserEmail(null);
        setSessionChecked(true);
        return;
      }

      const nextEmail = sessionData.session?.user.email ?? null;
      console.log("client session exists", Boolean(sessionData.session));
      console.log("client user email", nextEmail ?? "none");

      setUserEmail(nextEmail);
      setSessionChecked(true);

      if (!nextEmail) {
        loadedEmailRef.current = null;
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(DASHBOARD_CACHE_KEY);
        }
        setState((current) => ({ ...current, email: null, memberId: null }));
        return;
      }

      if (searchParams.get("auth_error")) {
        router.replace("/dashboard");
      }

      if (loadedEmailRef.current !== nextEmail) {
        loadedEmailRef.current = nextEmail;
        await loadDashboard(nextEmail);
      }
    };

    void syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) {
        return;
      }

      const nextEmail = session?.user.email ?? null;
      console.log("client session exists", Boolean(session));
      console.log("client user email", nextEmail ?? "none");

      setUserEmail(nextEmail);
      setSessionChecked(true);

      if (!nextEmail) {
        loadedEmailRef.current = null;
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(DASHBOARD_CACHE_KEY);
        }
        setState((current) => ({ ...current, email: null, memberId: null }));
        return;
      }

      if (searchParams.get("auth_error")) {
        router.replace("/dashboard");
      }

      if (loadedEmailRef.current !== nextEmail) {
        loadedEmailRef.current = nextEmail;
        await loadDashboard(nextEmail);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router, searchParams]);

  useEffect(() => {
    if (upgradeState !== "success" || !userEmail) {
      return;
    }

    const reloadTimer = window.setTimeout(() => {
      void loadDashboard(userEmail);
    }, 1500);

    return () => {
      window.clearTimeout(reloadTimer);
    };
  }, [upgradeState, userEmail]);

  const handleUpgradeToPremium = async () => {
    setIsCreatingCheckoutSession(true);
    setPremiumErrorMessage("");
    setPremiumStatusMessage("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setPremiumErrorMessage("Please sign in again before upgrading.");
        setIsCreatingCheckoutSession(false);
        return;
      }

      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = (await response.json()) as { error?: string; url?: string };

      if (!response.ok || !result.url) {
        setPremiumErrorMessage(result.error ?? "Could not start Stripe Checkout.");
        setIsCreatingCheckoutSession(false);
        return;
      }

      setPremiumStatusMessage("Redirecting to secure checkout...");
      window.location.href = result.url;
    } catch {
      setPremiumErrorMessage("Could not start Stripe Checkout.");
      setIsCreatingCheckoutSession(false);
      return;
    }
  };

  const dismissUpgradeModal = () => {
    setUpgradeAcknowledged(true);
    router.replace("/dashboard");
  };

  const handleManageSubscription = async () => {
    setIsOpeningPortal(true);
    setPremiumErrorMessage("");
    setPremiumStatusMessage("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setPremiumErrorMessage("Please sign in again to manage your subscription.");
        setIsOpeningPortal(false);
        return;
      }

      const response = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = (await response.json()) as { error?: string; url?: string };

      if (!response.ok || !result.url) {
        setPremiumErrorMessage(result.error ?? "Could not open the subscription portal.");
        setIsOpeningPortal(false);
        return;
      }

      setPremiumStatusMessage("Opening your subscription portal...");
      window.location.href = result.url;
    } catch {
      setPremiumErrorMessage("Could not open the subscription portal.");
      setIsOpeningPortal(false);
      return;
    }
  };


  const handleSendMagicLink = async () => {
    if (!emailInput.trim()) {
      setMagicLinkError("Please add your email.");
      setMagicLinkStatus("");
      return;
    }

    setIsSendingMagicLink(true);
    setMagicLinkError("");
    setMagicLinkStatus("");

    const appBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
    const origin = appBaseUrl.replace(/\/$/, "");
    const callbackUrl =
      process.env.NODE_ENV === "development"
        ? "http://localhost:3000/auth/callback"
        : `${origin}/auth/callback`;

    console.log("magic link emailRedirectTo:", callbackUrl);

    // Never redirect directly to /auth/callback because it needs Supabase token params.

    const { error } = await supabase.auth.signInWithOtp({
      email: emailInput.trim(),
      options: {
        emailRedirectTo: callbackUrl,
      },
    });

    if (error) {
      setMagicLinkError(error.message);
      setIsSendingMagicLink(false);
      return;
    }

    setMagicLinkStatus("Check your email for your dashboard link.");
    setIsSendingMagicLink(false);
  };

  const getSimulatedDate = () =>
    typeof window !== "undefined"
      ? window.localStorage.getItem(LOVE_LETTER_DEV_DATE_KEY)
      : null;

  const handleSendRevealEmail = async () => {
    setIsSendingRevealEmail(true);
    setRevealSendStatus("loading");
    setRevealSendMessage({
      text: "Sending reveal emails...",
    });

    try {
      const response = await fetch("/api/send-reveal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          devDate: getSimulatedDate(),
          force: true,
        }),
      });

      const result = (await response.json()) as {
        error?: string;
        note?: string;
        cycleKey?: string;
        sentCount?: number;
        skippedCount?: number;
        failedCount?: number;
      };

      if (!response.ok) {
        setRevealSendStatus("error");
        setRevealSendMessage({
          text: "Unable to send reveal emails.",
          errorMessage: result.error ?? "Unknown error",
        });
        setIsSendingRevealEmail(false);
        return;
      }

      const sentCount = result.sentCount ?? 0;
      const skippedCount = result.skippedCount ?? 0;

      if (sentCount === 0 && skippedCount > 0) {
        setRevealSendStatus("duplicate");
        setRevealSendMessage({
          text: "Reveal emails already sent for this cycle.",
          cycleKey: result.cycleKey,
          sentCount,
          skippedCount,
        });
      } else {
        setRevealSendStatus("success");
        setRevealSendMessage({
          text: "Reveal emails sent successfully.",
          cycleKey: result.cycleKey,
          sentCount,
          skippedCount,
        });
      }
    } catch {
      setRevealSendStatus("error");
      setRevealSendMessage({
        text: "Unable to send reveal emails.",
        errorMessage: "Unexpected network error",
      });
    }

    setIsSendingRevealEmail(false);
  };

  return (
    <main className="min-h-screen bg-[#fbf6f1] px-5 py-8 text-[#161313] sm:px-8 sm:py-10 lg:px-12">
      <div className="mx-auto w-full max-w-[860px]">
        <header className="pb-6 text-center">
          <p className="font-serif text-2xl tracking-[0.2em] sm:text-3xl sm:tracking-[0.22em]">
            LOVE LETTER <span className="text-[#c97972]">♡</span>
          </p>
          <p className="mt-3 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[#6f5b58] sm:text-xs">
            Your monthly ritual
          </p>
          <div className="mt-5">
            <HeartDivider />
          </div>
        </header>

        {!sessionChecked ? (
          <section className="mx-auto mt-10 max-w-xl rounded-2xl border border-[#eadbd0] bg-[#fffaf6] p-6 shadow-[0_16px_42px_rgba(53,35,31,0.09)] sm:p-8">
            <h1 className="font-serif text-4xl leading-tight sm:text-5xl">Checking your session...</h1>
            <p className="mt-4 text-base leading-8 text-[#4e4440] sm:text-lg">
              Confirming your Love Letter sign-in.
            </p>
          </section>
        ) : !userEmail ? (
          <section className="mx-auto mt-10 max-w-xl rounded-2xl border border-[#eadbd0] bg-[#fffaf6] p-6 shadow-[0_16px_42px_rgba(53,35,31,0.09)] sm:p-8">
            <h1 className="font-serif text-4xl leading-tight sm:text-5xl">Sign in</h1>
            <p className="mt-4 text-base leading-8 text-[#4e4440] sm:text-lg">
              Enter your email and we&apos;ll send you a magic link.
            </p>

            {process.env.NODE_ENV === "development" && searchParams.get("auth_error") === "1" ? (
              <p className="mt-3 text-sm text-[#b2564f]">
                Magic link sign-in failed. Check callback logs.
              </p>
            ) : null}

            <label className="mt-6 grid gap-2 text-sm font-bold text-[#342d2a]">
              Email
              <input
                type="email"
                value={emailInput}
                onChange={(event) => setEmailInput(event.target.value)}
                placeholder="you@example.com"
                className="rounded-md border border-[#eadbd0] bg-white px-4 py-3 text-base outline-none transition focus:border-[#c97972]"
              />
            </label>

            {magicLinkError ? <p className="mt-3 text-sm text-[#b2564f]">{magicLinkError}</p> : null}
            {magicLinkStatus ? <p className="mt-3 text-sm text-[#6f5b58]">{magicLinkStatus}</p> : null}
            {process.env.NODE_ENV === "development" && magicLinkStatus ? (
              <p className="mt-2 text-sm text-[#6f5b58]">
                Use the newest email. Old magic links may not work.
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleSendMagicLink}
              disabled={isSendingMagicLink}
              className="mt-6 w-full rounded-md bg-[#c97972] px-8 py-4 text-center text-xs font-bold uppercase tracking-[0.18em] text-white shadow-[0_12px_30px_rgba(201,121,114,0.22)] transition enabled:hover:-translate-y-0.5 enabled:hover:bg-[#b86b65] disabled:cursor-not-allowed disabled:opacity-70 sm:w-fit"
            >
              {isSendingMagicLink ? "Sending..." : "Send Magic Link"}
            </button>
          </section>
        ) : (
          <section className="mx-auto mt-10 space-y-8">
            {upgradeState === "success" && !upgradeAcknowledged ? (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(40,28,25,0.45)] p-5"
                role="dialog"
                aria-modal="true"
                onClick={dismissUpgradeModal}
              >
                <div
                  className="w-full max-w-md rounded-2xl border border-[#c9a27a] bg-[#fff4ec] p-7 text-center shadow-[0_24px_60px_rgba(53,35,31,0.28)] sm:p-9"
                  onClick={(event) => event.stopPropagation()}
                >
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#3f7d57]">
                    ✓ Payment confirmed
                  </p>
                  <h2 className="mt-3 font-serif text-3xl leading-tight sm:text-4xl">
                    You&apos;re Premium <span className="text-[#c97972]">♡</span>
                  </h2>
                  <p className="mx-auto mt-3 max-w-md text-base leading-8 text-[#4e4440] sm:text-lg">
                    Your printed letter subscription is active. Your first printed letter
                    ships {state.firstShipmentText} — full details below.
                  </p>
                  <button
                    type="button"
                    onClick={dismissUpgradeModal}
                    className="mt-5 rounded-md bg-[#c97972] px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-[0_10px_24px_rgba(201,121,114,0.22)] transition hover:-translate-y-0.5 hover:bg-[#b86b65]"
                  >
                    Got it
                  </button>
                </div>
              </div>
            ) : null}

            {loadError ? (
              <p className="rounded-xl border border-[#eadbd0] bg-[#fffdfb] px-4 py-3 text-sm text-[#6f5b58]">
                Could not load part of your dashboard right now.
              </p>
            ) : null}

            <div className="overflow-hidden rounded-2xl border border-[#eadbd0] bg-[#fffaf6] shadow-[0_16px_42px_rgba(53,35,31,0.09)]">
              <div className="flex flex-col sm:flex-row sm:items-stretch sm:min-h-[440px]">
                <div className="p-7 sm:flex sm:flex-1 sm:flex-col sm:justify-center sm:p-9">
                  {!dashboardLoaded ? (
                    <div className="animate-pulse space-y-4" aria-hidden="true">
                      <div className="h-3 w-20 rounded bg-[#ecdccf]" />
                      <div className="h-10 w-3/4 rounded bg-[#f0e3d8]" />
                      <div className="h-10 w-2/3 rounded bg-[#f0e3d8]" />
                      <div className="mt-2 h-4 w-1/2 rounded bg-[#ecdccf]" />
                    </div>
                  ) : state.cyclePhase === "during" ? (
                    <>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c97972]">
                        Writing open
                      </p>
                      <h1 className="mt-3 font-serif text-4xl leading-[1.05] sm:text-5xl">
                        Your {state.promptMonthText} letter is ready to write.
                      </h1>
                      <p className="mt-4 text-base leading-8 text-[#342d2a] sm:text-lg">
                        &quot;{state.promptText}&quot;
                      </p>
                      <p className="mt-4 text-sm leading-7 text-[#6f5b58] sm:text-base">
                        Write it by {state.writingCloseDateText}. It stays sealed until you both
                        unlock on {state.revealDateText}.
                      </p>
                      <a
                        href="/write"
                        className="group mt-7 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#c97972] px-8 py-4 text-center text-xs font-bold uppercase tracking-[0.18em] text-white shadow-[0_12px_30px_rgba(201,121,114,0.22)] transition hover:-translate-y-0.5 hover:bg-[#b86b65] sm:w-fit"
                      >
                        Write my letter
                        <span className="transition-transform group-hover:translate-x-0.5">→</span>
                      </a>
                    </>
                  ) : state.cyclePhase === "before" ? (
                    <>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c97972]">
                        Coming soon
                      </p>
                      <h1 className="mt-3 font-serif text-4xl leading-[1.05] sm:text-5xl">
                        Your next letter opens {state.writingOpenDateText}.
                      </h1>
                      <p className="mt-4 text-base leading-8 text-[#4e4440] sm:text-lg">
                        You&apos;ll have until {state.writingCloseDateText} to write — a 5-day window
                        once it opens.
                      </p>
                      <p className="mt-4 text-sm leading-7 text-[#6f5b58] sm:text-base">
                        We&apos;ll email you both when it&apos;s time to write — no need to remember.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c97972]">
                        All set
                      </p>
                      <h1 className="mt-3 font-serif text-4xl leading-[1.05] sm:text-5xl">
                        Your {state.promptMonthText} letters are sealed.
                      </h1>
                      <p className="mt-4 text-base leading-8 text-[#4e4440] sm:text-lg">
                        They&apos;ll be revealed on{" "}
                        <span className="font-semibold text-[#c97972]">{state.revealDateText}.</span>
                      </p>
                      <p className="mt-4 text-sm leading-7 text-[#6f5b58] sm:text-base">
                        No peeking, no edits — just anticipation until reveal day.
                      </p>
                      <a
                        href="/reveal"
                        className="group mt-7 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#c97972] px-8 py-4 text-center text-xs font-bold uppercase tracking-[0.18em] text-white shadow-[0_12px_30px_rgba(201,121,114,0.22)] transition hover:-translate-y-0.5 hover:bg-[#b86b65] sm:w-fit"
                      >
                        Open reveal
                        <span className="transition-transform group-hover:translate-x-0.5">→</span>
                      </a>
                    </>
                  )}
                </div>
                <div
                  className="min-h-[240px] self-stretch bg-cover bg-center sm:min-h-0 sm:w-[52%]"
                  style={{
                    backgroundImage: `url('${
                      state.cyclePhase === "after"
                        ? "/all-set-stationery.jpg"
                        : "/hero-sealed-envelope.jpg"
                    }')`,
                  }}
                  role="img"
                  aria-label="A wax-sealed envelope on textured paper with dried flowers"
                />
              </div>
            </div>

            <div className="grid gap-8 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#eadbd0] bg-[#fffdfb] p-6 shadow-[0_10px_30px_rgba(53,35,31,0.07)] sm:p-7">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#6f5b58]">Your space</p>
                <span className="mt-4 block h-px w-full bg-[#eee0d5]" />
                <a href="/write" className="group flex items-start gap-4 py-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f5e4d9]">
                    <PencilIcon />
                  </span>
                  <span className="flex-1">
                    <span className="block text-base font-semibold text-[#342d2a]">View your letter</span>
                    <span className="mt-1 block text-sm leading-6 text-[#6f5b58]">
                      Review what you wrote, before the reveal.
                    </span>
                  </span>
                  <span className="mt-1 transition-transform group-hover:translate-x-0.5">
                    <Chevron />
                  </span>
                </a>
                <span className="block h-px w-full bg-[#eee0d5]" />
                <a href="/reveal" className="group flex items-start gap-4 py-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f5e4d9]">
                    <MailIcon />
                  </span>
                  <span className="flex-1">
                    <span className="block text-base font-semibold text-[#342d2a]">Letter details</span>
                    <span className="mt-1 block text-sm leading-6 text-[#6f5b58]">
                      Your partner and reveal date.
                    </span>
                  </span>
                  <span className="mt-1 transition-transform group-hover:translate-x-0.5">
                    <Chevron />
                  </span>
                </a>
              </div>

              <div className="flex flex-col gap-8">
                <div className="rounded-2xl border border-[#eadbd0] bg-[#fffdfb] p-6 shadow-[0_10px_30px_rgba(53,35,31,0.07)] sm:p-7">
                  <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-[#6f5b58]">
                    Your dates
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-4">
                    <div className="rounded-lg border border-[#e7d5c8] bg-[#fffaf4] px-3 py-5 text-center shadow-[0_8px_20px_rgba(53,35,31,0.06)]">
                      <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[#6f5b58]">
                        Writing opens
                      </p>
                      <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-[#c97972]">
                        {state.writingOpenMonthText}
                      </p>
                      <p className="mt-1 font-serif text-5xl leading-none text-[#342d2a]">
                        {state.writingOpenDayText}
                      </p>
                      <svg width="12" height="12" viewBox="0 0 24 24" className="mx-auto mt-3">
                        <path d={HEART_PATH} fill="#c97972" />
                      </svg>
                      <p className="mt-2 text-[0.7rem] leading-5 text-[#6f5b58]">
                        Start your next letter.
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#e7d5c8] bg-[#fffaf4] px-3 py-5 text-center shadow-[0_8px_20px_rgba(53,35,31,0.06)]">
                      <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[#6f5b58]">
                        Reveal day
                      </p>
                      <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-[#c97972]">
                        {state.promptMonthText}
                      </p>
                      <p className="mt-1 font-serif text-5xl leading-none text-[#342d2a]">
                        {state.revealDayText}
                      </p>
                      <svg width="12" height="12" viewBox="0 0 24 24" className="mx-auto mt-3">
                        <path d={HEART_PATH} fill="#c97972" />
                      </svg>
                      <p className="mt-2 text-[0.7rem] leading-5 text-[#6f5b58]">
                        Letters unlock together.
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#eadbd0] bg-[#fffdfb] shadow-[0_10px_30px_rgba(53,35,31,0.07)]">
              {state.subscriptionStatus === "premium" ? (
                <div className="flex flex-col sm:flex-row sm:items-stretch">
                  <div className="p-7 sm:flex-1 sm:p-9">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c97972]">
                      Premium Love Letter
                    </p>
                    <h3 className="mt-3 font-serif text-3xl leading-[1.1] sm:text-4xl">
                      You&apos;re all set.
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-[#6f5b58] sm:text-base">
                      Your printed letter subscription is active. Your letters still reveal
                      digitally on {state.revealDateText}; printed copies ship once both
                      letters are sealed each cycle.
                    </p>
                    <p className="mt-4 text-sm font-bold uppercase tracking-[0.14em] text-[#6f5b58]">
                      Next shipment: {state.firstShipmentText}
                    </p>
                    <button
                      type="button"
                      onClick={handleManageSubscription}
                      disabled={isOpeningPortal}
                      className="mt-5 rounded-md border border-[#d9c7ba] bg-[#fff8f2] px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-[#6f5b58] transition hover:bg-[#fbeee3] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isOpeningPortal ? "Opening…" : "Manage Subscription"}
                    </button>
                    {premiumErrorMessage ? (
                      <p className="mt-3 text-sm text-[#b2564f]">{premiumErrorMessage}</p>
                    ) : null}
                  </div>
                  <div
                    className="min-h-[200px] bg-cover bg-center sm:min-h-0 sm:w-[46%]"
                    style={{ backgroundImage: "url('/keepsake-active-stationery.jpg')" }}
                    role="img"
                    aria-label="A printed letter tied with twine"
                  />
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-stretch">
                  <div className="p-7 sm:flex-1 sm:p-9">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c97972]">
                      Premium Love Letter
                    </p>
                    <h3 className="mt-3 font-serif text-3xl leading-[1.1] sm:text-4xl">
                      Hold your letters in your hands.
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-[#a8736a] sm:text-base">
                      Each month&apos;s letters, printed on premium stationery and mailed to both
                      partners — yours to keep.
                    </p>
                    <p className="mt-3 text-sm font-bold uppercase tracking-[0.14em] text-[#6f5b58]">
                      $9.99/month per couple
                    </p>
                    <p className="mt-2 text-xs leading-5 text-[#9a8a82]">
                      Auto-renews monthly. No refunds — cancel anytime before the 5th of the month to
                      skip the next cycle. By continuing you agree to our{" "}
                      <a
                        href="/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[#c97972] underline underline-offset-2"
                      >
                        Terms
                      </a>
                      .
                    </p>
                    <button
                      type="button"
                      onClick={handleUpgradeToPremium}
                      disabled={isCreatingCheckoutSession}
                      className="group mt-5 inline-flex items-center gap-2 rounded-md bg-[#c97972] px-7 py-3.5 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-[0_10px_24px_rgba(201,121,114,0.22)] transition enabled:hover:-translate-y-0.5 enabled:hover:bg-[#b86b65] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isCreatingCheckoutSession ? "Loading…" : "Get printed letters"}
                      <span className="transition-transform group-hover:translate-x-0.5">→</span>
                    </button>
                    {premiumStatusMessage ? (
                      <p className="mt-3 text-sm text-[#6f5b58]">{premiumStatusMessage}</p>
                    ) : null}
                    {upgradeState === "cancelled" || premiumErrorMessage ? (
                      <p className="mt-3 text-sm text-[#b2564f]">
                        {premiumErrorMessage || "Stripe Checkout was canceled."}
                      </p>
                    ) : null}
                  </div>
                  <div
                    className="min-h-[200px] bg-cover bg-center sm:min-h-0 sm:w-[46%]"
                    style={{ backgroundImage: "url('/keepsake-stationery.jpg')" }}
                    role="img"
                    aria-label="A bundle of letters tied with twine and a sprig"
                  />
                </div>
              )}
            </div>

            {isDevelopment ? (
              <div className="space-y-3">
                {/* TODO: Move this to admin dashboard before launch. */}
                <button
                  type="button"
                  onClick={handleSendRevealEmail}
                  disabled={isSendingRevealEmail}
                  className="rounded-md border border-[#d9c7ba] bg-[#fff8f2] px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-[#6f5b58] shadow-[0_10px_24px_rgba(53,35,31,0.08)] transition enabled:hover:-translate-y-0.5 enabled:hover:border-[#cbb2a2] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSendingRevealEmail ? "Sending Reveal Email..." : "Send Reveal Email (Dev)"}
                </button>

                {revealSendStatus !== "idle" ? (
                  <div
                    className={`rounded-xl border p-4 shadow-[0_10px_24px_rgba(53,35,31,0.06)] ${
                      revealSendStatus === "error"
                        ? "border-[#e7c9c5] bg-[#fff6f5]"
                        : revealSendStatus === "loading"
                          ? "border-[#eadbd0] bg-[#fffaf6]"
                          : "border-[#d6e4d0] bg-[#f7fbf4]"
                    }`}
                  >
                    <p className="font-serif text-lg leading-tight text-[#342d2a]">
                      {revealSendMessage.text}
                    </p>

                    {revealSendStatus === "loading" ? (
                      <p className="mt-2 text-sm text-[#6f5b58]">Sending reveal emails...</p>
                    ) : null}

                    {revealSendStatus === "success" || revealSendStatus === "duplicate" ? (
                      <div className="mt-3 space-y-1 text-sm text-[#4e4440]">
                        <p>
                          {revealSendStatus === "success" ? "✓ Reveal emails sent" : "Reveal emails already sent for this cycle."}
                        </p>
                        <p>Cycle: {revealSendMessage.cycleKey ?? "n/a"}</p>
                        <p>Sent: {revealSendMessage.sentCount ?? 0}</p>
                        <p>Skipped: {revealSendMessage.skippedCount ?? 0}</p>
                      </div>
                    ) : null}

                    {revealSendStatus === "error" ? (
                      <p className="mt-2 text-sm text-[#b2564f]">
                        {revealSendMessage.errorMessage ?? "Unknown error"}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {isDevelopment ? <DevDatePanel /> : null}

            <p className="flex items-center justify-center gap-2 pt-2 pb-4 text-center font-serif text-base italic text-[#7a6a60]">
              <span className="not-italic text-2xl leading-none text-[#c08c84]">&ldquo;</span>
              A letter is a pause in a world that moves too fast.
              <span className="not-italic text-2xl leading-none text-[#c08c84]">&rdquo;</span>
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#fbf6f1] px-5 py-8 text-[#161313] sm:px-8 sm:py-10 lg:px-12">
          <div className="mx-auto w-full max-w-[860px]">
            <header className="border-b border-[#eadbd0] pb-7 text-center sm:pb-8">
              <p className="font-serif text-2xl tracking-[0.2em] sm:text-3xl sm:tracking-[0.22em]">
                LOVE LETTER <span className="text-[#c97972]">♡</span>
              </p>
              <p className="mt-3 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[#6f5b58] sm:text-xs">
                Your monthly ritual
              </p>
            </header>

            <section className="mx-auto mt-10 max-w-xl rounded-2xl border border-[#eadbd0] bg-[#fffaf6] p-6 shadow-[0_16px_42px_rgba(53,35,31,0.09)] sm:p-8">
              <h1 className="font-serif text-4xl leading-tight sm:text-5xl">Checking your session...</h1>
              <p className="mt-4 text-base leading-8 text-[#4e4440] sm:text-lg">
                Confirming your Love Letter sign-in.
              </p>
            </section>
          </div>
        </main>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
