import { getCurrentCycleKey, getLoveLetterToday } from "@/lib/loveLetterDate";
import { supabase } from "@/lib/supabase";

export const PROMPT_FALLBACK_TEXT = "Our next Love Letter is being prepared.";

export type ActivePrompt = {
  id: number;
  month_key: string;
  title: string;
  prompt: string;
};

export type ActivePromptQueryResult = {
  prompt: ActivePrompt | null;
  errorMessage: string | null;
};

export async function loadActivePromptWithDebug(
  today: Date = getLoveLetterToday()
): Promise<ActivePromptQueryResult> {
  // Pick the prompt for whatever cycle "today" falls in (date-driven), so the
  // app advances automatically each month without flipping an is_active flag.
  const monthKey = getCurrentCycleKey(today);

  const byCycle = await supabase
    .from("prompts")
    .select("id, month_key, title, prompt")
    .eq("month_key", monthKey)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (byCycle.error) {
    return { prompt: null, errorMessage: byCycle.error.message };
  }

  if (byCycle.data) {
    return { prompt: byCycle.data, errorMessage: null };
  }

  // Fallback: if no prompt is configured for this cycle, fall back to whatever
  // is marked active (keeps older behavior working if a month is unseeded).
  const byActive = await supabase
    .from("prompts")
    .select("id, month_key, title, prompt")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { prompt: byActive.data, errorMessage: byActive.error?.message ?? null };
}

export async function loadActivePrompt(
  today: Date = getLoveLetterToday()
): Promise<ActivePrompt | null> {
  const result = await loadActivePromptWithDebug(today);

  return result.prompt;
}