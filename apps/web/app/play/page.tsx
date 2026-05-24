"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
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

  const startedRef = useRef(false);
  const prefetchAbortRef = useRef<AbortController | null>(null);
  const prefetchRef = useRef<Record<string, Promise<InteractResponse>>>({});

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

  async function handleClick(click: { x: number; y: number }) {
    if (phase !== "ready" || !session || !imageBase64) return;
    setPhase("interacting");
    setPendingClick(click);
    setIntent(null);

    const cacheSnapshot = prefetchRef.current;

    try {
      // Step 1: Vision (~4s) — figure out what the user actually clicked
      const visionRes = await fetch("/api/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session,
          prevImageBase64: imageBase64,
          click,
        }),
      });
      if (!visionRes.ok) {
        const j = (await visionRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(j.error ?? visionRes.statusText);
      }
      const { intent: clickIntent } =
        (await visionRes.json()) as VisionResponse;

      // Step 2: Cache lookup
      const cached = clickIntent.targetId
        ? cacheSnapshot[clickIntent.targetId]
        : undefined;

      let result: InteractResponse;
      if (cached) {
        // Cache hit — await the prefetched promise (mostly already resolved)
        result = await cached;
        // Overwrite the synthetic prefetch intent on history with the real one
        const lastIdx = result.session.history.length - 1;
        result = {
          ...result,
          intent: clickIntent,
          session: {
            ...result.session,
            history: result.session.history.map((entry, idx) =>
              idx === lastIdx
                ? { ...entry, click, intent: clickIntent }
                : entry,
            ),
          },
        };
      } else {
        // Cache miss (free-form click) — abort wasted prefetches, run live
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
        result = (await liveRes.json()) as InteractResponse;
      }

      // Apply the result: append new frame to history
      const updatedHistory = [...result.session.history, { frame: result.frame }];
      setSession({ ...result.session, history: updatedHistory });
      setFrame(result.frame);
      setImageBase64(result.imageBase64);
      setIntent(clickIntent);
      setPendingClick(null);
      setTurnNum((t) => t + 1);
      setPhase("ready");
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
          pendingClick={pendingClick}
          onClick={handleClick}
        />

        <div className="mt-7 md:mt-9 max-w-md w-full text-center min-h-[64px] flex items-center justify-center">
          {phase === "loading-first" && (
            <p className="text-[10px] smallcaps text-clay-500 animate-slow-pulse">
              正 · 在 · 唤 · 起 · 第 · 一 · 帧
            </p>
          )}
          {phase === "interacting" && (
            <div className="flex flex-col items-center gap-2 animate-fade-in">
              <p className="text-[10px] smallcaps text-clay-500 animate-slow-pulse">
                AI · 正 · 在 · 描 · 画 · 下 · 一 · 刻
              </p>
              <p className="font-serif italic text-clay-400 text-xs">
                预取选项秒级响应 · 自由点击稍候
              </p>
            </div>
          )}
          {phase === "ready" && intent?.targetLabel && (
            <p className="font-serif italic text-clay-500 text-base leading-relaxed animate-fade-in max-w-[320px]">
              <span className="text-[9px] smallcaps not-italic text-clay-400 mr-2 align-middle">
                上 · 一 · 步 ·
              </span>
              <span className="align-middle">{intent.targetLabel}</span>
            </p>
          )}
          {phase === "ready" && !intent && turnNum > 0 && (
            <p className="text-[10px] smallcaps text-clay-400 animate-fade-in">
              点 · 击 · 任 · 意 · 处 · 回 · 应
            </p>
          )}
        </div>
      </main>

      <footer className="px-5 md:px-12 pb-6">
        <div className="text-[9px] smallcaps text-clay-400 text-center num">
          Ⅰ · Ⅰ
        </div>
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
