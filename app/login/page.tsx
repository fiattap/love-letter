"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

function getCallbackUrl() {
  if (typeof window === "undefined") {
    return "http://localhost:3000/auth/callback";
  }

  return `${window.location.origin}/auth/callback`;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) {
        return;
      }

      if (data.session?.user) {
        router.replace("/dashboard");
      }
    };

    void syncSession();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage("Please enter your email.");
      setStatusMessage("");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setStatusMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: {
        emailRedirectTo: getCallbackUrl(),
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
      return;
    }

    setStatusMessage(`Magic link sent to ${trimmedEmail}.`);
    setIsLoading(false);
  };

  return (
    <main className="min-h-screen bg-[#fbf6f1] px-5 py-8 text-[#161313] sm:px-8 sm:py-10 lg:px-12">
      <div className="mx-auto w-full max-w-xl rounded-2xl border border-[#eadbd0] bg-[#fffaf6] p-6 shadow-[0_16px_42px_rgba(53,35,31,0.09)] sm:p-8">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.22em] text-[#6f5b58]">
          Log In
        </p>
        <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">
          Get your magic link.
        </h1>
        <p className="mt-4 text-base leading-8 text-[#4e4440] sm:text-lg">
          Use the same email you joined Love Letter with and we&apos;ll send a secure sign-in link.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="block text-sm font-bold uppercase tracking-[0.12em] text-[#6f5b58]">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-md border border-[#eadbd0] bg-white px-4 py-3 text-base text-[#342d2a] outline-none transition focus:border-[#c97972]"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>

          <button
            type="submit"
            disabled={isLoading}
            className="rounded-md bg-[#c97972] px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-[0_10px_24px_rgba(201,121,114,0.22)] transition enabled:hover:bg-[#b86b65] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? "Sending..." : "Send Magic Link"}
          </button>
        </form>

        {errorMessage ? <p className="mt-4 text-sm text-[#b2564f]">{errorMessage}</p> : null}
        {statusMessage ? <p className="mt-4 text-sm text-[#6f5b58]">{statusMessage}</p> : null}
      </div>
    </main>
  );
}
