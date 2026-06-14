"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

import { DEFAULT_MARKETING_CONTENT, type MarketingContent } from "../marketing/constants";

type StoryScene = "arrived" | "tagline" | "prompt" | "sealed" | "opening" | "revealed" | "final";
type OpeningStage = "idle" | "seal" | "flap" | "paper" | "unfold";

function formatSalutation(label: string) {
  const trimmedLabel = label.trim();

  if (!trimmedLabel) {
    return "";
  }

  if (trimmedLabel.toLowerCase() === "their letter") {
    return trimmedLabel;
  }

  return /[.!?,;:]$/.test(trimmedLabel) ? trimmedLabel : `${trimmedLabel},`;
}

function StoryPreview({
  generatedContent,
  scene,
  setScene,
  openingStage,
  setOpeningStage,
  exportMode,
  hidePreviewCursor,
  setHidePreviewCursor,
}: {
  generatedContent: MarketingContent;
  scene: StoryScene;
  setScene: React.Dispatch<React.SetStateAction<StoryScene>>;
  openingStage: OpeningStage;
  setOpeningStage: React.Dispatch<React.SetStateAction<OpeningStage>>;
  exportMode: boolean;
  hidePreviewCursor: boolean;
  setHidePreviewCursor: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const paragraphs = useMemo(
    () =>
      generatedContent.letterContent
        .split(/\n+/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean),
    [generatedContent.letterContent]
  );

  const focalParagraph = paragraphs[0] ?? "Your words belong here.";
  const restParagraphs = paragraphs.slice(1);

  const showEnvelope =
    scene === "sealed" || scene === "opening" || scene === "revealed" || scene === "final";
  const isOpeningOrAfter = scene === "opening" || scene === "revealed" || scene === "final";
  const letterVisible = scene === "revealed" || scene === "final";

  useEffect(() => {
    const timers: Array<number> = [];

    timers.push(
      window.setTimeout(() => {
        setScene("tagline");
      }, 4400)
    );

    timers.push(
      window.setTimeout(() => {
        setScene("prompt");
      }, 6400)
    );

    timers.push(
      window.setTimeout(() => {
        setScene("sealed");
      }, 10000)
    );

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [setScene]);

  useEffect(() => {
    if (scene !== "opening") {
      return;
    }

    setOpeningStage("seal");

    const timers: Array<number> = [];

    timers.push(
      window.setTimeout(() => {
        setOpeningStage("flap");
      }, 420)
    );

    timers.push(
      window.setTimeout(() => {
        setOpeningStage("paper");
      }, 1000)
    );

    timers.push(
      window.setTimeout(() => {
        setOpeningStage("unfold");
      }, 1720)
    );

    timers.push(
      window.setTimeout(() => {
        setScene("revealed");
      }, 2220)
    );

    timers.push(
      window.setTimeout(() => {
        setScene("final");
        setHidePreviewCursor(false);
      }, 5200)
    );

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [scene, setHidePreviewCursor, setOpeningStage, setScene]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setHidePreviewCursor(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [setHidePreviewCursor]);

  return (
    <div
      className={`relative mx-auto w-full max-w-[420px] overflow-hidden rounded-[34px] border border-[#eadbd0] bg-[#fffaf6] ${(scene === "opening" || scene === "revealed") && hidePreviewCursor ? "cursor-none" : "cursor-auto"} ${
        exportMode ? "shadow-none" : "shadow-[0_34px_74px_rgba(53,35,31,0.16)]"
      }`}
      style={{ aspectRatio: "1080 / 1920" }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_16%,rgba(221,194,171,0.35),transparent_34%),radial-gradient(circle_at_84%_12%,rgba(204,171,159,0.27),transparent_30%),linear-gradient(180deg,#fffdf9_0%,#fdf5ef_56%,#f7ece1_100%)]" />

      <div className="relative flex h-full w-full flex-col px-7 pb-8 pt-11 text-[#2f2723] sm:px-8 sm:pb-9 sm:pt-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.35 }}
          className="text-center"
        >
          <p className="font-editorial text-[1.45rem] tracking-[0.22em]">{generatedContent.brandTitle}</p>
          <p className="mt-2 text-[0.7rem] uppercase tracking-[0.2em] text-[#7a6661]">{generatedContent.dateText}</p>
        </motion.div>

        <div className="relative mt-12 flex flex-1 items-center justify-center sm:mt-14">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={scene === "arrived" ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.75 }}
            className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center"
          >
            <p className="font-editorial text-[1.76rem] leading-[1.3] text-[#352c28] sm:text-[1.82rem]">
              <motion.span
                initial={{ opacity: 0 }}
                animate={scene === "arrived" ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.35, delay: 2.15 }}
              >
                Your
              </motion.span>{" "}
              <motion.span
                initial={{ opacity: 0 }}
                animate={scene === "arrived" ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.35, delay: 2.5 }}
              >
                letter
              </motion.span>
              <br />
              <motion.span
                initial={{ opacity: 0 }}
                animate={scene === "arrived" ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.35, delay: 2.85 }}
              >
                has
              </motion.span>{" "}
              <motion.span
                initial={{ opacity: 0 }}
                animate={scene === "arrived" ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.35, delay: 3.2 }}
              >
                arrived.
              </motion.span>
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={scene === "tagline" ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 2 }}
            className="pointer-events-none absolute inset-x-0 text-center"
          >
            <p className="font-editorial text-[2.02rem] leading-[1.24] text-[#352c28]">
              One question.
              <br />
              Two letters.
              <br />
              One reveal.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={scene === "prompt" ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.75 }}
            className="pointer-events-none absolute inset-x-0 mx-auto w-full max-w-[340px] rounded-[24px] border border-[#eadbd0] bg-[#fffaf6]/95 px-7 py-8 text-center shadow-[0_14px_32px_rgba(53,35,31,0.08)]"
          >
            <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-[#7f6a63]">
              This month&apos;s question
            </p>
            <div className="mx-auto mt-4 h-px w-24 bg-[#e6d8cd]" />
            <p className="mx-auto mt-5 max-w-[22ch] font-editorial text-[1.52rem] leading-[1.44] text-[#332b28]">
              {generatedContent.prompt}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={showEnvelope ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 18, scale: 0.97 }}
            transition={{ duration: 0.9 }}
            className="relative w-full"
          >
            <motion.div
              animate={letterVisible ? { opacity: 0.24, y: 52, scale: 0.9 } : { opacity: 1, y: [0, -6, 0], scale: 1 }}
              transition={
                letterVisible
                  ? { duration: 1.05, ease: [0.22, 0.61, 0.36, 1] }
                  : { duration: 4.8, repeat: Infinity, ease: "easeInOut" }
              }
              className="pointer-events-none relative mx-auto w-full max-w-[320px]"
            >
              <div className="pointer-events-none absolute -inset-x-8 top-[67%] h-24 rounded-full bg-[#b89281]/42 blur-2xl" />
              <div className="pointer-events-none absolute inset-x-4 inset-y-4 rounded-[24px] border border-[#efe0d4] opacity-70 shadow-[0_0_0_10px_rgba(255,250,245,0.45)]" />

              <motion.div
                initial={{ rotateX: 0 }}
                animate={isOpeningOrAfter ? { rotateX: -165 } : { rotateX: 0 }}
                transition={{ duration: 1.15, ease: [0.22, 0.61, 0.36, 1] }}
                className="pointer-events-none absolute inset-x-0 top-0 origin-top rounded-t-xl border border-[#ddc9bb] bg-[linear-gradient(180deg,#f8e8dc_0%,#f2dfcf_100%)] px-5 pb-8 pt-5"
                style={{ transformStyle: "preserve-3d" }}
              >
                <div className="mx-auto h-[1px] w-20 bg-[#ceb5a6]" />
              </motion.div>

              <div className="pointer-events-none relative rounded-[24px] border border-[#ddc9bb] bg-[linear-gradient(180deg,#fff8f1_0%,#f8ebe0_100%)] px-5 pb-8 pt-[4rem] shadow-[0_28px_54px_rgba(53,35,31,0.18)]">
                <div className="absolute inset-0 opacity-55 [background-image:repeating-linear-gradient(8deg,rgba(124,95,74,0.07)_0,rgba(124,95,74,0.07)_1px,transparent_1px,transparent_6px)]" />
                <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_20%_24%,rgba(255,255,255,0.44),transparent_38%),radial-gradient(circle_at_82%_74%,rgba(181,145,121,0.15),transparent_44%)]" />

                <motion.div
                  initial={{ scale: 1, opacity: 1 }}
                  animate={
                    isOpeningOrAfter
                      ? { scale: [1, 0.88, 0.72], opacity: [1, 1, 0], rotate: [0, -8, 12] }
                      : { scale: 1, opacity: 1, rotate: 0 }
                  }
                  transition={{ duration: 0.7, ease: "easeInOut" }}
                  className="absolute left-1/2 top-[44%] z-30 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#b06b67]/60 bg-[#c97972] shadow-[0_10px_20px_rgba(132,67,63,0.35)]"
                >
                  <div className="flex h-full w-full items-center justify-center text-[1.05rem] text-[#fff7f3]">♡</div>
                </motion.div>
              </div>
            </motion.div>

            {scene === "sealed" ? (
              <div className="relative z-40 mt-5 flex justify-center">
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.65, delay: 0.25 }}
                  onClick={() => {
                    setHidePreviewCursor(true);
                    setScene("opening");
                  }}
                  className="rounded-md border border-[#d4beb1] bg-[#fff8f2] px-6 py-3 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[#6f5b58] shadow-[0_10px_20px_rgba(53,35,31,0.09)]"
                >
                  Open Letter
                </motion.button>
              </div>
            ) : null}

            <motion.article
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={openingStage === "unfold" || letterVisible ? { opacity: 1, y: 0, scale: 1.05 } : { opacity: 0, y: 30, scale: 0.9 }}
              transition={{ duration: 1.05, ease: [0.22, 0.61, 0.36, 1] }}
              className="pointer-events-none absolute inset-x-0 top-1/2 z-50 mx-auto flex w-[92%] max-w-[360px] -translate-y-1/2 flex-col justify-center rounded-[20px] border border-[#ecddd2] bg-[#fffdfa] px-6 py-10 text-center shadow-[0_20px_44px_rgba(53,35,31,0.12)]"
            >
              <p className="mx-auto max-w-[18ch] font-editorial text-[1.12rem] text-[#5c4a45]">{formatSalutation(generatedContent.letterLabel)}</p>

              <p className="mt-6 text-center font-editorial text-[1.78rem] leading-[1.28] text-[#2f2723]">
                {focalParagraph ? `\u201c${focalParagraph}\u201d` : "Your words belong here."}
              </p>

              {restParagraphs.length > 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={letterVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                  transition={{ duration: 0.7, delay: 0.35 }}
                  className="mx-auto mt-6 max-w-[28ch] space-y-3 text-center"
                >
                  {restParagraphs.map((paragraph, index) => (
                    <p key={`${paragraph}-${index}`} className="font-editorial text-[1.02rem] leading-[1.5] text-[#4a3f3a]">
                      {paragraph}
                    </p>
                  ))}
                </motion.div>
              ) : null}
            </motion.article>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={scene === "final" ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 0.9 }}
          className="mt-6 flex flex-col items-center"
        >
          <p className="mb-4 text-center font-editorial text-[1.35rem] leading-[1.2] text-[#3a2f2b]">
            One question.
            <br />
            Two letters.
            <br />
            One reveal.
          </p>
          <button
            type="button"
            className="rounded-md bg-[#c97972] px-7 py-3 text-xs font-bold uppercase tracking-[0.18em] text-white shadow-[0_10px_24px_rgba(201,121,114,0.22)]"
          >
            {generatedContent.ctaText}
          </button>
        </motion.div>
      </div>
    </div>
  );
}

