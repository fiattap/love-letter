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

export async function loadActivePromptWithDebug(): Promise<ActivePromptQueryResult> {
  const { data, error } = await supabase
    .from("prompts")
    .select("id, month_key, title, prompt")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      prompt: null,
      errorMessage: error.message,
    };
  }

  return {
    prompt: data,
    errorMessage: null,
  };
}

export async function loadActivePrompt(): Promise<ActivePrompt | null> {
  const result = await loadActivePromptWithDebug();

  return result.prompt;
}