export type MarketingContent = {
  brandTitle: string;
  dateText: string;
  headline: string;
  prompt: string;
  letterLabel: string;
  letterContent: string;
  ctaText: string;
};

export const DEFAULT_MARKETING_CONTENT: MarketingContent = {
  brandTitle: "LOVE LETTER ♡",
  dateText: "July 15, 2026",
  headline: "The reveal.",
  prompt: "What is something you think I don't realize you appreciate about me?",
  letterLabel: "THEIR LETTER",
  letterContent:
    "I appreciate the way you make ordinary days feel important.\n\nI appreciate how safe I feel when life becomes overwhelming.",
  ctaText: "Join Love Letter",
};
