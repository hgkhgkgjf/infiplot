"use client";

import { useRef, useState } from "react";

export type Phase = "loading-first" | "ready" | "interacting";

const SHADOW =
  "0 1px 0 rgba(45,24,16,0.05), 0 36px 64px -28px rgba(45,24,16,0.25), 0 8px 18px -6px rgba(45,24,16,0.10)";

export function PlayCanvas({
  imageBase64,
  phase,
  pendingClick,
  onClick,
}: {
  imageBase64: string | null;
  phase: Phase;
  pendingClick: { x: number; y: number } | null;
  onClick: (click: { x: number; y: number }) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  function handleClick(e: React.MouseEvent<HTMLImageElement>) {
    if (phase !== "ready" || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onClick({
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    });
  }

  const interactive = phase === "ready" && !!imageBase64;
  const dimmed = phase === "interacting";

  return (
    <div className="w-full flex flex-col items-center">
      {imageBase64 ? (
        <div className="relative inline-block" style={{ boxShadow: SHADOW }}>
          <img
            key={imageBase64.slice(-48)}
            ref={imgRef}
            src={`data:image/png;base64,${imageBase64}`}
            alt="Generated frame"
            onClick={handleClick}
            onLoad={(e) => {
              const img = e.currentTarget;
              setDims({ w: img.naturalWidth, h: img.naturalHeight });
            }}
            draggable={false}
            className={`block w-auto h-auto select-none animate-fade-in transition-opacity duration-700 ease-out ${interactive ? "cursor-pointer" : "cursor-wait"} ${dimmed ? "opacity-30" : "opacity-100"}`}
            style={{
              maxWidth: "min(560px, 92vw)",
              maxHeight: "calc(100dvh - 200px)",
            }}
          />

          <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-clay-900/12 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-clay-900/12 to-transparent pointer-events-none" />

          {pendingClick && (
            <>
              <div
                className="absolute rounded-full border border-ember-500 pointer-events-none"
                style={{
                  left: `${pendingClick.x * 100}%`,
                  top: `${pendingClick.y * 100}%`,
                  transform: "translate(-50%, -50%)",
                  width: 30,
                  height: 30,
                  animation:
                    "yume-ripple 1.6s cubic-bezier(0.16,1,0.3,1) infinite",
                }}
              />
              <div
                className="absolute rounded-full pointer-events-none"
                style={{
                  left: `${pendingClick.x * 100}%`,
                  top: `${pendingClick.y * 100}%`,
                  transform: "translate(-50%, -50%)",
                  width: 11,
                  height: 11,
                  background: "#D97A2E",
                  boxShadow:
                    "0 0 0 3px rgba(251,247,240,0.95), 0 0 14px rgba(217,122,46,0.55)",
                }}
              />
            </>
          )}
        </div>
      ) : (
        <div
          className="relative aspect-[2/3] bg-cream-200 flex flex-col items-center justify-center gap-4"
          style={{
            width: "min(560px, calc((100dvh - 200px) * 2 / 3), 92vw)",
            boxShadow: SHADOW,
          }}
        >
          <div className="w-1.5 h-1.5 bg-clay-500 rounded-full animate-slow-pulse" />
          <p className="text-[9px] smallcaps text-clay-500 animate-slow-pulse">
            正 · 在 · 绘 · 制 · 第 · 一 · 帧
          </p>
        </div>
      )}

      <div
        className="flex items-center justify-between mt-3 px-1 w-full"
        style={{ maxWidth: "min(560px, 92vw)" }}
      >
        <span className="text-[9px] smallcaps text-clay-400 num">
          {dims ? `${dims.w} × ${dims.h} · png` : "—"}
        </span>
        <span className="text-[9px] smallcaps text-clay-400">
          {phase === "ready" ? "任 · 意 · 点 · 击" : "···"}
        </span>
      </div>
    </div>
  );
}
