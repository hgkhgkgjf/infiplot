"use client";

import { type ReactNode, useEffect, useState } from "react";
import {
  clearStoredTtsConfig,
  readStoredTtsConfig,
  writeStoredTtsConfig,
} from "@/lib/clientTtsConfig";
import {
  findTtsPreset,
  PAYG_PRESET_ID,
  TTS_KEY_DOC_URL,
  TTS_REGION_PRESETS,
} from "@/lib/ttsPresets";

const PLAYER_NAME_STORAGE_KEY = "infiplot:playerName";

export function readStoredPlayerName(): string {
  try {
    return localStorage.getItem(PLAYER_NAME_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeStoredPlayerName(name: string): void {
  try {
    if (name) {
      localStorage.setItem(PLAYER_NAME_STORAGE_KEY, name);
    } else {
      localStorage.removeItem(PLAYER_NAME_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function SettingsModal({
  initialAudioEnabled = true,
  onClose,
  onSaved,
  footerNote,
}: {
  initialAudioEnabled?: boolean;
  onClose: () => void;
  onSaved: (settings: { ttsConfigured: boolean; playerName: string; audioEnabled: boolean }) => void;
  footerNote?: ReactNode;
}) {
  const [initialTts] = useState(() => readStoredTtsConfig());
  const initialKind = findTtsPreset(initialTts?.presetId)?.kind ?? "payg";
  const [keyType, setKeyType] = useState<"token-plan" | "payg">(initialKind);
  const [regionId, setRegionId] = useState<string>(
    initialKind === "token-plan"
      ? (initialTts?.presetId ?? TTS_REGION_PRESETS[0]!.id)
      : TTS_REGION_PRESETS[0]!.id,
  );
  const [apiKey, setApiKey] = useState<string>(initialTts?.apiKey ?? "");
  const [showKey, setShowKey] = useState(false);
  const ttsAlreadyConfigured = initialTts != null;

  const [playerName, setPlayerName] = useState(() => readStoredPlayerName());
  const [voiceOn, setVoiceOn] = useState(initialAudioEnabled);

  const [shown, setShown] = useState(false);

  const expectedPrefix = keyType === "payg" ? "sk-" : "tp-";
  const prefixMismatch =
    apiKey.trim().length > 0 && !apiKey.trim().startsWith(expectedPrefix);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const close = () => {
    setShown(false);
    setTimeout(onClose, 280);
  };

  const save = () => {
    const name = playerName.trim();
    writeStoredPlayerName(name);

    try {
      localStorage.setItem("infiplot:muted", voiceOn ? "0" : "1");
    } catch { /* ignore */ }

    const key = apiKey.trim();
    let ttsConfigured = false;
    if (key) {
      const presetId = keyType === "payg" ? PAYG_PRESET_ID : regionId;
      writeStoredTtsConfig({ presetId, apiKey: key });
      ttsConfigured = true;
    } else if (!ttsAlreadyConfigured) {
      ttsConfigured = false;
    } else {
      ttsConfigured = true;
    }

    if (ttsConfigured && !voiceOn) setVoiceOn(true);
    const finalVoiceOn = ttsConfigured ? true : voiceOn;

    onSaved({ ttsConfigured, playerName: name, audioEnabled: finalVoiceOn });
    close();
  };

  const clearAll = () => {
    clearStoredTtsConfig();
    writeStoredPlayerName("");
    try { localStorage.removeItem("infiplot:muted"); } catch { /* ignore */ }
    onSaved({ ttsConfigured: false, playerName: "", audioEnabled: true });
    close();
  };

  const hasAnySetting = ttsAlreadyConfigured || readStoredPlayerName().length > 0;

  return (
    <div
      onMouseDown={close}
      className={
        "fixed inset-0 z-[60] flex items-center justify-center p-6 md:p-10 transition-all duration-300 " +
        (shown
          ? "bg-clay-900/30 backdrop-blur-md"
          : "bg-clay-900/0 backdrop-blur-0")
      }
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className={
          "flex w-[560px] max-w-[94vw] max-h-[88vh] flex-col overflow-hidden rounded-sm border border-clay-900/15 bg-cream-50 shadow-2xl shadow-clay-900/25 transition-all duration-300 " +
          (shown ? "opacity-100 scale-100" : "opacity-0 scale-95")
        }
      >
        {/* Header */}
        <div className="flex items-center gap-5 px-6 md:px-8 py-5 border-b border-clay-900/10">
          <div className="flex flex-col">
            <span className="font-serif text-xl md:text-2xl text-clay-900">
              设置
            </span>
            <span className="text-[11px] text-clay-500 mt-1 tracking-wide">
              可选 · 这些设置仅保存在本地浏览器
            </span>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="关闭"
            className="ml-auto text-xl leading-none text-clay-500 hover:text-clay-900 transition-colors"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="flex flex-col gap-0 overflow-y-auto">
          {/* ── Player Name Section ── */}
          <div className="flex flex-col gap-3 px-6 md:px-8 py-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-sm border border-clay-900/10 bg-cream-100 text-clay-400">
                <i className="fa-solid fa-user-pen text-[11px]" />
              </span>
              <span className="font-serif text-base text-clay-900">
                玩家名字
              </span>
            </div>
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              type="text"
              maxLength={20}
              autoComplete="off"
              spellCheck={false}
              placeholder="不填则使用「你」"
              className="h-11 w-full rounded-sm border border-clay-900/15 bg-cream-100 px-4 font-sans text-sm text-clay-900 outline-none transition-colors focus:border-ember-500 placeholder:text-clay-400"
            />
            <span className="text-[11px] text-clay-400">
              NPC 会在对话中用这个名字称呼你。不填则默认以「你」称呼。
            </span>
          </div>

          <div className="border-t border-clay-900/8 mx-6 md:mx-8" />

          {/* ── Voice Section (toggle + key as child) ── */}
          <div className="flex flex-col gap-3 px-6 md:px-8 pt-5 pb-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-sm border border-clay-900/10 bg-cream-100 text-clay-400">
                <i className="fa-solid fa-volume-high text-[11px]" />
              </span>
              <span className="font-serif text-base text-clay-900">
                语音配音
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { on: true, label: "开启", icon: "fa-solid fa-volume-high" },
                  { on: false, label: "关闭", icon: "fa-solid fa-volume-xmark" },
                ] as const
              ).map((t) => {
                const active = voiceOn === t.on;
                return (
                  <button
                    key={String(t.on)}
                    type="button"
                    onClick={() => setVoiceOn(t.on)}
                    className={
                      "flex items-center justify-center gap-2 rounded-sm border px-3 py-2.5 text-[13px] transition-all " +
                      (active
                        ? "border-ember-500 bg-ember-500/5 text-clay-900"
                        : "border-clay-900/12 text-clay-600 hover:border-clay-900/35 hover:bg-cream-100")
                    }
                  >
                    <i className={t.icon + " text-[11px]"} />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* ── TTS Key (sub-section, only when voice is on) ── */}
            {voiceOn && (
              <div className="mt-3 flex flex-col gap-4 rounded-sm border border-clay-900/8 bg-cream-100/40 p-4">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-key text-[10px] text-clay-400" />
                  <span className="text-[13px] text-clay-800">
                    自带配音 Key
                  </span>
                  <span className="text-[10px] text-clay-400">可选</span>
                </div>
                <p className="text-[12px] leading-relaxed text-clay-500">
                  填入你自己的
                  <span className="text-clay-800">小米 MiMo API Key</span>
                  ，配音将在浏览器本地合成，Key 只保存在本地、绝不经过服务器。MiMo
                  TTS 目前
                  <span className="text-clay-800">限时免费</span>
                  ，申请即可使用。
                </p>

                <div className="flex flex-col gap-2">
                  <span className="text-[10px] smallcaps text-clay-500">
                    K e y · 类 型
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        {
                          kind: "payg",
                          label: "按量付费 Pay-as-you-go",
                          sub: "sk- 开头",
                        },
                        {
                          kind: "token-plan",
                          label: "套餐 Token Plan",
                          sub: "tp- 开头",
                        },
                      ] as const
                    ).map((t) => {
                      const active = keyType === t.kind;
                      return (
                        <button
                          key={t.kind}
                          type="button"
                          onClick={() => setKeyType(t.kind)}
                          className={
                            "flex flex-col gap-0.5 rounded-sm border px-3 py-2.5 text-left transition-all " +
                            (active
                              ? "border-ember-500 bg-ember-500/5 text-clay-900"
                              : "border-clay-900/12 text-clay-600 hover:border-clay-900/35 hover:bg-cream-100")
                          }
                        >
                          <span className="text-[13px]">{t.label}</span>
                          <span className="text-[10px] text-clay-400">
                            {t.sub}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {keyType === "token-plan" && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] smallcaps text-clay-500">
                      区 域 节 点
                    </span>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {TTS_REGION_PRESETS.map((p) => {
                        const active = p.id === regionId;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setRegionId(p.id)}
                            className={
                              "rounded-sm border px-3 py-2.5 text-left text-[13px] transition-all " +
                              (active
                                ? "border-ember-500 bg-ember-500/5 text-clay-900"
                                : "border-clay-900/12 text-clay-600 hover:border-clay-900/35 hover:bg-cream-100")
                            }
                          >
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                    <span className="text-[11px] text-clay-400">
                      选择与你的套餐订阅地区一致的节点（通常也是延迟最低的那个）。
                    </span>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <span className="text-[10px] smallcaps text-clay-500">
                    A P I · K e y
                  </span>
                  <div className="relative">
                    <input
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      type={showKey ? "text" : "password"}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={
                        keyType === "payg"
                          ? "粘贴 sk- 开头的按量 Key"
                          : "粘贴 tp- 开头的套餐 Key"
                      }
                      className="h-11 w-full rounded-sm border border-clay-900/15 bg-cream-50 pl-4 pr-11 font-sans text-sm text-clay-900 outline-none transition-colors focus:border-ember-500 placeholder:text-clay-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((v) => !v)}
                      aria-label={showKey ? "隐藏" : "显示"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-clay-400 hover:text-clay-700 transition-colors"
                    >
                      <i
                        className={`fa-solid ${showKey ? "fa-eye-slash" : "fa-eye"} text-sm`}
                      />
                    </button>
                  </div>
                  {prefixMismatch && (
                    <span className="flex items-start gap-1.5 text-[11px] leading-relaxed text-ember-500">
                      <i className="fa-solid fa-triangle-exclamation mt-0.5 text-[10px]" />
                      此 Key 不是 {expectedPrefix} 开头，可能与所选「
                      {keyType === "payg"
                        ? "按量付费 Pay-as-you-go"
                        : "套餐 Token Plan"}
                      」类型不符，请确认是否填错。
                    </span>
                  )}
                  <a
                    href={TTS_KEY_DOC_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] text-ember-500 hover:text-ember-400 transition-colors"
                  >
                    <i className="fa-brands fa-github text-[11px]" />
                    如何免费申请 Key？查看图文教程
                  </a>
                </div>

                {footerNote && (
                  <p className="text-[11px] leading-relaxed text-clay-400">
                    {footerNote}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-clay-900/10 px-6 md:px-8 py-4">
          {hasAnySetting && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-2 rounded-sm border border-clay-900/15 px-4 py-2 font-sans text-sm text-clay-600 transition-colors hover:border-clay-900/35 hover:text-clay-900"
            >
              <i className="fa-solid fa-rotate-left text-xs" />
              全部清除
            </button>
          )}
          <button
            type="button"
            onClick={save}
            className="ml-auto inline-flex items-center gap-2 rounded-sm bg-clay-900 px-5 py-2.5 font-sans text-sm text-cream-50 transition-colors hover:bg-ember-500"
          >
            <i className="fa-solid fa-check text-xs" />
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
