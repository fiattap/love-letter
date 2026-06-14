"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import DevDatePanel from "@/app/components/DevDatePanel";
import {
  LOVE_LETTER_DEV_DATE_KEY,
  getCycleScheduleForRevealDate,
  getRevealDateForToday,
  getRevealDateFromMonthKey,
  getWritingWindowForRevealDate,
  isRevealAvailable,
} from "@/lib/loveLetterDate";
import { loadActivePrompt, PROMPT_FALLBACK_TEXT } from "@/lib/prompts";
import { supabase } from "@/lib/supabase";

type LetterRow = {
  id: number;
  writer_email: string;
  body: string;
  couple_id: number | null;
  cycle_key: string | null;
};

type CoupleRow = {
  id: number;
  partner_one_email: string | null;
  partner_two_email: string | null;
};

type RevealDebugInfo = {
  currentUserEmail: string | null;
  couple_id: number | null;
  partnerOneEmail: string | null;
  partnerTwoEmail: string | null;
  expectedWriterEmail: string | null;
  returnedLetterWriterEmail: string | null;
  cycle_key: string | null;
  queryError: string | null;
  fallbackLetters: Array<{ writer_email: string | null; status: string | null }>;
};

const REVEAL_QA_USER_KEY = "love-letter-reveal-qa-user";
const REVEAL_QA_USER_OPTIONS = [
  { label: "Fiat", email: "fiat_2545@yahoo.com" },
  { label: "Derek", email: "fiattapaneeyakorn@gmail.com" },
];

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? null;
}

function getRevealCycleForDisplay(today: Date) {
  const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (normalizedToday.getDate() >= 15) {
    return new Date(normalizedToday.getFullYear(), normalizedToday.getMonth(), 15);
  }

  return getRevealDateForToday(normalizedToday);
}

function resolveTodayFromKey(options: {
  mounted: boolean;
  isDevelopment: boolean;
  devDateKey: string;
}) {
  if (!options.mounted) {
    return new Date();
  }

  if (!options.isDevelopment || !options.devDateKey) {
    return new Date();
  }

  const parsedDate = new Date(options.devDateKey);
  return Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
}

