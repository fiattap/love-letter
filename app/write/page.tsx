"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import DevDatePanel from "@/app/components/DevDatePanel";
import {
  getCycleScheduleForRevealDate,
  getLoveLetterToday,
  getRevealDateFromMonthKey,
  getRevealDateForToday,
  getSignupCycleState,
} from "@/lib/loveLetterDate";
import {
  type ActivePrompt,
  loadActivePromptWithDebug,
  PROMPT_FALLBACK_TEXT,
} from "@/lib/prompts";
import { supabase } from "@/lib/supabase";

function formatDateForUi(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}

export default function WritePage() {
  const isDevelopment = process.env.NODE_ENV === "development";
  const router = useRouter();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [writerEmail, setWriterEmail] = useState<string | null>(null);
  const [coupleId, setCoupleId] = useState<number | null>(null);
  const [partnerDisplayName, setPartnerDisplayName] = useState("your partner");
  const [letter, setLetter] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [activePrompt, setActivePrompt] = useState<ActivePrompt | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

  const today = sessionChecked ? getLoveLetterToday() : new Date();
  const revealDate =
    (activePrompt?.month_key ? getRevealDateFromMonthKey(activePrompt.month_key) : null) ??
    getRevealDateForToday(today);
  const cycleState = sessionChecked && activePrompt ? getSignupCycleState(today, revealDate) : null;
  const writingIsOpen = cycleState?.phase === "during";

  const unlockText = revealDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });

  const promptText = activePrompt?.prompt ?? PROMPT_FALLBACK_TEXT;

  useEffect(() => {
    let isMounted = true;

    const loadPage = async () => {
      const [promptResult, sessionResult] = await Promise.all([
        loadActivePromptWithDebug(),
        supabase.auth.getSession(),
      ]);

      if (!isMounted) {
        return;
      }

      setActivePrompt(promptResult.prompt);

      if (promptResult.errorMessage) {
        setErrorMessage(`Prompt load failed: ${promptResult.errorMessage}`);
      }

      if (sessionResult.error) {
        setSessionChecked(true);
        router.replace("/dashboard");
        return;
      }

      const sessionEmail = sessionResult.data.session?.user.email?.trim() ?? null;
      if (!sessionEmail) {
        setSessionChecked(true);
        router.replace("/dashboard");
        return;
      }

      setWriterEmail(sessionEmail);
      setCoupleId(null);
      setSessionChecked(true);

      const { data: selfMember } = await supabase
        .from("members")
        .select("partner_display_name")
        .eq("email", sessionEmail)
        .maybeSingle();

      let partnerEmail: string | null = null;
      const { data: asPartnerOne } = await supabase
        .from("couples")
        .select("id, partner_one_email, partner_two_email")
        .eq("partner_one_email", sessionEmail)
        .maybeSingle();

      if (asPartnerOne?.id && asPartnerOne.partner_two_email) {
        setCoupleId(asPartnerOne.id);
        partnerEmail = asPartnerOne.partner_two_email;
      } else {
        const { data: asPartnerTwo } = await supabase
          .from("couples")
          .select("id, partner_one_email, partner_two_email")
          .eq("partner_two_email", sessionEmail)
          .maybeSingle();

        if (asPartnerTwo?.id && asPartnerTwo.partner_one_email) {
          setCoupleId(asPartnerTwo.id);
          partnerEmail = asPartnerTwo.partner_one_email;
        }
      }

      if (!partnerEmail) {
        return;
      }

      const { data: partnerMember } = await supabase
        .from("members")
        .select("name, email")
        .eq("email", partnerEmail)
        .maybeSingle();

      const partnerName = partnerMember?.name?.trim();
      const persistedDisplayName = selfMember?.partner_display_name?.trim() || "";
      const persistedIsPartnerEmail =
        Boolean(persistedDisplayName) &&
        persistedDisplayName.toLowerCase() === partnerEmail.toLowerCase();
      const shouldPreferPartnerName = persistedIsPartnerEmail && Boolean(partnerName);
      const nextPartnerDisplayName = shouldPreferPartnerName
        ? (partnerName ?? partnerEmail)
        : persistedDisplayName || partnerName || partnerEmail;

      setPartnerDisplayName(nextPartnerDisplayName);

      if (!persistedDisplayName || shouldPreferPartnerName) {
        await supabase
          .from("members")
          .update({ partner_display_name: nextPartnerDisplayName })
          .eq("email", sessionEmail);
      }
    };

    void loadPage();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleSavePartnerName = async () => {
    const nextName = nameInput.trim();
    if (!nextName || !writerEmail) {
      setIsEditingName(false);
      return;
    }

    setIsSavingName(true);
    await supabase
      .from("members")
      .update({ partner_display_name: nextName })
      .ilike("email", writerEmail);
    setPartnerDisplayName(nextName);
    setIsSavingName(false);
    setIsEditingName(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!sessionChecked || !writerEmail) {
      router.replace("/dashboard");
      return;
    }

    if (!letter.trim()) {
      setErrorMessage("Please add your letter.");
      return;
    }

    if (!activePrompt?.prompt) {
      setErrorMessage(PROMPT_FALLBACK_TEXT);
      return;
    }

    if (!coupleId) {
      setErrorMessage("We could not find your couple pairing yet.");
      return;
    }

    if (!writingIsOpen) {
      if (cycleState?.phase === "before") {
        setErrorMessage(`Writing opens ${formatDateForUi(cycleState.writingWindow.writingOpens)}.`);
      } else if (cycleState?.phase === "after") {
        setErrorMessage(
          `Writing is closed. Reveal unlocks ${formatDateForUi(cycleState.writingWindow.revealUnlocks)}.`
        );
      } else {
        setErrorMessage("This writing window has ended.");
      }
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    const cycleKey = activePrompt.month_key || getCycleScheduleForRevealDate(revealDate).cycleKey;

    const { error } = await supabase.from("letters").insert({
      writer_email: writerEmail,
      prompt: activePrompt.prompt,
      body: letter.trim(),
      status: "sealed",
      couple_id: coupleId,
      cycle_key: cycleKey,
    });

    if (error) {
      setErrorMessage("Something went wrong. Please try again.");
      setIsSubmitting(false);
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem("love-letter-writer-email", writerEmail);
    }

    setLetter("");
    setIsSubmitting(false);
    router.push("/waiting");
  };

  return (
    <main className="min-h-screen bg-[#fbf6f1] px-5 py-8 text-[#161313] sm:px-8 sm:py-10 lg:px-12">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-8 border-b border-[#eadbd0] pb-5 sm:mb-10 sm:pb-6">
          <p className="font-serif text-2xl tracking-[0.2em] sm:text-3xl sm:tracking-[0.22em]">
            LOVE LETTER <span className="text-[#c97972]">♡</span>
          </p>
          <p className="mt-3 text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[#6f5b58] sm:text-xs">
            Next letters unlock {unlockText}
          </p>
        </header>

        <section className="rounded-2xl border border-[#eadbd0] bg-[#fffaf6] p-5 shadow-[0_16px_42px_rgba(53,35,31,0.09)] sm:p-8 lg:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.26em] text-[#6f5b58]">
            Monthly prompt
          </p>
          <h1 className="mt-4 font-serif text-3xl leading-tight sm:text-4xl lg:text-5xl">
            Write your letter.
          </h1>
          <p className="mt-5 text-base leading-8 text-[#342d2a] sm:text-lg">{promptText}</p>

          {!sessionChecked ? (
              <div className="mt-7 rounded-xl border border-[#eadbd0] bg-[#fffdfb] p-6 shadow-[0_10px_30px_rgba(53,35,31,0.07)] sm:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#6f5b58]">
                  Session
                </p>
                <h2 className="mt-4 font-serif text-3xl leading-tight sm:text-4xl">
                  Checking your session...
                </h2>
              </div>
            ) : cycleState ? (
              writingIsOpen ? (
                <form className="mt-7" onSubmit={handleSubmit}>
                  <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-[#4e4440] sm:text-lg">
                    <span>
                      Writing to <span className="font-semibold text-[#342d2a]">{partnerDisplayName}</span>{" "}
                      <span className="text-[#c97972]">♡</span>
                    </span>
                    {!isEditingName ? (
                      <button
                        type="button"
                        onClick={() => {
                          setNameInput(partnerDisplayName);
                          setIsEditingName(true);
                        }}
                        className="text-xs font-bold uppercase tracking-[0.12em] text-[#6f5b58] underline-offset-2 transition hover:text-[#c97972] hover:underline"
                      >
                        Edit name
                      </button>
                    ) : null}
                  </div>

                  {isEditingName ? (
                    <div className="mb-5 rounded-xl border border-[#e4d4c7] bg-[#fffdfa] p-4">
                      <label className="grid gap-2 text-sm font-bold text-[#342d2a]" htmlFor="partner-name-edit">
                        What do you call them?
                        <input
                          id="partner-name-edit"
                          type="text"
                          value={nameInput}
                          onChange={(event) => setNameInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void handleSavePartnerName();
                            }
                          }}
                          className="rounded-md border border-[#e4d4c7] bg-white px-4 py-3 text-base outline-none transition focus:border-[#c97972]"
                        />
                      </label>
                      <div className="mt-3 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={handleSavePartnerName}
                          disabled={isSavingName}
                          className="rounded-md bg-[#c97972] px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-white transition enabled:hover:-translate-y-0.5 enabled:hover:bg-[#b86b65] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isSavingName ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingName(false)}
                          className="rounded-md border border-[#d9c7ba] bg-[#fff8f2] px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-[#6f5b58] transition hover:-translate-y-0.5 hover:border-[#cbb2a2]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <label className="sr-only" htmlFor="letter-body">
                    Your letter
                  </label>
                  <textarea
                    id="letter-body"
                    value={letter}
                    onChange={(event) => setLetter(event.target.value)}
                    placeholder="Begin your letter here..."
                    className="paper-grain min-h-[320px] w-full resize-y rounded-xl border border-[#e4d4c7] bg-[#fffdfa] px-5 py-6 text-[1.02rem] leading-8 text-[#2f2723] outline-none transition placeholder:text-[#9d8a83] focus:border-[#c97972] sm:min-h-[380px] sm:px-7 sm:py-7 sm:text-[1.08rem]"
                  />

                  {errorMessage ? <p className="mt-4 text-sm text-[#b2564f]">{errorMessage}</p> : null}

                  <button
                    type="submit"
                    disabled={isSubmitting || !activePrompt || !writingIsOpen}
                    className="mt-6 w-full rounded-md bg-[#c97972] px-8 py-4 text-center text-xs font-bold uppercase tracking-[0.18em] text-white shadow-[0_12px_30px_rgba(201,121,114,0.22)] transition enabled:hover:-translate-y-0.5 enabled:hover:bg-[#b86b65] disabled:cursor-not-allowed disabled:opacity-70 sm:w-fit"
                  >
                    {isSubmitting ? "Sealing..." : "Seal My Letter"}
                  </button>
                </form>
              ) : (
                <div className="mt-7 rounded-xl border border-[#eadbd0] bg-[#fffdfb] p-6 shadow-[0_10px_30px_rgba(53,35,31,0.07)] sm:p-8">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#6f5b58]">
                    Writing window
                  </p>
                  <h2 className="mt-4 font-serif text-3xl leading-tight sm:text-4xl">
                    {cycleState.phase === "before"
                      ? `Writing opens ${formatDateForUi(cycleState.writingWindow.writingOpens)}.`
                      : `Writing is closed. Reveal unlocks ${formatDateForUi(cycleState.writingWindow.revealUnlocks)}.`}
                  </h2>
                  <p className="mt-4 text-base leading-8 text-[#342d2a] sm:text-lg">
                    {cycleState.phase === "before"
                      ? `Prompt available ${formatDateForUi(cycleState.writingWindow.writingOpens)}.`
                      : "Come back when the next writing window opens."}
                  </p>
                </div>
              )
            ) : (
              <div className="mt-7 rounded-xl border border-[#eadbd0] bg-[#fffdfb] p-6 shadow-[0_10px_30px_rgba(53,35,31,0.07)] sm:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#6f5b58]">
                  Writing window
                </p>
                <h2 className="mt-4 font-serif text-3xl leading-tight sm:text-4xl">
                  Loading your Love Letter window...
                </h2>
                <p className="mt-4 text-base leading-8 text-[#342d2a] sm:text-lg">
                  We&apos;re checking when writing opens.
                </p>
              </div>
            )}
        </section>

        {isDevelopment ? <DevDatePanel /> : null}
      </div>
    </main>
  );
}