export default function MarketingStoryPage() {
  const [draft, setDraft] = useState<MarketingContent>(DEFAULT_MARKETING_CONTENT);
  const [generated, setGenerated] = useState<MarketingContent>(DEFAULT_MARKETING_CONTENT);
  const [replayKey, setReplayKey] = useState(0);
  const [scene, setScene] = useState<StoryScene>("arrived");
  const [openingStage, setOpeningStage] = useState<OpeningStage>("idle");
  const [exportMode, setExportMode] = useState(false);
  const [hidePreviewCursor, setHidePreviewCursor] = useState(false);

  const handleGenerate = () => {
    setGenerated({ ...draft });
    setScene("arrived");
    setOpeningStage("idle");
    setHidePreviewCursor(false);
    setReplayKey((value) => value + 1);
  };

  const handleReplay = () => {
    setScene("arrived");
    setOpeningStage("idle");
    setHidePreviewCursor(false);
    setReplayKey((value) => value + 1);
  };

  return (
    <main className="min-h-screen bg-[#fbf6f1] px-4 py-6 text-[#2f2723] sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto grid w-full max-w-[1320px] gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-[#eadbd0] bg-[#fffaf6] p-5 shadow-[0_16px_42px_rgba(53,35,31,0.09)] sm:p-6">
          <h1 className="font-editorial text-3xl sm:text-4xl">Love Letter Story Generator</h1>
          <p className="mt-3 text-sm text-[#6f5b58]">
            Build a 1080x1920 story reveal sequence for reels, stories, and short-form video exports.
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
              onClick={() => setExportMode((value) => !value)}
              className={`rounded-md border px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] ${
                exportMode
                  ? "border-[#c97972] bg-[#f6e6df] text-[#8f4f4a]"
                  : "border-[#d7c4b7] bg-[#fff7ef] text-[#6f5b58]"
              }`}
            >
              Export Story Mode
            </button>
          </div>

          <StoryPreview
            key={replayKey}
            generatedContent={generated}
            scene={scene}
            setScene={setScene}
            openingStage={openingStage}
            setOpeningStage={setOpeningStage}
            exportMode={exportMode}
            hidePreviewCursor={hidePreviewCursor}
            setHidePreviewCursor={setHidePreviewCursor}
          />
        </section>
      </div>
    </main>
  );
}