export default function RevealPage() {
  const isDevelopment = process.env.NODE_ENV === "development";
  const router = useRouter();
  const [mounted] = useState(() => typeof window !== "undefined");
  const devDateKey = useMemo(() => {
    if (!mounted || !isDevelopment || typeof window === "undefined") {
      return "";
    }

    return window.localStorage.getItem(LOVE_LETTER_DEV_DATE_KEY) ?? "";
  }, [isDevelopment, mounted]);
  const todayKey = useMemo(
    () => resolveTodayFromKey({ mounted, isDevelopment, devDateKey }).toISOString(),
    [devDateKey, isDevelopment, mounted]
  );
  const today = useMemo(() => new Date(todayKey), [todayKey]);
  const [isOpening, setIsOpening] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showMyLetter, setShowMyLetter] = useState(false);
  const [activePromptText, setActivePromptText] = useState<string | null>(null);
  const [revealDateText, setRevealDateText] = useState("July 15, 2026");
  const [revealDate, setRevealDate] = useState<Date>(() => getRevealDateForToday(new Date()));
  const [theirLetterBody, setTheirLetterBody] = useState<string | null>(null);
  const [myLetterBody, setMyLetterBody] = useState<string | null>(null);
  const [partnerDisplayName, setPartnerDisplayName] = useState("your partner");
  const [hasBothLetters, setHasBothLetters] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [revealUnavailableMessage, setRevealUnavailableMessage] = useState(
    "We&apos;re waiting for your partner."
  );
  const [debugInfo, setDebugInfo] = useState<RevealDebugInfo>({
    currentUserEmail: null,
    couple_id: null,
    partnerOneEmail: null,
    partnerTwoEmail: null,
    expectedWriterEmail: null,
    returnedLetterWriterEmail: null,
    cycle_key: null,
    queryError: null,
    fallbackLetters: [],
  });
  const [isSavingPhysicalInterest, setIsSavingPhysicalInterest] = useState(false);
  const [physicalStatusMessage, setPhysicalStatusMessage] = useState("");
  const [physicalErrorMessage, setPhysicalErrorMessage] = useState("");
  const [qaUserOverride, setQaUserOverride] = useState(() => {
    if (process.env.NODE_ENV !== "development" || typeof window === "undefined") {
      return "";
    }

    return window.localStorage.getItem(REVEAL_QA_USER_KEY) ?? "";
  });

  const promptText = activePromptText ?? PROMPT_FALLBACK_TEXT;
  const revealIsUnlocked = mounted && isRevealAvailable(
    today,
    getWritingWindowForRevealDate(revealDate)
  );

  useEffect(() => {
    let isMounted = true;

    const fetchPrompt = async () => {
      const currentToday = new Date(todayKey);
      const revealCycleDate = getRevealCycleForDisplay(currentToday);
      const revealCycleKey = getCycleScheduleForRevealDate(revealCycleDate).cycleKey;
      const activePrompt = await loadActivePrompt();
      const { data: promptForRevealCycle, error: promptForRevealCycleError } = await supabase
        .from("prompts")
        .select("month_key, prompt")
        .eq("month_key", revealCycleKey)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (!activePrompt && !promptForRevealCycle) {
        setActivePromptText(null);
        setHasBothLetters(false);
        setIsLoading(false);
        return;
      }

      setActivePromptText(promptForRevealCycle?.prompt ?? activePrompt?.prompt ?? null);

      const loadedRevealDate =
        getRevealDateFromMonthKey(revealCycleKey) ?? getRevealCycleForDisplay(currentToday);

      setRevealDate(loadedRevealDate);
      setRevealDateText(
        loadedRevealDate.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      );

      const activeCycleKey = revealCycleKey;
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionEmail = normalizeEmail(sessionData.session?.user.email ?? null);
      const writerEmail =
        isDevelopment && qaUserOverride
          ? normalizeEmail(qaUserOverride)
          : sessionEmail;
      setDebugInfo((current) => ({
        ...current,
        currentUserEmail: writerEmail,
        cycle_key: activeCycleKey,
        queryError: promptForRevealCycleError?.message ?? null,
      }));

      if (!writerEmail) {
        setHasBothLetters(false);
        setRevealUnavailableMessage("Your partner’s letter is not available yet.");
        setIsLoading(false);
        return;
      }

      const { data: couplesForMember, error: coupleLookupError } = await supabase
        .from("couples")
        .select("id, partner_one_email, partner_two_email")
        .or(`partner_one_email.ilike.${writerEmail},partner_two_email.ilike.${writerEmail}`)
        .limit(1);
      const coupleLookupErrorMessage =
        coupleLookupError && typeof coupleLookupError === "object" && "message" in coupleLookupError
          ? String(coupleLookupError.message)
          : null;

      const couple = ((couplesForMember ?? [])[0] as CoupleRow | undefined) ?? null;

      if (coupleLookupError || !couple?.id) {
        setHasBothLetters(false);
        setRevealUnavailableMessage("Your partner’s letter is not available yet.");
        setIsLoading(false);
        return;
      }

      const partnerOneEmail = normalizeEmail(couple.partner_one_email);
      const partnerTwoEmail = normalizeEmail(couple.partner_two_email);

      let expectedWriterEmail: string | null = null;
      if (writerEmail === partnerOneEmail) {
        expectedWriterEmail = partnerTwoEmail;
      } else if (writerEmail === partnerTwoEmail) {
        expectedWriterEmail = partnerOneEmail;
      }

      setDebugInfo((current) => ({
        ...current,
        couple_id: couple.id,
        partnerOneEmail,
        partnerTwoEmail,
        expectedWriterEmail,
        queryError: coupleLookupErrorMessage ?? current.queryError,
      }));

      if (!expectedWriterEmail) {
        setHasBothLetters(false);
        setRevealUnavailableMessage("Your partner’s letter is not available yet.");
        setIsLoading(false);
        return;
      }

      const { data: partnerLetter, error: partnerLetterError } = await supabase
        .from("letters")
        .select("id, writer_email, body, couple_id, cycle_key")
        .eq("couple_id", couple.id)
        .eq("cycle_key", activeCycleKey)
        .ilike("writer_email", expectedWriterEmail)
        .eq("status", "sealed")
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: myLetter, error: myLetterError } = await supabase
        .from("letters")
        .select("id, writer_email, body, couple_id, cycle_key")
        .eq("couple_id", couple.id)
        .eq("cycle_key", activeCycleKey)
        .ilike("writer_email", writerEmail)
        .eq("status", "sealed")
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

      const fallbackLettersQuery = isDevelopment
        ? await supabase
            .from("letters")
            .select("writer_email, status")
            .eq("couple_id", couple.id)
            .eq("cycle_key", activeCycleKey)
            .order("writer_email", { ascending: true })
        : null;

      if (isDevelopment) {
        console.log("[reveal] recipient-author debug", {
          currentUserEmail: writerEmail,
          couple_id: couple.id,
          partnerOneEmail,
          partnerTwoEmail,
          expectedWriterEmail,
          returnedLetterWriterEmail: normalizeEmail(partnerLetter?.writer_email ?? null),
          cycle_key: activeCycleKey,
          queryError:
            partnerLetterError?.message ??
            myLetterError?.message ??
            coupleLookupErrorMessage ??
            promptForRevealCycleError?.message ??
            null,
        });
      }

      setDebugInfo((current) => ({
        ...current,
        returnedLetterWriterEmail: normalizeEmail(partnerLetter?.writer_email ?? null),
        queryError:
          partnerLetterError?.message ??
          myLetterError?.message ??
          coupleLookupErrorMessage ??
          promptForRevealCycleError?.message ??
          null,
        fallbackLetters:
          fallbackLettersQuery?.data?.map((letter) => ({
            writer_email: normalizeEmail(letter.writer_email),
            status: letter.status,
          })) ?? [],
      }));

      if (!isMounted || partnerLetterError || myLetterError) {
        setHasBothLetters(false);
        setRevealUnavailableMessage("Your partner’s letter is not available yet.");
        setIsLoading(false);
        return;
      }

      if (writerEmail) {
        const { data: member } = await supabase
          .from("members")
          .select("partner_display_name")
          .eq("email", writerEmail)
          .maybeSingle();

        const savedPartnerDisplayName = member?.partner_display_name?.trim();
        if (savedPartnerDisplayName) {
          setPartnerDisplayName(savedPartnerDisplayName);
        }
      }

      if (
        !partnerLetter ||
        normalizeEmail(partnerLetter.writer_email) !== expectedWriterEmail
      ) {
        setHasBothLetters(false);
        setRevealUnavailableMessage("Your partner’s letter is not available yet.");
        setIsLoading(false);
        return;
      }

      setMyLetterBody((myLetter as LetterRow | null)?.body ?? null);
      setTheirLetterBody(partnerLetter.body);
      setHasBothLetters(true);
      setIsLoading(false);
    };

    void fetchPrompt();

    return () => {
      isMounted = false;
    };
  }, [isDevelopment, qaUserOverride, todayKey]);

  const handleOpenLetter = () => {
    if (isOpening || isOpen || !hasBothLetters || !revealIsUnlocked) {
      return;
    }

    setIsOpening(true);
    window.setTimeout(() => {
      setIsOpen(true);
      setIsOpening(false);
    }, 850);
  };

  const handleMailMyLetters = async () => {
    setIsSavingPhysicalInterest(true);
    setPhysicalErrorMessage("");
    setPhysicalStatusMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const resolvedEmail =
      sessionData.session?.user.email ||
      (typeof window !== "undefined"
        ? window.localStorage.getItem("love-letter-writer-email")
        : null);

    if (!resolvedEmail) {
      setPhysicalErrorMessage("We couldn't determine your email for this request.");
      setIsSavingPhysicalInterest(false);
      return;
    }

    const { error } = await supabase
      .from("members")
      .update({
        physical_interest: true,
        delivery_type: "physical",
      })
      .eq("email", resolvedEmail);

    if (error) {
      setPhysicalErrorMessage(error.message);
      setIsSavingPhysicalInterest(false);
      return;
    }

    setPhysicalStatusMessage(
      "You're on the printed-letter list. We'll share details before the first mailing."
    );
    setIsSavingPhysicalInterest(false);
  };

  const revealDebugBlock = isDevelopment ? (
    <div className="w-full rounded-md border border-[#e2d2c4] bg-[#fffaf6] px-3 py-2 text-[0.65rem] leading-5 text-[#6f5b58]">
      <label className="mb-2 flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[#8f4f4a]">
        QA User Override
        <select
          value={qaUserOverride}
          onChange={(event) => {
            const nextValue = event.target.value;
            setQaUserOverride(nextValue);

            if (typeof window !== "undefined") {
              if (nextValue) {
                window.localStorage.setItem(REVEAL_QA_USER_KEY, nextValue);
              } else {
                window.localStorage.removeItem(REVEAL_QA_USER_KEY);
              }
            }
          }}
          className="rounded border border-[#d9c7ba] bg-white px-2 py-1 text-[0.7rem] font-normal uppercase tracking-normal text-[#6f5b58]"
        >
          <option value="">Session User</option>
          {REVEAL_QA_USER_OPTIONS.map((option) => (
            <option key={option.email} value={option.email}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <p>currentUserEmail: {debugInfo.currentUserEmail ?? "-"}</p>
      <p>couple_id: {debugInfo.couple_id ?? "-"}</p>
      <p>partnerOneEmail: {debugInfo.partnerOneEmail ?? "-"}</p>
      <p>partnerTwoEmail: {debugInfo.partnerTwoEmail ?? "-"}</p>
      <p>expectedWriterEmail: {debugInfo.expectedWriterEmail ?? "-"}</p>
      <p>returnedLetterWriterEmail: {debugInfo.returnedLetterWriterEmail ?? "-"}</p>
      <p>cycle_key: {debugInfo.cycle_key ?? "-"}</p>
      <p>queryError: {debugInfo.queryError ?? "-"}</p>
      <p>
        fallbackLetters: {debugInfo.fallbackLetters.length > 0
          ? debugInfo.fallbackLetters
              .map((letter) => `${letter.writer_email ?? "-"}/${letter.status ?? "-"}`)
              .join(", ")
          : "-"}
      </p>
    </div>
  ) : null;

  return (
    <main className="min-h-screen bg-[#fbf6f1] px-5 py-8 text-[#161313] sm:px-8 sm:py-10 lg:px-12">
      <div className="mx-auto w-full max-w-4xl">
        <header className="border-b border-[#eadbd0] pb-7 text-center sm:pb-8">
          <p className="font-serif text-2xl tracking-[0.2em] sm:text-3xl sm:tracking-[0.22em]">
            LOVE LETTER <span className="text-[#c97972]">♡</span>
          </p>

          <p className="mt-4 text-[0.7rem] font-bold uppercase tracking-[0.25em] text-[#6f5b58] sm:text-xs">
            {revealDateText}
          </p>

          <h1 className="mt-5 font-serif text-3xl leading-tight sm:text-4xl lg:text-5xl">
            The reveal.
          </h1>

          <p className="mx-auto mt-4 max-w-3xl text-base leading-8 text-[#342d2a] sm:text-lg">
            {promptText}
          </p>

          <p className="mt-5 text-sm italic text-[#6f5b58] sm:text-base">
            Some things are easier to write than to say.
          </p>
        </header>

        {isLoading ? (
          <section className="mx-auto mt-12 max-w-2xl rounded-2xl border border-[#e2d2c4] bg-[#fff7ef] px-7 py-10 text-center shadow-[0_28px_60px_rgba(53,35,31,0.15)] sm:mt-16 sm:px-10">
            <p className="text-sm text-[#6f5b58]">Preparing your reveal...</p>
          </section>
        ) : null}

        {!isLoading && !hasBothLetters ? (
          <section className="mx-auto mt-12 flex max-w-2xl flex-col gap-4 sm:mt-16">
            <div className="rounded-2xl border border-[#e2d2c4] bg-[#fff7ef] px-7 py-10 text-center shadow-[0_28px_60px_rgba(53,35,31,0.15)] sm:px-10">
              <h2 className="font-serif text-4xl leading-tight sm:text-5xl">
                Your letter is sealed.
              </h2>
              <p className="mt-5 text-base leading-8 text-[#4e4440] sm:text-lg">
                {revealUnavailableMessage}
              </p>
              <p className="mt-2 text-base leading-8 text-[#4e4440] sm:text-lg">
                The reveal will unlock when both letters are ready.
              </p>
            </div>
            {revealDebugBlock}
          </section>
        ) : null}

        {!isLoading && hasBothLetters && !revealIsUnlocked ? (
          <section className="mx-auto mt-12 flex max-w-2xl flex-col gap-4 sm:mt-16">
            <div className="rounded-2xl border border-[#e2d2c4] bg-[#fff7ef] px-7 py-10 text-center shadow-[0_28px_60px_rgba(53,35,31,0.15)] sm:px-10">
              <h2 className="font-serif text-4xl leading-tight sm:text-5xl">
                Your letter is sealed.
              </h2>
              <p className="mt-5 text-base leading-8 text-[#4e4440] sm:text-lg">
                We&apos;re waiting for reveal day.
              </p>
              <p className="mt-2 text-base leading-8 text-[#4e4440] sm:text-lg">
                The reveal unlocks on {revealDateText}.
              </p>
            </div>
            {revealDebugBlock}
          </section>
        ) : null}

        {!isLoading && hasBothLetters && revealIsUnlocked ? (
          <section className="mx-auto mt-12 flex max-w-2xl flex-col items-center gap-8 sm:mt-16">
            {!isOpen ? (
              <div className="relative w-full">
                <div className="absolute inset-0 translate-y-2 rounded-2xl bg-[#e9d9ca] blur-xl" />
                <div className="relative overflow-hidden rounded-2xl border border-[#e2d2c4] bg-[#fff7ef] shadow-[0_28px_60px_rgba(53,35,31,0.15)]">
                  <div
                    className={`absolute inset-x-0 top-0 h-36 origin-top bg-gradient-to-b from-[#f5e4d4] to-[#f0ddcb] transition-transform duration-700 ${
                      isOpening ? "-translate-y-full" : "translate-y-0"
                    }`}
                  >
                    <div className="mx-auto mt-6 h-16 w-16 rounded-full border border-[#dcbcab] bg-[#c97972] text-center text-3xl leading-[4rem] text-white shadow-[0_8px_16px_rgba(107,44,44,0.25)]">
                      ♡
                    </div>
                  </div>

                  <div className="flex min-h-[240px] flex-col items-center justify-end px-6 pb-8 pt-40 sm:min-h-[280px] sm:px-8 sm:pt-44">
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#6f5b58]">
                      Letter from {partnerDisplayName}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <article className="paper-grain w-full rounded-2xl border border-[#e2d2c4] bg-[#fffdf9] px-7 py-8 shadow-[0_26px_56px_rgba(53,35,31,0.14)] sm:px-10 sm:py-10">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#6f5b58]">
                  Letter from {partnerDisplayName}
                </p>
                <p className="mt-5 font-serif text-[1.58rem] leading-[1.75] text-[#2d2421] sm:text-[1.9rem] sm:leading-[1.72]">
                  {theirLetterBody}
                </p>
              </article>
            )}

            {!isOpen ? (
              <button
                type="button"
                onClick={handleOpenLetter}
                disabled={isOpening}
                className="w-full rounded-md bg-[#c97972] px-8 py-4 text-center text-xs font-bold uppercase tracking-[0.18em] text-white shadow-[0_12px_30px_rgba(201,121,114,0.22)] transition enabled:hover:-translate-y-0.5 enabled:hover:bg-[#b86b65] disabled:cursor-not-allowed disabled:opacity-70 sm:w-fit"
              >
                {isOpening ? "Opening..." : "Open Their Letter"}
              </button>
            ) : (
              <>
                {!showMyLetter ? (
                  <button
                    type="button"
                    onClick={() => setShowMyLetter(true)}
                    className="rounded-md border border-[#d9c7ba] bg-[#fff8f2] px-8 py-4 text-center text-xs font-bold uppercase tracking-[0.18em] text-[#6f5b58] shadow-[0_10px_24px_rgba(53,35,31,0.08)] transition hover:-translate-y-0.5 hover:border-[#cbb2a2]"
                  >
                    Read My Letter
                  </button>
                ) : (
                  <article className="paper-grain w-full rounded-2xl border border-[#e2d2c4] bg-[#fffdf9] px-7 py-8 shadow-[0_26px_56px_rgba(53,35,31,0.14)] sm:px-10 sm:py-10">
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#6f5b58]">
                      Your letter
                    </p>
                    <p className="mt-5 font-serif text-[1.58rem] leading-[1.75] text-[#2d2421] sm:text-[1.9rem] sm:leading-[1.72]">
                      {myLetterBody}
                    </p>
                  </article>
                )}
              </>
            )}

            {showMyLetter ? (
              <div className="w-full rounded-2xl border border-[#eadbd0] bg-[#fffdfb] p-5 shadow-[0_10px_30px_rgba(53,35,31,0.07)] sm:p-6">
                <h3 className="font-serif text-3xl leading-tight sm:text-4xl">
                  Keep this month&apos;s letters forever.
                </h3>
                <p className="mt-3 text-base leading-8 text-[#4e4440] sm:text-lg">
                  Would you like a printed copy of your letters?
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleMailMyLetters}
                    disabled={isSavingPhysicalInterest}
                    className="rounded-md bg-[#c97972] px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-[0_10px_24px_rgba(201,121,114,0.22)] transition enabled:hover:-translate-y-0.5 enabled:hover:bg-[#b86b65] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSavingPhysicalInterest ? "Saving..." : "Mail My Letters"}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard")}
                    className="rounded-md border border-[#d9c7ba] bg-[#fff8f2] px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-[#6f5b58] transition hover:-translate-y-0.5 hover:border-[#cbb2a2]"
                  >
                    Not Right Now
                  </button>
                </div>

                {physicalErrorMessage ? (
                  <p className="mt-3 text-sm text-[#b2564f]">{physicalErrorMessage}</p>
                ) : null}
                {physicalStatusMessage ? (
                  <p className="mt-3 text-sm text-[#6f5b58]">{physicalStatusMessage}</p>
                ) : null}
              </div>
            ) : null}

            {revealDebugBlock}
          </section>
        ) : null}

        {isDevelopment ? <DevDatePanel /> : null}
      </div>
    </main>
  );
}