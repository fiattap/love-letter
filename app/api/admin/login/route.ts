import { NextResponse } from "next/server";

import { ADMIN_COOKIE_NAME } from "@/lib/adminAuth";

export async function POST(request: Request) {
  const expectedSecret = process.env.ADMIN_SECRET?.trim();

  if (!expectedSecret) {
    return NextResponse.json(
      { error: "Admin access is not configured." },
      { status: 500 }
    );
  }

  let providedSecret = "";
  try {
    const body = (await request.json()) as { secret?: string };
    providedSecret = (body.secret ?? "").trim();
  } catch {
    providedSecret = "";
  }

  if (!providedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, expectedSecret, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });

  return response;
}
