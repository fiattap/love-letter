import { NextResponse } from "next/server";

import { ensureManualRouteGuard } from "@/lib/cycleEmail";
import { getCycleScheduleFromMonthKey } from "@/lib/loveLetterDate";
import { loadActivePrompt } from "@/lib/prompts";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const guardError = ensureManualRouteGuard(request);
  if (guardError) {
    return NextResponse.json({ error: guardError }, { status: 403 });
  }

  const activePrompt = await loadActivePrompt();
  if (!activePrompt) {
    return NextResponse.json({
      cycleKey: null,
      members: [],
      note: "No active prompt available.",
    });
  }

  const cycle = getCycleScheduleFromMonthKey(activePrompt.month_key);
  if (!cycle) {
    return NextResponse.json({ error: "Invalid active prompt month key." }, { status: 400 });
  }

  const [{ data: members }, { data: letters }] = await Promise.all([
    supabase.from("members").select("email, delivery_type").order("created_at", { ascending: false }),
    supabase
      .from("letters")
      .select("writer_email, couple_id")
      .eq("prompt", activePrompt.prompt)
      .eq("status", "sealed"),
  ]);

  const submittedEmails = new Set((letters ?? []).map((item) => item.writer_email));

  const countsByCouple = new Map<number, number>();
  for (const letter of letters ?? []) {
    if (letter.couple_id == null) {
      continue;
    }

    countsByCouple.set(letter.couple_id, (countsByCouple.get(letter.couple_id) ?? 0) + 1);
  }

  const readyCoupleIds = [...countsByCouple.entries()]
    .filter(([, count]) => count >= 2)
    .map(([coupleId]) => coupleId);

  const { data: readyCouples } = readyCoupleIds.length
    ? await supabase
        .from("couples")
        .select("member_id")
        .in("id", readyCoupleIds)
    : { data: [] as { member_id: number }[] };

  const readyMemberIds = new Set((readyCouples ?? []).map((item) => item.member_id));
  const { data: membersWithIds } = await supabase.from("members").select("id, email");
  const memberIdByEmail = new Map((membersWithIds ?? []).map((item) => [item.email, item.id]));

  return NextResponse.json({
    cycleKey: cycle.cycleKey,
    members: (members ?? []).map((member) => {
      const memberId = memberIdByEmail.get(member.email);

      return {
        email: member.email,
        deliveryType: member.delivery_type,
        submitted: submittedEmails.has(member.email),
        revealReady: memberId ? readyMemberIds.has(memberId) : false,
        physicalRequested: member.delivery_type === "physical",
      };
    }),
  });
}
