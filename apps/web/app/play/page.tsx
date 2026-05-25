"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { PlayCanvas, type Phase } from "@/components/PlayCanvas";
import { PRESETS } from "@/lib/presets";
import type {
  ClickIntent,
  InteractResponse,
  Session,
  StartResponse,
  StoryFrame,
  VisionResponse,
} from "@yume/types";

function PlayInner() {
  const router = useRouter();
  const params = useSearchParams();

  const [phase, setPhase] = useState<Phase>("loading-first");
  const [session, setSession] = useState<Session | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [frame, setFrame] = useState<StoryFrame | null>(null);
  const [intent, setIntent] = useState<ClickIntent | null>(null);
  const [pendingClick, setPendingClick] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [turnNum, setTurnNum] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [presentation, setPresentation] = useState(false);

  const startedRef = useRef(false);
  const prefetchAbortRef = useRef<AbortController | null>(null);
  const prefetchRef = useRef<Record<string, Promise<InteractResponse>>>({});

  const togglePresentation = useCallback(async () => {
    const entering = !presentation;
    if (entering) {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // Browser may refuse fullscreen — still enter chrome-less mode
      }
      setPresentation(true);
    } else {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
      } catch {
        // ignore
      }
      setPresentation(false);
    }
  }, [presentation]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "f" || e.key === "F") {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        e.preventDefault();
        void togglePresentation();
      } else if (e.key === "Escape" && presentation) {
        setPresentation(false);
      }
    }
    function onFullscreenChange() {
      // Sync if user exited browser fullscreen via Esc / system gesture
      if (!document.fullscreenElement && presentation) {
        setPresentation(false);
      }
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [togglePresentation, presentation]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let payload: { worldSetting: string; styleGuide: string } | null = null;
    const presetId = params.get("preset");

    if (presetId) {
      const p = PRESETS.find((x) => x.id === presetId);
      if (p) {
        payload = { worldSetting: p.worldSetting, styleGuide: p.styleGuide };
      }
    } else if (params.get("custom") === "1") {
      const stored = sessionStorage.getItem("yume:custom");
      if (stored) {
        try {
          payload = JSON.parse(stored);
        } catch {
          payload = null;
        }
      }
    }

    if (!payload) {
      router.replace("/");
      return;
    }

    const finalPayload = payload;

    fetch("/api/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(finalPayload),
    })
      .then(async (r) => {
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? r.statusText);
        }
        return r.json() as Promise<StartResponse>;
      })
      .then((data) => {
        setSession({
          id: data.sessionId,
          createdAt: Date.now(),
          worldSetting: finalPayload.worldSetting,
          styleGuide: finalPayload.styleGuide,
          history: [{ frame: data.frame }],
          characters: [],
        });
        setFrame(data.frame);
        setImageBase64(data.imageBase64);
        setPhase("ready");
        setTurnNum(1);
      })
      .catch((e) => setError(String(e)));
  }, [params, router]);

  // Prefetch next-frame candidates whenever current frame becomes ready.
  // All three fire in parallel for fastest cache fill. NOT depending on
  // `phase` — we don't want to abort in-flight prefetches just because
  // the user clicked. They should continue so handleClick can await them.
  useEffect(() => {
    if (!session || !frame) return;

    prefetchAbortRef.current?.abort();
    const ctrl = new AbortController();
    prefetchAbortRef.current = ctrl;

    const choices = frame.uiElements.filter((e) => e.kind === "choice");
    const promises: Record<string, Promise<InteractResponse>> = {};

    for (const choice of choices) {
      const syntheticIntent: ClickIntent = {
        targetId: choice.id,
        targetLabel: choice.label,
        reasoning: "prefetch",
      };
      const p = fetch("/api/interact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session, intent: syntheticIntent }),
        signal: ctrl.signal,
      }).then(async (r) => {
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? r.statusText);
        }
        return r.json() as Promise<InteractResponse>;
      });
      p.catch(() => {});
      promises[choice.id] = p;
    }

    prefetchRef.current = promises;

    return () => {
      ctrl.abort();
    };
  }, [frame?.id, session?.id]);

  // ── Shared result applier ────────────────────────────────────────────
  async function applyInteractResult(
    resultPromise: Promise<InteractResponse>,
    clickIntent: ClickIntent,
    click?: { x: number; y: number },
  ) {
    const result = await resultPromise;
    // Overwrite synthetic prefetch intent with the real click intent
    const lastIdx = result.session.history.length - 1;
    const patched: InteractResponse = {
      ...result,
      intent: clickIntent,
      session: {
        ...result.session,
        history: result.session.history.map((entry, idx) =>
          idx === lastIdx ? { ...entry, click, intent: clickIntent } : entry,
        ),
      },
    };
    const updatedHistory = [
      ...patched.session.history,
      { frame: patched.frame },
    ];
    setSession({ ...patched.session, history: updatedHistory });
    setFrame(patched.frame);
    setImageBase64(patched.imageBase64);
    setIntent(clickIntent);
    setPendingClick(null);
    setTurnNum((t) => t + 1);
    setPhase("ready");
  }

  // ── HTML button click — bypasses Vision entirely ──────────────────────
  async function handleChoiceSelect(choiceId: string, label: string) {
    if (phase !== "ready" || !session) return;
    setPhase("interacting");
    setIntent(null);

    const clickIntent: ClickIntent = {
      targetId: choiceId,
      targetLabel: label,
      reasoning: "direct-button-click",
    };

    const cacheSnapshot = prefetchRef.current;
    const cached = cacheSnapshot[choiceId];

    try {
      if (cached) {
        // Cache hit — zero extra wait
        await applyInteractResult(cached, clickIntent);
      } else {
        // Cache miss — call interact directly (no Vision roundtrip)
        prefetchAbortRef.current?.abort();
        const res = await fetch("/api/interact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session, intent: clickIntent }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? res.statusText);
        }
        await applyInteractResult(
          res.json() as Promise<InteractResponse>,
          clickIntent,
        );
      }
    } catch (e) {
      setError(String(e));
      setPendingClick(null);
      setPhase("ready");
    }
  }

  // ── Background / free-form click — still uses Vision ─────────────────
  async function handleClick(click: { x: number; y: number }) {
    if (phase !== "ready" || !session || !imageBase64) return;
    setPhase("interacting");
    setPendingClick(click);
    setIntent(null);

    const cacheSnapshot = prefetchRef.current;

    try {
      const visionRes = await fetch("/api/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session, prevImageBase64: imageBase64, click }),
      });
      if (!visionRes.ok) {
        const j = (await visionRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(j.error ?? visionRes.statusText);
      }
      const { intent: clickIntent } =
        (await visionRes.json()) as VisionResponse;

      const cached = clickIntent.targetId
        ? cacheSnapshot[clickIntent.targetId]
        : undefined;

      if (cached) {
        await applyInteractResult(cached, clickIntent, click);
      } else {
        prefetchAbortRef.current?.abort();
        const liveRes = await fetch("/api/interact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session, intent: clickIntent, click }),
        });
        if (!liveRes.ok) {
          const j = (await liveRes.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(j.error ?? liveRes.statusText);
        }
        await applyInteractResult(
          liveRes.json() as Promise<InteractResponse>,
          clickIntent,
          click,
        );
      }
    } catch (e) {
      setError(String(e));
      setPendingClick(null);
      setPhase("ready");
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8">
        <div className="max-w-md text-center animate-fade-in">
          <p className="text-[10px] smallcaps text-clay-500 mb-6">
            出 · 了 · 点 · 状 · 况
          </p>
          <p className="font-serif italic text-clay-900 text-lg leading-[1.7] mb-10">
            {error}
          </p>
          <Link
            href="/"
            className="text-[10px] smallcaps text-clay-700 hover:text-ember-500 transition-colors inline-flex items-center gap-3"
          >
            <i className="fa-solid fa-arrow-left text-[9px]" />
            返 回
          </Link>
        </div>
      </div>
    );
  }

  if (presentation) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <PlayCanvas
          imageBase64={imageBase64}
          phase={phase}
          frame={frame}
          pendingClick={pendingClick}
          onClick={handleClick}
          onSelectChoice={handleChoiceSelect}
          fullViewport
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-5 md:px-12 pt-6 md:pt-8 flex items-center justify-between">
        <Link
          href="/"
          className="text-[10px] smallcaps text-clay-600 hover:text-clay-900 transition-colors flex items-center gap-2"
        >
          <i className="fa-solid fa-arrow-left text-[9px]" />
          云梦
        </Link>
        <div className="flex items-center gap-3 text-[10px] smallcaps text-clay-500 num">
          <span>第 · {String(turnNum).padStart(3, "0")} · 帧</span>
          <span className="text-clay-300">·</span>
          <span className="hidden sm:inline truncate max-w-[180px]">
            {session?.id.slice(2, 14) ?? "—"}
          </span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 md:px-8 py-6 md:py-10">
        <PlayCanvas
          imageBase64={imageBase64}
          phase={phase}
          frame={frame}
          pendingClick={pendingClick}
          onClick={handleClick}
          onSelectChoice={handleChoiceSelect}
        />

        <div className="mt-4 max-w-md w-full text-center min-h-[28px] flex items-center justify-center">
          {phase === "loading-first" && (
            <p className="text-[10px] smallcaps text-clay-500 animate-slow-pulse">
              正 · 在 · 唤 · 起 · 第 · 一 · 帧
            </p>
          )}
          {phase === "ready" && intent?.targetLabel && (
            <p className="text-[9px] smallcaps text-clay-400 animate-fade-in">
              <span className="mr-2">上 · 一 · 步 ·</span>
              <span className="text-clay-600">{intent.targetLabel}</span>
            </p>
          )}
        </div>
      </main>

      <footer className="px-5 md:px-12 pb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => void togglePresentation()}
          className="text-[9px] smallcaps text-clay-400 hover:text-clay-700 transition-colors flex items-center gap-2"
          aria-label="进入演示模式"
        >
          <i className="fa-solid fa-expand text-[10px]" />
          F · 演 · 示
        </button>
        <div className="text-[9px] smallcaps text-clay-400 num">Ⅰ · Ⅰ</div>
        <span className="text-[9px] w-[60px]" aria-hidden />
      </footer>
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <span className="text-[10px] smallcaps text-clay-500 animate-slow-pulse">
            载入中
          </span>
        </div>
      }
    >
      <PlayInner />
    </Suspense>
  );
}
