import { NextResponse, type NextRequest } from "next/server";

import { createRouteHandlerSupabaseAuthClient } from "@/lib/supabaseAuthServer";

export async function GET(request: NextRequest) {
  const response = NextResponse.json({ email: null, sessionExists: false });
  const supabase = createRouteHandlerSupabaseAuthClient(request, response);
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error("dashboard session exists:", false, error.message);
    return NextResponse.json(
      { email: null, sessionExists: false, error: error.message },
      { status: 200 }
    );
  }

  const email = data.session?.user.email ?? null;
  const sessionExists = Boolean(data.session);
  console.log("dashboard session exists:", sessionExists);

  return NextResponse.json({ email, sessionExists }, { status: 200 });
}
