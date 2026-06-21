"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-[#c97972] px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-[0_10px_24px_rgba(201,121,114,0.22)] transition hover:-translate-y-0.5 hover:bg-[#b86b65] print:hidden"
    >
      Print these letters
    </button>
  );
}
