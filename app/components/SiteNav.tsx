"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

function LogoMark() {
  // Monogram: an upright L paired with an inverted L that sits slightly higher.
  return (
    <svg
      width="44"
      height="32"
      viewBox="0 0 64 48"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      {/* Upright L */}
      <path
        d="M20 13 V40 H41"
        stroke="#342d2a"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Inverted L, raised slightly above the upright one */}
      <path
        d="M44 35 V8 H23"
        stroke="#c97972"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    setMenuOpen(false);
    setIsSigningOut(false);
    router.push("/");
    router.refresh();
  };

  if (pathname === "/") {
    return null;
  }

  return (
    <header className="border-b border-[#eadbd0] bg-[#fbf6f1] print:hidden">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
        <Link href="/" aria-label="Love Letter home" className="flex items-center">
          <LogoMark />
        </Link>
        <nav>
          {isAuthenticated ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex items-center gap-1.5 text-[0.72rem] font-bold uppercase tracking-[0.18em] text-[#6f5b58] transition hover:text-[#342d2a]"
              >
                Menu
                <span
                  className={`text-[0.6rem] leading-none transition-transform ${menuOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                >
                  ▾
                </span>
              </button>
              {menuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 z-50 mt-3 w-44 overflow-hidden rounded-xl border border-[#eadbd0] bg-[#fffdfb] shadow-[0_16px_40px_rgba(53,35,31,0.14)]"
                >
                  <Link
                    href="/dashboard"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-3 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[#4e4440] transition hover:bg-[#fff4ec]"
                  >
                    Dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    role="menuitem"
                    className="block w-full border-t border-[#eadbd0] px-4 py-3 text-left text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[#6f5b58] transition hover:bg-[#fff4ec] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSigningOut ? "Signing out…" : "Sign Out"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <Link
              href="/login"
              className="text-[0.72rem] font-bold uppercase tracking-[0.18em] text-[#6f5b58] transition hover:text-[#342d2a]"
            >
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
