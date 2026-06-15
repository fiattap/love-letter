"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

import DevDatePanel from "@/app/components/DevDatePanel";
import { getLoveLetterToday, getRevealDateForToday } from "@/lib/loveLetterDate";
import { supabase } from "@/lib/supabase";

const features = [
  ["One question.", "A thoughtful prompt arrives each month."],
  ["Two letters.", "Each person writes privately."],
  ["One reveal.", "Read each other's words for the first time."],
];

const seasons = [
  "New Love",
  "Long Distance",
  "Gratitude",
  "Hard Conversations",
  "Anniversary",
  "Apology",
  "Future Dreams",
  "Recommitment",
];

export default function Home() {
  const isDevelopment = process.env.NODE_ENV === "development";
  const [mounted, setMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [formValues, setFormValues] = useState({
    name: "",
    email: "",
    partnerName: "",
    partnerEmail: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [magicLinkRateLimited, setMagicLinkRateLimited] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({
    name: "",
    email: "",
    partnerName: "",
    partnerEmail: "",
  });
  const [testEmail, setTestEmail] = useState("");
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState("");
  const [testEmailError, setTestEmailError] = useState("");

  const unlockDate = getRevealDateForToday(mounted ? getLoveLetterToday() : new Date());
  const unlockText = unlockDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
  const unlockDisplayText = mounted ? unlockText : "soon";

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) {
        return;
      }

      setIsAuthenticated(Boolean(data.session?.user));
    };

    void syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user));
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const isFormInvalid =
    !formValues.name.trim() ||
    !formValues.email.trim() ||
    !formValues.partnerName.trim() ||
    !formValues.partnerEmail.trim() ||
    !agreedToTerms;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextFieldErrors = {
      name: formValues.name.trim() ? "" : "Please add your name.",
      email: formValues.email.trim() ? "" : "Please add your email.",
      partnerName: formValues.partnerName.trim()
        ? ""
        : "Please add your partner's name.",
      partnerEmail: formValues.partnerEmail.trim()
        ? ""
        : "Please add your partner's email.",
    };

    setFieldErrors(nextFieldErrors);

    if (Object.values(nextFieldErrors).some(Boolean)) {
      setErrorMessage(
        "Love Letter is written by two people. Add your partner so we can send both of you the prompt."
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setMagicLinkRateLimited(false);

    const name = formValues.name.trim();
    const email = formValues.email.trim();
    const partnerName = formValues.partnerName.trim();
    const partnerEmail = formValues.partnerEmail.trim();

    const memberInsertPayload = {
      name,
      email,
      partner_display_name: partnerName,
      status: "pending",
    };

    console.log("MEMBER INSERT PAYLOAD", memberInsertPayload);

    const { data: memberInsertData, error: memberError } = await supabase
      .from("members")
      .insert(memberInsertPayload);

    console.log("MEMBER INSERT RESPONSE", {
      data: memberInsertData,
      error: memberError,
    });

    if (memberError) {
      console.log("MEMBER INSERT ERROR", memberError);
      setErrorMessage(
        process.env.NODE_ENV === "development"
          ? `Something went wrong: ${memberError.message}`
          : "Something went wrong. Please try again."
      );
      setIsSubmitting(false);
      return;
    }

    const { error: coupleError } = await supabase.from("couples").insert({
      partner_one_email: email,
      partner_two_email: partnerEmail,
      status: "pending",
    });

    if (coupleError) {
      console.error("Couples insert failed:", coupleError.message, coupleError);
      setErrorMessage(`Couples insert failed: ${coupleError.message}`);
      setIsSubmitting(false);
      return;
    }

    const appBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
    const origin = appBaseUrl.replace(/\/$/, "");
    const callbackUrl =
      process.env.NODE_ENV === "development"
        ? "http://localhost:3000/auth/callback"
        : `${origin}/auth/callback`;

    console.log("magic link emailRedirectTo:", callbackUrl);

    const isRateLimitError = (message: string) =>
      /rate\s*limit|too many requests|security purposes/i.test(message);

    const { error: userMagicLinkError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl,
      },
    });

    if (isDevelopment) {
      if (userMagicLinkError) {
        console.error("user magic link error", userMagicLinkError.message);
      } else {
        console.log("user magic link success", email);
      }
    }

    const { error: partnerMagicLinkError } = await supabase.auth.signInWithOtp({
      email: partnerEmail,
      options: {
        emailRedirectTo: callbackUrl,
      },
    });

    if (partnerMagicLinkError) {
      console.error("partner magic link error", partnerMagicLinkError.message);
    } else {
      console.log("partner magic link success", partnerEmail);
    }

    if (userMagicLinkError || partnerMagicLinkError) {
      console.error("One or more magic links failed to send after signup.");
    }

    if (
      (userMagicLinkError && isRateLimitError(userMagicLinkError.message)) ||
      (partnerMagicLinkError && isRateLimitError(partnerMagicLinkError.message))
    ) {
      setMagicLinkRateLimited(true);
    }

    setFormValues({
      name: "",
      email: "",
      partnerName: "",
      partnerEmail: "",
    });
    setFieldErrors({
      name: "",
      email: "",
      partnerName: "",
      partnerEmail: "",
    });
    setSubmitted(true);
    setIsSubmitting(false);
  };

  const handleFieldChange = (field: keyof typeof formValues, value: string) => {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    }));

    setFieldErrors((current) => ({
      ...current,
      [field]: "",
    }));
  };

  const handleSendTestPromptEmail = async () => {
    const recipientEmail = testEmail.trim() || formValues.email.trim();

    if (!recipientEmail) {
      setTestEmailError("Please add a test email before sending.");
      setTestEmailStatus("");
      return;
    }

    setIsSendingTestEmail(true);
    setTestEmailError("");
    setTestEmailStatus("");

    try {
      const devDate =
        process.env.NODE_ENV === "development" ? getSimulatedDate() : null;
      const response = await fetch("/api/send-prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: recipientEmail, devDate }),
      });

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setTestEmailError(
          result.error ?? "Could not send test prompt email. Please try again."
        );
        setIsSendingTestEmail(false);
        return;
      }

      setTestEmailStatus(
        `Success: test prompt email sent to ${recipientEmail}.`
      );
    } catch {
      setTestEmailError("Could not send test prompt email. Please try again.");
    }

    setIsSendingTestEmail(false);
  };

  const getSimulatedDate = () =>
    typeof window !== "undefined"
      ? window.localStorage.getItem("love-letter-dev-date")
      : null;


  return (
    <main className="min-h-screen bg-[#fbf6f1] text-[#161313]">
      <div className="border-b border-[#eadbd0] bg-[#f1e4d6] px-4 py-2 text-center text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#6f5b58] sm:text-xs">
        ♡ Our next letters unlock {unlockDisplayText}.
      </div>
      <nav className="sticky top-0 z-50 border-b border-[#eadbd0]/80 bg-[#fbf6f1]/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-[1500px] items-center justify-between gap-4 px-5 py-3 sm:px-8 lg:px-10">
          <a
            href="#start"
            className="shrink-0 font-serif text-[1.05rem] tracking-[0.14em] sm:text-[1.35rem] sm:tracking-[0.2em]"
          >
            LOVE LETTER <span className="text-[#c97972]">♡</span>
          </a>

          <div className="hidden flex-1 items-center justify-end gap-8 lg:flex">
            <div className="flex items-center gap-8 text-xs font-bold uppercase tracking-[0.18em]">
              <a className="transition hover:text-[#c97972]" href="#how">
                Features
              </a>
              <a className="transition hover:text-[#c97972]" href="#examples">
                Examples
              </a>
              <a className="transition hover:text-[#c97972]" href="#about">
                About
              </a>
              <a className="transition hover:text-[#c97972]" href="#faq">
                FAQ
              </a>
            </div>

            <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-[0.18em]">
              <Link
                href={isAuthenticated ? "/dashboard" : "/login"}
                className="text-[#6f5b58] transition hover:text-[#342d2a]"
              >
                {isAuthenticated ? "Dashboard" : "Sign In"}
              </Link>
              <a
                className="rounded-md bg-[#c97972] px-6 py-3 text-white shadow-[0_12px_30px_rgba(201,121,114,0.22)] transition hover:-translate-y-0.5 hover:bg-[#b86b65]"
                href="#join"
              >
                Join Love Letter
              </a>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((current) => !current)}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-landing-menu"
            className="lg:hidden rounded-md border border-[#d9c7ba] bg-[#fff8f2] px-3 py-2 text-[0.58rem] font-bold uppercase tracking-[0.12em] text-[#6f5b58]"
          >
            Menu
          </button>
        </div>

        {isMobileMenuOpen ? (
          <div id="mobile-landing-menu" className="border-t border-[#eadbd0] bg-[#fbf6f1] px-5 py-4 lg:hidden">
            <div className="flex flex-col gap-3 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#6f5b58]">
              <a className="transition hover:text-[#c97972]" href="#how" onClick={() => setIsMobileMenuOpen(false)}>
                Features
              </a>
              <a className="transition hover:text-[#c97972]" href="#examples" onClick={() => setIsMobileMenuOpen(false)}>
                Examples
              </a>
              <a className="transition hover:text-[#c97972]" href="#about" onClick={() => setIsMobileMenuOpen(false)}>
                About
              </a>
              <a className="transition hover:text-[#c97972]" href="#faq" onClick={() => setIsMobileMenuOpen(false)}>
                FAQ
              </a>
              <Link
                href={isAuthenticated ? "/dashboard" : "/login"}
                onClick={() => setIsMobileMenuOpen(false)}
                className="transition hover:text-[#342d2a]"
              >
                {isAuthenticated ? "Dashboard" : "Sign In"}
              </Link>
              <a
                href="#join"
                onClick={() => setIsMobileMenuOpen(false)}
                className="mt-1 inline-block rounded-md bg-[#c97972] px-4 py-2 text-center text-[0.62rem] font-bold uppercase tracking-[0.12em] text-white"
              >
                Join Love Letter
              </a>
            </div>
          </div>
        ) : null}
      </nav>

      <section
        id="start"
        className="grid border-b border-[#e8d9cc] lg:min-h-[calc(100vh-4.5rem)] lg:grid-cols-[40%_60%]"
      >
        <div className="flex flex-col justify-center px-6 pb-10 pt-7 sm:px-16 sm:py-14 xl:pl-28 xl:pr-14">
          <p className="text-[0.66rem] font-bold uppercase leading-6 tracking-[0.3em] text-[#241f1d] sm:text-xs sm:leading-7 sm:tracking-[0.38em]">
            One question.
            <br />
            Two letters. <span className="text-[#c97972]">One reveal.</span>
          </p>

          <h1 className="mt-5 font-serif text-[3.2rem] leading-[0.92] tracking-[-0.05em] sm:mt-7 sm:text-[6.5rem] sm:tracking-[-0.06em] xl:text-[7.8rem]">
            Love
            <br />
            Letter
          </h1>

          <p className="mt-5 max-w-md font-serif text-[1.2rem] leading-7 sm:mt-7 sm:text-2xl sm:leading-9">
            Some things are easier to write than to say.
          </p>

          <p className="mt-4 max-w-md text-[0.96rem] leading-7 text-[#342d2a] sm:mt-5 sm:text-lg sm:leading-8">
            Once a month, you and your person answer the same prompt privately.
            Your letters unlock only when both of you are ready.
          </p>

          <a
            href="#join"
            className="mt-6 w-full rounded-md bg-[#c97972] px-6 py-4 text-center text-[0.66rem] font-bold uppercase tracking-[0.16em] text-white shadow-[0_14px_35px_rgba(201,121,114,0.25)] transition hover:-translate-y-0.5 hover:bg-[#b86b65] sm:mt-8 sm:w-fit sm:px-11 sm:py-5 sm:text-[0.7rem] sm:tracking-[0.18em]"
          >
            Join Love Letter
          </a>

          <div className="mt-5 flex max-w-md flex-wrap gap-x-4 gap-y-2 text-[0.68rem] text-[#7a6560] sm:mt-6 sm:text-[0.72rem]">
            <span>♡ Monthly prompt</span>
            <span>♡ Private letters</span>
            <span>♡ Reveal together</span>
          </div>
        </div>

        <div className="relative h-[270px] overflow-hidden bg-[#ead8c7] sm:h-[520px] lg:h-auto lg:min-h-[calc(100vh-4.5rem)]">
          <div
            className="absolute inset-0 bg-cover bg-center sm:bg-[center_38%] lg:bg-[center_42%]"
            style={{ backgroundImage: "url('/hero-stationery.jpg')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#fbf6f1]/20 via-transparent to-transparent lg:bg-gradient-to-r lg:from-[#fbf6f1]/10" />
        </div>
      </section>

      <section
        id="about"
        className="grid border-b border-[#e8d9cc] bg-[#fbf6f1] px-7 py-16 md:grid-cols-2 md:py-20 lg:px-10"
      >
        <div className="border-[#e2d1c2] text-center md:border-r">
          <p className="text-xs font-bold uppercase tracking-[0.32em] text-[#c97972]">
            For the words
          </p>
          <h2 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl md:text-6xl">
            That deserve
            <br />
            more than a text.
          </h2>
          <p className="mt-6 text-3xl text-[#c97972]">♡</p>
        </div>

        <div className="mt-10 flex items-center justify-center px-0 md:mt-0 md:px-12">
          <p className="max-w-xl text-base leading-8 text-[#342d2a] sm:text-lg sm:leading-9">
            Love Letter helps couples create a monthly ritual of honest reflections,
            quiet memories, and words worth keeping.
          </p>
        </div>
      </section>

      <section
        id="how"
        className="border-b border-[#e8d9cc] bg-[#fbf6f1] px-7 py-16 md:py-20"
      >
        <p className="mb-12 text-center text-xs font-bold uppercase tracking-[0.3em] sm:tracking-[0.38em]">
          A ritual worth keeping
        </p>

        <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-3">
          {features.map(([title, body], i) => (
            <div
              key={title}
              className="border-[#e2d1c2] px-4 text-center md:border-r md:px-8 md:last:border-r-0"
            >
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#f1e8df] text-3xl text-[#c97972]">
                {["?", "✎", "♡"][i]}
              </div>
              <h3 className="font-serif text-3xl">{title}</h3>
              <p className="mt-3 text-base leading-7 text-[#4e4440]">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        id="examples"
        className="border-b border-[#e8d9cc] bg-[#fbf6f1] px-7 py-16"
      >
        <p className="mb-12 text-center text-xs font-bold uppercase tracking-[0.3em] sm:tracking-[0.38em]">
          Letters for every season of love
        </p>

        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-10 text-center md:grid-cols-4 lg:grid-cols-8">
          {seasons.map((item) => (
            <div key={item} className="group">
              <div className="mb-3 text-4xl text-[#c97972] transition group-hover:-translate-y-1">
                ♡
              </div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em]">
                {item}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid border-b border-[#e8d9cc] lg:min-h-[380px] lg:grid-cols-[40%_60%]">
        <div className="flex flex-col justify-center bg-[#f1e4d6] px-7 py-16 sm:px-16 xl:px-24">
          <h2 className="font-serif text-4xl leading-tight sm:text-5xl md:text-6xl">
            A keepsake,
            <br />
            not just a message.
          </h2>
          <p className="mt-5 max-w-md leading-8 text-[#342d2a]">
            Every letter is designed to feel personal, thoughtful, and lasting —
            something you can return to again and again.
          </p>
          <a
            href="#join"
            className="mt-7 w-full rounded-md bg-[#c97972] px-8 py-4 text-center text-xs font-bold uppercase tracking-[0.18em] text-white shadow-[0_12px_30px_rgba(201,121,114,0.22)] transition hover:-translate-y-0.5 hover:bg-[#b86b65] sm:w-fit sm:px-9"
          >
            Join Love Letter
          </a>
        </div>

        <div
          className="min-h-[320px] bg-cover bg-center sm:min-h-[420px]"
          style={{ backgroundImage: "url('/keepsake-stationery.jpg')" }}
        />
      </section>

      <section
        id="join"
        className="border-b border-[#e8d9cc] bg-[#fbf6f1] px-7 py-16 sm:py-20"
      >
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#eadbd0] bg-[#fffaf6] p-6 shadow-[0_14px_40px_rgba(53,35,31,0.08)] sm:p-10">
          {!submitted ? (
            <>
              <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-[#6f5b58]">
                Join Love Letter.
              </p>
              <h2 className="mt-5 text-center font-serif text-4xl leading-tight sm:text-5xl">
                Join Love Letter.
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-center text-base leading-8 text-[#4e4440] sm:text-lg">
                Our next letters unlock {unlockDisplayText}.
              </p>
              <p className="mx-auto mt-2 max-w-2xl text-center text-base leading-8 text-[#4e4440] sm:text-lg">
                We&apos;ll send both of you your first prompt when the writing window opens.
              </p>
              <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-7 text-[#6f5b58] sm:text-base">
                Love Letter is written by two people. Add your partner so we can
                send both of you the prompt.
              </p>

              <form className="mt-10 grid gap-5" onSubmit={handleSubmit} noValidate>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-bold text-[#342d2a]">
                    Your name
                    <input
                      type="text"
                      value={formValues.name}
                      onChange={(event) =>
                        handleFieldChange("name", event.target.value)
                      }
                      className="rounded-md border border-[#eadbd0] bg-white px-4 py-3 text-base outline-none transition focus:border-[#c97972]"
                      placeholder="Jordan"
                    />
                    {fieldErrors.name ? (
                      <span className="text-xs font-normal text-[#b2564f]">{fieldErrors.name}</span>
                    ) : null}
                  </label>

                  <label className="grid gap-2 text-sm font-bold text-[#342d2a]">
                    Your email
                    <input
                      type="email"
                      value={formValues.email}
                      onChange={(event) =>
                        handleFieldChange("email", event.target.value)
                      }
                      className="rounded-md border border-[#eadbd0] bg-white px-4 py-3 text-base outline-none transition focus:border-[#c97972]"
                      placeholder="you@example.com"
                    />
                    {fieldErrors.email ? (
                      <span className="text-xs font-normal text-[#b2564f]">{fieldErrors.email}</span>
                    ) : null}
                  </label>

                  <label className="grid gap-2 text-sm font-bold text-[#342d2a]">
                    Partner&apos;s name
                    <input
                      type="text"
                      value={formValues.partnerName}
                      onChange={(event) =>
                        handleFieldChange("partnerName", event.target.value)
                      }
                      className="rounded-md border border-[#eadbd0] bg-white px-4 py-3 text-base outline-none transition focus:border-[#c97972]"
                      placeholder="Alex"
                    />
                    {fieldErrors.partnerName ? (
                      <span className="text-xs font-normal text-[#b2564f]">
                        {fieldErrors.partnerName}
                      </span>
                    ) : null}
                  </label>

                  <label className="grid gap-2 text-sm font-bold text-[#342d2a]">
                    Partner&apos;s email
                    <input
                      type="email"
                      value={formValues.partnerEmail}
                      onChange={(event) =>
                        handleFieldChange("partnerEmail", event.target.value)
                      }
                      className="rounded-md border border-[#eadbd0] bg-white px-4 py-3 text-base outline-none transition focus:border-[#c97972]"
                      placeholder="partner@example.com"
                    />
                    {fieldErrors.partnerEmail ? (
                      <span className="text-xs font-normal text-[#b2564f]">
                        {fieldErrors.partnerEmail}
                      </span>
                    ) : null}
                  </label>
                </div>

                {errorMessage ? (
                  <p className="text-sm text-[#b2564f]">{errorMessage}</p>
                ) : null}

                <label className="flex items-start gap-3 text-sm leading-6 text-[#4e4440]">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(event) => setAgreedToTerms(event.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#c97972]"
                  />
                  <span>
                    I agree to the{" "}
                    <a
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-[#c97972] underline underline-offset-2"
                    >
                      Terms &amp; Conditions
                    </a>
                    .
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting || isFormInvalid}
                  className="mt-2 w-full rounded-md bg-[#c97972] px-8 py-4 text-center text-xs font-bold uppercase tracking-[0.18em] text-white shadow-[0_12px_30px_rgba(201,121,114,0.22)] transition hover:-translate-y-0.5 hover:bg-[#b86b65] sm:w-fit"
                >
                  {isSubmitting ? "Joining Love Letter..." : "Join Love Letter"}
                </button>
              </form>
            </>
          ) : (
            <div className="py-4 text-center">
              <h2 className="font-serif text-4xl leading-tight sm:text-5xl">
                You&apos;re in.
              </h2>
              <p className="mt-6 text-base leading-8 text-[#4e4440] sm:text-lg">
                {magicLinkRateLimited
                  ? "Supabase temporarily rate-limited the dashboard email during testing. Try again with a different email or wait before requesting another link."
                  : "We sent dashboard links to both of you."}
              </p>

              <a
                href="/dashboard"
                className="mt-7 inline-block rounded-md bg-[#c97972] px-8 py-4 text-center text-xs font-bold uppercase tracking-[0.18em] text-white shadow-[0_12px_30px_rgba(201,121,114,0.22)] transition hover:-translate-y-0.5 hover:bg-[#b86b65] sm:w-fit"
              >
                Go to Dashboard
              </a>
            </div>
          )}

          {isDevelopment ? (
            <>
              <DevDatePanel />

              <div className="mt-8 border-t border-[#eadbd0] pt-8">
              <p className="text-center text-[0.68rem] font-bold uppercase tracking-[0.22em] text-[#6f5b58]">
                Dev only
              </p>
              <div className="mx-auto mt-5 max-w-xl rounded-xl border border-[#eadbd0] bg-[#fffdfb] p-4 sm:p-5">
                <label className="grid gap-2 text-sm font-bold text-[#342d2a]">
                  Test email
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(event) => setTestEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="rounded-md border border-[#eadbd0] bg-white px-4 py-3 text-base outline-none transition focus:border-[#c97972]"
                  />
                </label>

                {testEmailError ? (
                  <p className="mt-4 text-sm text-[#b2564f]">{testEmailError}</p>
                ) : null}

                {testEmailStatus ? (
                  <p className="mt-4 text-sm text-[#6f5b58]">{testEmailStatus}</p>
                ) : null}

                <button
                  type="button"
                  onClick={handleSendTestPromptEmail}
                  disabled={isSendingTestEmail}
                  className="mt-5 w-full rounded-md border border-[#d9c7ba] bg-[#fff8f2] px-6 py-4 text-center text-xs font-bold uppercase tracking-[0.18em] text-[#6f5b58] shadow-[0_10px_24px_rgba(53,35,31,0.08)] transition enabled:hover:-translate-y-0.5 enabled:hover:border-[#cbb2a2] disabled:cursor-not-allowed disabled:opacity-70 sm:w-fit"
                >
                  {isSendingTestEmail
                    ? "Sending Test Prompt Email..."
                    : "Send Test Prompt Email"}
                </button>
              </div>
              </div>
            </>
          ) : null}
        </div>
      </section>


      <footer id="faq" className="bg-[#fbf6f1] px-7 py-10">
        <div className="mx-auto grid max-w-[1300px] gap-10 md:grid-cols-4">
          <div>
            <p className="font-serif text-xl tracking-[0.2em] sm:text-2xl sm:tracking-[0.22em]">
              LOVE LETTER <span className="text-[#c97972]">♡</span>
            </p>
            <p className="mt-3 font-serif text-2xl italic text-[#6f5b58]">
              For the words we keep.
            </p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em]">Explore</p>
            <div className="mt-3 space-y-1 text-sm text-[#4e4440]">
              <p>Features</p>
              <p>Examples</p>
              <p>Pricing</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em]">Support</p>
            <div className="mt-3 space-y-1 text-sm text-[#4e4440]">
              <p>FAQ</p>
              <p>Privacy</p>
              <p>Contact</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em]">
              Letters in your inbox
            </p>
            <div className="mt-4 flex overflow-hidden rounded-sm border border-[#e1cbb9]">
              <input
                className="w-full bg-white px-4 py-3 text-sm outline-none placeholder:text-[#9b8781]"
                placeholder="Your email"
              />
              <button className="bg-[#c97972] px-5 text-white transition hover:bg-[#b86b65]">
                →
              </button>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}