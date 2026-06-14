import Link from "next/link";

export default function WaitingPage() {
  return (
    <main className="min-h-screen bg-[#fbf6f1] px-5 py-8 text-[#161313] sm:px-8 sm:py-10 lg:px-12">
      <div className="mx-auto w-full max-w-3xl">
        <header className="border-b border-[#eadbd0] pb-7 text-center sm:pb-8">
          <p className="font-serif text-2xl tracking-[0.2em] sm:text-3xl sm:tracking-[0.22em]">
            LOVE LETTER <span className="text-[#c97972]">♡</span>
          </p>
        </header>

        <section className="mt-8 rounded-2xl border border-[#eadbd0] bg-[#fffaf6] p-6 shadow-[0_16px_42px_rgba(53,35,31,0.09)] sm:mt-10 sm:p-10">
          <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
            Your letter is sealed.
          </h1>
          <p className="mt-5 text-base leading-8 text-[#4e4440] sm:text-lg">
            We&apos;ve safely tucked your words away.
          </p>
          <p className="mt-3 text-base leading-8 text-[#4e4440] sm:text-lg">
            We&apos;re waiting for your partner to finish writing before the reveal.
          </p>

          <div className="mt-8 space-y-3 rounded-xl border border-[#e9dbcf] bg-[#fffdfb] p-5">
            <p className="text-sm font-bold text-[#2f2723]">✓ Your letter submitted</p>
            <p className="text-sm text-[#6f5b58]">○ Partner writing</p>
          </div>

          <p className="mt-6 text-sm italic text-[#6f5b58]">
            The reveal happens when both letters are ready.
          </p>

          <Link
            href="/"
            className="mt-8 inline-block w-full rounded-md border border-[#d9c7ba] bg-[#fff8f2] px-8 py-4 text-center text-xs font-bold uppercase tracking-[0.18em] text-[#6f5b58] shadow-[0_10px_24px_rgba(53,35,31,0.08)] transition hover:-translate-y-0.5 hover:border-[#cbb2a2] sm:w-fit"
          >
            Return Home
          </Link>
        </section>
      </div>
    </main>
  );
}
