"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

import { DEFAULT_MARKETING_CONTENT, type MarketingContent } from "./constants";

type AspectMode = "free" | "portrait" | "square";
type AnimationState = "intro" | "prompt" | "sealed" | "opening" | "revealed" | "final";
type OpeningStage = "idle" | "seal" | "flap" | "paper" | "unfold";

function formatSalutation(label: string) {
  const trimmedLabel = label.trim();

  if (!trimmedLabel) {
    return "";
  }

  return /[.!?,;:]$/.test(trimmedLabel) ? trimmedLabel : `${trimmedLabel},`;
}

function MarketingAnimationPreview({
  generatedContent,
  animationState,
  setAnimationState,
  openingStage,
  setOpeningStage,
  screenshotMode,
  aspectMode,
}: {
  generatedContent: MarketingContent;
  animationState: AnimationState;
  setAnimationState: React.Dispatch<React.SetStateAction<AnimationState>>;
  openingStage: OpeningStage;
  setOpeningStage: React.Dispatch<React.SetStateAction<OpeningStage>>;
  screenshotMode: boolean;
  aspectMode: AspectMode;
}) {
  const letterLabel = generatedContent.letterLabel;
  const letterContent = generatedContent.letterContent;
  const paragraphs = useMemo(
    () =>
      letterContent
        .split(/\n+/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean),
    [letterContent]
  );

  const focalParagraph = paragraphs[0] ?? "";
  const remainingParagraphs = paragraphs.slice(1);
  const fallbackParagraph = "Your letter content will appear here.";
  const [cursorDismissed, setCursorDismissed] = useState(false);

  const aspectRatio =
    aspectMode === "portrait" ? "9 / 16" : aspectMode === "square" ? "1 / 1" : undefined;

  useEffect(() => {
    const timers: Array<number> = [];

    timers.push(
      window.setTimeout(() => {
        setAnimationState("prompt");
      }, 2600)
    );

    timers.push(
      window.setTimeout(() => {
        setAnimationState("sealed");
      }, 7600)
    );

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [setAnimationState]);

  useEffect(() => {
    if (
      process.env.NODE_ENV === "development" &&
      (animationState === "sealed" || animationState === "opening" || animationState === "revealed")
    ) {
      console.log("animation state:", animationState);
    }
  }, [animationState]);

  useEffect(() => {
    if (animationState !== "opening") {
      return;
    }

    setOpeningStage("seal");

    const timers: Array<number> = [];

    timers.push(
      window.setTimeout(() => {
        setOpeningStage("flap");
      }, 500)
    );

    timers.push(
      window.setTimeout(() => {
        setOpeningStage("paper");
      }, 1200)
    );

    timers.push(
      window.setTimeout(() => {
        setOpeningStage("unfold");
      }, 2000)
    );

    timers.push(
      window.setTimeout(() => {
        setAnimationState("revealed");
      }, 2500)
    );

    timers.push(
      window.setTimeout(() => {
        setAnimationState("final");
      }, 6200)
    );

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [animationState, setAnimationState, setOpeningStage]);

  const showEnvelopeScene =
    animationState === "sealed" ||
    animationState === "opening" ||
    animationState === "revealed" ||
    animationState === "final";
  const letterRevealed = animationState === "revealed" || animationState === "final";
  const isOpeningOrRevealed =
    animationState === "opening" || animationState === "revealed" || animationState === "final";

  useEffect(() => {
    if (process.env.NODE_ENV === "development" && letterRevealed) {
      console.log("revealed content", {
        letterLabel,
        letterContent,
        paragraphs,
      });
    }
  }, [letterContent, letterLabel, letterRevealed, paragraphs]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCursorDismissed(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const hideCursorInPreview =
    (animationState === "opening" || animationState === "revealed") && !cursorDismissed;

  return (
    <div
      className={`relative mx-auto w-full overflow-hidden rounded-2xl border border-[#eadbd0] bg-[#fffaf6] ${
        hideCursorInPreview ? "cursor-none" : "cursor-auto"
      } ${
        screenshotMode
          ? "shadow-none"
          : "shadow-[0_26px_56px_rgba(53,35,31,0.14)]"
      }`}
      style={{
        aspectRatio,
        minHeight: aspectRatio ? undefined : 640,
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(221,194,171,0.36),transparent_38%),radial-gradient(circle_at_82%_12%,rgba(204,171,159,0.28),transparent_30%),linear-gradient(180deg,#fffdf9_0%,#fdf5ef_58%,#f9f0e8_100%)]" />

      <div className="relative flex h-full w-full flex-col items-center px-5 py-7 text-[#2f2723] sm:px-8 sm:py-9">
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0 }}
          className="font-editorial text-xl tracking-[0.22em] sm:text-2xl"
        >
          {generatedContent.brandTitle}
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="mt-2 text-xs uppercase tracking-[0.2em] text-[#7a6661] sm:text-sm"
        >
          {generatedContent.dateText}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={animationState === "intro" ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: 0.8 }}
          className="mt-5 text-center"
        >
          <p className="font-editorial text-3xl sm:text-5xl">Your letter has arrived.</p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mx-auto mt-3 w-[240px]"
          >
            <motion.svg viewBox="0 0 300 50" className="h-6 w-full" fill="none" aria-hidden>
              <motion.path
                d="M8 34C46 6 74 44 110 22C146 0 171 40 206 23C228 12 247 13 292 33"
                stroke="#c97972"
                strokeWidth="2"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.85 }}
                transition={{ duration: 1.5, ease: "easeInOut", delay: 0.15 }}
              />
            </motion.svg>
          </motion.div>
          <p className="mt-2 text-sm leading-relaxed text-[#6f5b58] sm:text-base">
            One question.
            <br />
            Two letters. One reveal.
          </p>
        </motion.div>

        <div className="relative mt-4 flex w-full max-w-2xl flex-1 items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={animationState === "prompt" ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
            transition={{ duration: 0.75 }}
            className="pointer-events-none absolute inset-x-0 top-1/2 z-40 mx-auto w-full max-w-[760px] -translate-y-1/2 rounded-[26px] border border-[#eadbd0] bg-[#fffaf6]/95 px-8 py-9 text-center shadow-[0_14px_32px_rgba(53,35,31,0.08)] backdrop-blur-[1px] sm:px-12 sm:py-10"
          >
            <p className="text-[0.68rem] font-semibold tracking-[0.18em] text-[#7f6a63] sm:text-[0.74rem]">
              This month’s question
            </p>
            <div className="mx-auto mt-4 h-px w-28 bg-[#e6d8cd]" />
            <p className="mx-auto mt-5 max-w-[30ch] text-balance font-editorial text-[1.38rem] leading-[1.5] text-[#332b28] sm:text-[1.88rem]">
              {generatedContent.prompt}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={showEnvelopeScene ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.9 }}
            className="relative mt-0 w-full"
          >
            <motion.div
              animate={
                letterRevealed
                  ? { opacity: 0.25, y: 60, scale: 0.9 }
                  : { opacity: 1, y: [0, -6, 0], scale: 1 }
              }
              transition={
                letterRevealed
                  ? { duration: 1.1, ease: [0.22, 0.61, 0.36, 1] }
                  : { duration: 4.8, repeat: Infinity, ease: "easeInOut" }
              }
              className="pointer-events-none relative mx-auto w-full max-w-[430px] sm:max-w-[520px]"
            >
              <div className="pointer-events-none absolute -inset-x-8 top-[68%] h-28 rounded-full bg-[#b89281]/44 blur-2xl" />
              <div className="pointer-events-none absolute inset-x-6 inset-y-6 rounded-[28px] border border-[#efe0d4] opacity-70 shadow-[0_0_0_10px_rgba(255,250,245,0.45)]" />

              <motion.div
                initial={{ rotateX: 0 }}
                animate={isOpeningOrRevealed ? { rotateX: -165 } : { rotateX: 0 }}
                transition={{ duration: 1.15, ease: [0.22, 0.61, 0.36, 1] }}
                className="pointer-events-none absolute inset-x-0 top-0 origin-top rounded-t-xl border border-[#ddc9bb] bg-[linear-gradient(180deg,#f8e8dc_0%,#f2dfcf_100%)] px-5 pb-8 pt-5"
                style={{ transformStyle: "preserve-3d" }}
              >
                <div className="mx-auto h-[1px] w-24 bg-[#ceb5a6]" />
              </motion.div>

              <div className="pointer-events-none relative rounded-[28px] border border-[#ddc9bb] bg-[linear-gradient(180deg,#fff8f1_0%,#f8ebe0_100%)] px-6 pb-9 pt-[4.4rem] sm:px-8 sm:pb-10 sm:pt-[5rem] shadow-[0_28px_54px_rgba(53,35,31,0.18)]">
                <div className="absolute inset-0 opacity-55 [background-image:repeating-linear-gradient(8deg,rgba(124,95,74,0.07)_0,rgba(124,95,74,0.07)_1px,transparent_1px,transparent_6px)]" />
                <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_20%_24%,rgba(255,255,255,0.44),transparent_38%),radial-gradient(circle_at_82%_74%,rgba(181,145,121,0.15),transparent_44%)]" />

                <motion.div
                  initial={{ scale: 1, opacity: 1 }}
                  animate={
                    isOpeningOrRevealed
                      ? {
                          scale: [1, 0.88, 0.72],
                          opacity: [1, 1, 0],
                          rotate: [0, -8, 12],
                        }
                      : { scale: 1, opacity: 1, rotate: 0 }
                  }
                  transition={{ duration: 0.7, ease: "easeInOut" }}
                  className="absolute left-1/2 top-[44%] z-30 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#b06b67]/60 bg-[#c97972] shadow-[0_10px_20px_rgba(132,67,63,0.35)]"
                >
                  <div className="flex h-full w-full items-center justify-center text-xl text-[#fff7f3]">♡</div>
                </motion.div>

              </div>

            </motion.div>

            {animationState === "sealed" ? (
              <div className="relative z-50 mt-4 flex justify-center pointer-events-auto">
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.65, delay: 0.35 }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    console.log("Open Letter clicked");
                    setCursorDismissed(false);
                    setAnimationState("opening");
                  }}
                  className="z-[80] cursor-pointer rounded-md border border-[#d4beb1] bg-[#fff8f2] px-6 py-3 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[#6f5b58] shadow-[0_10px_20px_rgba(53,35,31,0.09)]"
                >
                  Open Letter
                </motion.button>
              </div>
            ) : null}

            <motion.article
              initial={{ opacity: 0, y: 36, scale: 0.9 }}
              animate={
                openingStage === "unfold" || letterRevealed
                  ? { opacity: 1, y: 0, scale: 1.07 }
                  : { opacity: 0, y: 36, scale: 0.9 }
              }
              transition={{ duration: 1.1, ease: [0.22, 0.61, 0.36, 1] }}
              className="pointer-events-none absolute inset-x-0 top-1/2 z-50 mx-auto flex w-[94%] max-w-[620px] -translate-y-1/2 flex-col justify-center rounded-[20px] border border-[#ecddd2] bg-[#fffdfa] px-7 py-10 shadow-[0_20px_44px_rgba(53,35,31,0.12)] sm:px-12 sm:py-14"
            >
              <p className="font-editorial text-[1.08rem] text-[#5c4a45] sm:text-[1.38rem]">
                {formatSalutation(generatedContent.letterLabel)}
              </p>

              <p className="mt-8 text-center font-editorial text-[1.8rem] leading-[1.3] text-[#2f2723] sm:text-[2.75rem]">
                {focalParagraph ? `\u201c${focalParagraph}\u201d` : fallbackParagraph}
              </p>

              {remainingParagraphs.length > 0 ? (
                <div className="mt-8 space-y-3 text-left">
                  {remainingParagraphs.map((paragraph, index) => (
                    <p
                      key={`${paragraph}-${index}`}
                      className="font-editorial text-[1.02rem] leading-[1.5] text-[#4a3f3a] sm:text-[1.28rem]"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              ) : null}
            </motion.article>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={animationState === "final" ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 0.9 }}
          className="mt-6 flex flex-col items-center"
        >
          <p className="text-center font-editorial text-[1.3rem] leading-tight text-[#3a2f2b] sm:text-[1.8rem]">
            One question.
            <br />
            Two letters.
            <br />
            One reveal.
          </p>

          <button
            type="button"
            className="mt-4 rounded-md bg-[#c97972] px-7 py-3 text-xs font-bold uppercase tracking-[0.18em] text-white shadow-[0_10px_24px_rgba(201,121,114,0.22)]"
          >
            {generatedContent.ctaText}
          </button>
        </motion.div>
      </div>
    </div>
  );
}

