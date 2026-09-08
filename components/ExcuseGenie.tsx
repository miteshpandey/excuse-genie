"use client";

import { useRef, useState } from "react";
import { SITUATIONS, TONES, type Tone } from "@/lib/excuses";

type CopyState = "copied" | "failed" | undefined;

// Result shape from /api/generate. id is present for store-backed excuses and
// null for last-resort base templates (which can't be flagged).
interface ResultExcuse {
  id: string | null;
  label: string;
  text: string;
}

export default function ExcuseGenie() {
  const [selectedChip, setSelectedChip] = useState<string | null>(null);
  const [typedText, setTypedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedTone, setSelectedTone] = useState<Tone | null>(null);
  const [excuses, setExcuses] = useState<ResultExcuse[]>([]);
  const [resultLabel, setResultLabel] = useState("");
  const lastKey = useRef<string>("");
  const [copyStates, setCopyStates] = useState<Record<number, CopyState>>({});

  const currentPair = useRef<{ situation: string; tone: Tone } | null>(null);
  const typeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);

    async function runGenerate(
    situation: string,
    tone: Tone | null,
    force = false,
  ) {
    if (!situation || !tone) {
      setExcuses([]);
      setResultLabel("");
      setLoading(false);
      return;
    }

    // Don't re-fire on an identical selection (e.g. re-tapping the chip that's
    // already active). "surprise me" passes force=true to always regenerate.
    const key = `${situation}\u0000${tone}`;
    if (!force && key === lastKey.current) return;
    lastKey.current = key;

    const id = ++requestId.current;
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situation, tone }),
      });
      const data = await res.json();
      // Ignore responses that arrived after a newer request was fired; the
      // newer request owns the loading state, so don't touch it here.
      if (id !== requestId.current) return;
      if (!res.ok) {
        setExcuses([]);
        setResultLabel("");
        setLoading(false);
        return;
      }
      currentPair.current = { situation, tone };
      setCopyStates({});
      setResultLabel(`${tone} \u00b7 ${situation}`);
      setExcuses(data.excuses as ResultExcuse[]);
      setLoading(false);
    } catch {
      if (id !== requestId.current) return;
      setExcuses([]);
      setResultLabel("");
      setLoading(false);
    }
  }

  function pickChip(s: string) {
    setSelectedChip(s);
    setTypedText("");
    runGenerate(s, selectedTone);
  }

  function pickTone(t: Tone) {
    setSelectedTone(t);
    const situation = selectedChip || typedText.trim();
    runGenerate(situation, t);
  }

  function onType(value: string) {
    setTypedText(value);
    if (value.trim().length > 0) setSelectedChip(null);
    if (typeTimer.current) clearTimeout(typeTimer.current);
    typeTimer.current = setTimeout(() => {
      runGenerate(value.trim(), selectedTone);
    }, 600);
  }

  function surprise() {
    const s = SITUATIONS[Math.floor(Math.random() * SITUATIONS.length)];
    const t = TONES[Math.floor(Math.random() * TONES.length)];
    setSelectedChip(s);
    setSelectedTone(t);
    setTypedText("");
    runGenerate(s, t, true);
  }

    async function copyLine(text: string, id: string | null, index: number) {
    const flag = () => {
      const pair = currentPair.current;
      if (!id || !pair) return; // base-template excuses have no id; nothing to flag
      // Fire-and-forget: a flag failure must never affect the copy UX.
      fetch("/api/flag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          situation: pair.situation,
          tone: pair.tone,
          id,
        }),
        keepalive: true,
      }).catch(() => {});
    };

    const finish = (state: CopyState) => {
      if (state === "copied") flag();
      setCopyStates((prev) => ({ ...prev, [index]: state }));
      setTimeout(() => {
        setCopyStates((prev) => ({ ...prev, [index]: undefined }));
      }, 1500);
    };

    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      ta.style.left = "-1000px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        finish(ok ? "copied" : "failed");
      } catch {
        document.body.removeChild(ta);
        finish("failed");
      }
    };

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        finish("copied");
      } catch {
        fallback();
      }
    } else {
      fallback();
    }
  }

  return (
    <main className="min-h-screen px-6 pt-16 pb-24">
      <div className="mx-auto max-w-[620px]">
        <header className="mb-14">
          <h1 className="text-[42px] font-medium leading-[1.1] tracking-tight">
            Excuse Genie
          </h1>
          <p className="mt-2.5 text-[17px] font-light text-mist">
            Pick a situation, or write your own. Choose a tone. The excuse writes
            itself.
          </p>
        </header>

        <section className="mb-11">
          <p className="mb-[18px] text-[13px] font-medium uppercase tracking-[0.08em] text-mist">
            The situation
          </p>
          <div className="flex flex-wrap gap-2.5">
            {SITUATIONS.map((s) => {
              const active = selectedChip === s;
              return (
                <button
                  key={s}
                  onClick={() => pickChip(s)}
                  className={
                    "rounded-full border px-[18px] py-2 text-base transition-all " +
                    (active
                      ? "border-moss bg-moss text-paper"
                      : "border-mist bg-transparent text-ink hover:border-moss hover:text-moss")
                  }
                >
                  {s}
                </button>
              );
            })}
          </div>

          <div className="my-[22px] flex items-center gap-4 text-sm font-light italic text-mist">
            <span className="h-px flex-1 bg-mist opacity-40" />
            or type your own
            <span className="h-px flex-1 bg-mist opacity-40" />
          </div>

          <input
            type="text"
            value={typedText}
            onChange={(e) => onType(e.target.value)}
            placeholder="I need an excuse for..."
            autoComplete="off"
            className="w-full border-0 border-b border-mist bg-transparent px-0.5 py-2 text-lg text-ink outline-none transition-colors placeholder:font-light placeholder:italic placeholder:text-mist focus:border-moss"
          />
        </section>

        <section className="mb-11">
          <p className="mb-[18px] text-[13px] font-medium uppercase tracking-[0.08em] text-mist">
            The tone
          </p>
          <div className="flex flex-wrap gap-2.5">
            {TONES.map((t) => {
              const active = selectedTone === t;
              return (
                <button
                  key={t}
                  onClick={() => pickTone(t)}
                  className={
                    "rounded-full border px-4 py-1.5 text-[15px] transition-all " +
                    (active
                      ? "border-ink bg-ink text-paper"
                      : "border-mist bg-transparent text-ink hover:border-moss hover:text-moss")
                  }
                >
                  {t}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mb-11">
          <div className="mb-[26px] flex min-h-[20px] items-center justify-start gap-4">
            <button
              onClick={surprise}
              className="flex items-center gap-1.5 text-sm font-normal italic text-moss transition-opacity hover:opacity-70"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-[15px] w-[15px]"
              >
                <path d="M16 3h5v5" />
                <path d="M4 20L21 3" />
                <path d="M21 16v5h-5" />
                <path d="M15 15l6 6" />
                <path d="M4 4l5 5" />
              </svg>
              surprise me
            </button>
            <span className="text-sm font-light italic text-mist">
              {resultLabel}
            </span>
          </div>

          {loading ? (
            <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex animate-pulse items-start gap-4"
                  style={{ animationDelay: `${i * 0.12}s` }}
                >
                  <div className="flex-1">
                    <div className="mb-2 h-3 w-24 rounded bg-moss/30" />
                    <div className="mb-1.5 h-4 w-full rounded bg-mist/30" />
                    <div className="h-4 w-4/5 rounded bg-mist/30" />
                  </div>
                </div>
              ))}
            </div>
          ) : excuses.length === 0 ? (
            <p className="text-lg font-light italic text-mist">
              Your excuse will appear here.
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              {excuses.map((ex, i) => {
                const state = copyStates[i];
                const copyColor =
                  state === "copied"
                    ? "text-moss"
                    : state === "failed"
                      ? "text-fail"
                      : "text-mist hover:text-moss";
                return (
                  <div
                    key={`${resultLabel}-${i}`}
                    className="eg-fade flex items-start gap-4"
                    style={{ animationDelay: `${i * 0.08}s` }}
                  >
                    <div className="flex-1">
                      <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.06em] text-moss">
                        {ex.label}
                      </span>
                      <p className="text-xl font-normal leading-[1.55]">
                        {ex.text}
                      </p>
                    </div>
                    <button
                      aria-label="Copy excuse"
                      onClick={() => copyLine(ex.text, ex.id, i)}
                      className={
                        "mt-[22px] shrink-0 p-1 leading-none transition-colors " +
                        copyColor
                      }
                    >
                      {state === "copied" ? (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-[18px] w-[18px]"
                        >
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      ) : (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-[18px] w-[18px]"
                        >
                          <rect x="9" y="9" width="11" height="11" rx="2" />
                          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                        </svg>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
