"use client";

import { type FormEvent, useState } from "react";

type AdminLoginFormProps = {
  configured: boolean;
};

export default function AdminLoginForm({ configured }: AdminLoginFormProps) {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!secret.trim() || submitting) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: secret.trim() }),
      });

      if (!response.ok) {
        setError(
          response.status === 401
            ? "Incorrect password. Try again."
            : "Admin access isn't configured yet."
        );
        setSubmitting(false);
        return;
      }

      // Cookie is set; reload so the server re-renders the authorized view.
      window.location.assign("/admin");
    } catch {
      setError("Something went wrong. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fbf6f1] px-5 py-8 text-[#161313] sm:px-8 sm:py-10 lg:px-12">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-[#eadbd0] bg-[#fffaf6] p-7 text-center shadow-[0_16px_42px_rgba(53,35,31,0.09)] sm:p-9">
        <h1 className="font-serif text-3xl leading-tight sm:text-4xl">Admin access</h1>
        <p className="mt-3 text-sm leading-7 text-[#6f5b58]">
          {configured
            ? "Enter the admin password to continue."
            : "Admin access isn't configured. Set ADMIN_SECRET in your environment first."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
          <input
            type="password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            placeholder="Admin password"
            autoComplete="current-password"
            disabled={!configured || submitting}
            className="w-full rounded-md border border-[#e7d5c8] bg-white px-4 py-3 text-center text-sm text-[#342d2a] outline-none focus:border-[#c97972] disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!configured || submitting || !secret.trim()}
            className="rounded-md bg-[#c97972] px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-[0_10px_24px_rgba(201,121,114,0.22)] transition hover:-translate-y-0.5 hover:bg-[#b86b65] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {submitting ? "Checking…" : "Enter"}
          </button>
        </form>

        {error ? <p className="mt-4 text-sm text-[#b2564f]">{error}</p> : null}
      </div>
    </main>
  );
}