export default function MarketingPage() {
  const [draft, setDraft] = useState<MarketingContent>(DEFAULT_MARKETING_CONTENT);
  const [generated, setGenerated] = useState<MarketingContent>(DEFAULT_MARKETING_CONTENT);
  const [replayKey, setReplayKey] = useState(0);
  const [animationState, setAnimationState] = useState<AnimationState>("intro");
  const [openingStage, setOpeningStage] = useState<OpeningStage>("idle");
  const [screenshotMode, setScreenshotMode] = useState(false);
  const [aspectMode, setAspectMode] = useState<AspectMode>("free");

  const debugParagraphCount = useMemo(
    () =>
      generated.letterContent
        .split(/\n+/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean).length,
    [generated.letterContent]
  );

  const handleGenerate = () => {
    // This page is intentionally internal-only for social recording and investor demos.
    // Content is frozen on click to avoid re-triggering animations while typing.
    setGenerated({ ...draft });
    setAnimationState("intro");
    setOpeningStage("idle");
    setReplayKey((value) => value + 1);
  };

  const handleReplay = () => {
    setAnimationState("intro");
    setOpeningStage("idle");
    setReplayKey((value) => value + 1);
  };

  return (
    <main className="min-h-screen bg-[#fbf6f1] px-4 py-6 text-[#2f2723] sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto grid w-full max-w-[1320px] gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-[#eadbd0] bg-[#fffaf6] p-5 shadow-[0_16px_42px_rgba(53,35,31,0.09)] sm:p-6">
          <h1 className="font-editorial text-3xl sm:text-4xl">Love Letter Marketing Generator</h1>
          <p className="mt-3 text-sm text-[#6f5b58]">
            Paste content, click generate, then record clean preview clips for social and investor demos.
          </p>

          <div className="mt-6 space-y-4">
            <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[#6f5b58]">
              Brand title
              <input
                value={draft.brandTitle}
                onChange={(event) => setDraft((current) => ({ ...current, brandTitle: event.target.value }))}
                className="mt-2 w-full rounded-md border border-[#e4d4c7] bg-[#fffdfa] px-3 py-2 text-sm outline-none focus:border-[#c97972]"
              />
            </label>

            <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[#6f5b58]">
              Date
              <input
                value={draft.dateText}
                onChange={(event) => setDraft((current) => ({ ...current, dateText: event.target.value }))}
                className="mt-2 w-full rounded-md border border-[#e4d4c7] bg-[#fffdfa] px-3 py-2 text-sm outline-none focus:border-[#c97972]"
              />
            </label>

            <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[#6f5b58]">
              Headline
              <input
                value={draft.headline}
                onChange={(event) => setDraft((current) => ({ ...current, headline: event.target.value }))}
                className="mt-2 w-full rounded-md border border-[#e4d4c7] bg-[#fffdfa] px-3 py-2 text-sm outline-none focus:border-[#c97972]"
              />
            </label>

            <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[#6f5b58]">
              Prompt
              <textarea
                value={draft.prompt}
                onChange={(event) => setDraft((current) => ({ ...current, prompt: event.target.value }))}
                className="mt-2 min-h-24 w-full rounded-md border border-[#e4d4c7] bg-[#fffdfa] px-3 py-2 text-sm outline-none focus:border-[#c97972]"
              />
            </label>

            <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[#6f5b58]">
              Letter label
              <input
                value={draft.letterLabel}
                onChange={(event) => setDraft((current) => ({ ...current, letterLabel: event.target.value }))}
                className="mt-2 w-full rounded-md border border-[#e4d4c7] bg-[#fffdfa] px-3 py-2 text-sm outline-none focus:border-[#c97972]"
              />
            </label>

            <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[#6f5b58]">
              Letter content
              <textarea
                value={draft.letterContent}
                onChange={(event) => setDraft((current) => ({ ...current, letterContent: event.target.value }))}
                className="mt-2 min-h-32 w-full rounded-md border border-[#e4d4c7] bg-[#fffdfa] px-3 py-2 text-sm outline-none focus:border-[#c97972]"
              />
            </label>

            <label className="block text-xs font-bold uppercase tracking-[0.18em] text-[#6f5b58]">
              CTA text
              <input
                value={draft.ctaText}
                onChange={(event) => setDraft((current) => ({ ...current, ctaText: event.target.value }))}
                className="mt-2 w-full rounded-md border border-[#e4d4c7] bg-[#fffdfa] px-3 py-2 text-sm outline-none focus:border-[#c97972]"
              />
            </label>

            <button
              type="button"
              onClick={handleGenerate}
              className="w-full rounded-md bg-[#c97972] px-5 py-3 text-xs font-bold uppercase tracking-[0.18em] text-white shadow-[0_10px_24px_rgba(201,121,114,0.22)] transition hover:bg-[#b86b65]"
            >
              Generate Animation
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-[#eadbd0] bg-[#fffaf6] p-4 shadow-[0_16px_42px_rgba(53,35,31,0.09)] sm:p-5">
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleReplay}
              className="rounded-md border border-[#d7c4b7] bg-[#fff7ef] px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[#6f5b58]"
            >
              Replay Animation
            </button>

            <button
              type="button"
              onClick={() => setScreenshotMode((value) => !value)}
              className={`rounded-md border px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] ${
                screenshotMode
                  ? "border-[#c97972] bg-[#f6e6df] text-[#8f4f4a]"
                  : "border-[#d7c4b7] bg-[#fff7ef] text-[#6f5b58]"
              }`}
            >
              Export/Screenshot Friendly Mode
            </button>

            <button
              type="button"
              onClick={() => setAspectMode("portrait")}
              className={`rounded-md border px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] ${
                aspectMode === "portrait"
                  ? "border-[#c97972] bg-[#f6e6df] text-[#8f4f4a]"
                  : "border-[#d7c4b7] bg-[#fff7ef] text-[#6f5b58]"
              }`}
            >
              9:16 Preview
            </button>

            <button
              type="button"
              onClick={() => setAspectMode("square")}
              className={`rounded-md border px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] ${
                aspectMode === "square"
                  ? "border-[#c97972] bg-[#f6e6df] text-[#8f4f4a]"
                  : "border-[#d7c4b7] bg-[#fff7ef] text-[#6f5b58]"
              }`}
            >
              1:1 Preview
            </button>

            <button
              type="button"
              onClick={() => setAspectMode("free")}
              className={`rounded-md border px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] ${
                aspectMode === "free"
                  ? "border-[#c97972] bg-[#f6e6df] text-[#8f4f4a]"
                  : "border-[#d7c4b7] bg-[#fff7ef] text-[#6f5b58]"
              }`}
            >
              Free Preview
            </button>
          </div>

          <MarketingAnimationPreview
            key={replayKey}
            generatedContent={generated}
            animationState={animationState}
            setAnimationState={setAnimationState}
            openingStage={openingStage}
            setOpeningStage={setOpeningStage}
            screenshotMode={screenshotMode}
            aspectMode={aspectMode}
          />

          {process.env.NODE_ENV === "development" ? (
            <>
              <p className="mt-3 text-xs text-[#7a6661]">Animation state: {animationState}</p>
              <p className="mt-1 text-xs text-[#7a6661]">Opening stage: {openingStage}</p>
              <p className="mt-1 text-xs text-[#7a6661]">letterContent length: {generated.letterContent.length}</p>
              <p className="mt-1 text-xs text-[#7a6661]">paragraph count: {debugParagraphCount}</p>
              <button
                type="button"
                onClick={() => {
                  setOpeningStage("unfold");
                  setAnimationState("revealed");
                }}
                className="mt-2 rounded-md border border-[#d7c4b7] bg-[#fff7ef] px-3 py-2 text-[0.65rem] font-bold uppercase tracking-[0.15em] text-[#6f5b58]"
              >
                Force Open
              </button>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
