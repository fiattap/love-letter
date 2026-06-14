"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { supabase } from "@/lib/supabase";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;

    const handleCallback = async () => {
      const code = searchParams.get("code");
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          if (!cancelled) {
            router.replace("/dashboard?auth_error=1");
          }
          return;
        }

        if (!cancelled) {
          router.replace("/dashboard");
        }
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          if (!cancelled) {
            router.replace("/dashboard?auth_error=1");
          }
          return;
        }

        if (!cancelled) {
          router.replace("/dashboard");
        }
        return;
      }

      if (!cancelled) {
        router.replace("/dashboard?auth_error=no_code");
      }
    };

    void handleCallback();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <main className="min-h-screen bg-[#fbf6f1] px-5 py-8 text-[#161313] sm:px-8 sm:py-10 lg:px-12">
      <div className="mx-auto w-full max-w-xl rounded-2xl border border-[#eadbd0] bg-[#fffaf6] p-6 text-center shadow-[0_16px_42px_rgba(53,35,31,0.09)] sm:p-8">
        <h1 className="font-serif text-4xl leading-tight sm:text-5xl">Signing you in...</h1>
      </div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#fbf6f1] px-5 py-8 text-[#161313] sm:px-8 sm:py-10 lg:px-12">
          <div className="mx-auto w-full max-w-xl rounded-2xl border border-[#eadbd0] bg-[#fffaf6] p-6 text-center shadow-[0_16px_42px_rgba(53,35,31,0.09)] sm:p-8">
            <h1 className="font-serif text-4xl leading-tight sm:text-5xl">Signing you in...</h1>
          </div>
        </main>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
