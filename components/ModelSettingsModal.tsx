"use client";

import { useEffect, useState } from "react";
import type { ProviderProtocol } from "@infiplot/types";
import {
  clearStoredModelConfig,
  readStoredModelConfig,
  writeStoredModelConfig,
} from "@/lib/clientModelConfig";

const PROVIDER_OPTIONS: { value: ProviderProtocol | ""; label: string }[] = [
  { value: "", label: "自动推断（推荐）" },
  { value: "openai_compatible", label: "OpenAI Compatible" },
  { value: "openai", label: "OpenAI (Native)" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google Gemini" },
  { value: "runware", label: "Runware" },
];

type ModelGroup = {
  key: "text" | "image" | "vision";
  label: string;
  icon: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  provider: string;
};

export function ModelSettingsModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const initial = readStoredModelConfig();

  const [groups, setGroups] = useState<ModelGroup[]>([
    {
      key: "text",
      label: "文本模型",
      icon: "fa-solid fa-pen-nib",
      baseUrl: initial?.textBaseUrl ?? "",
      apiKey: initial?.textApiKey ?? "",
      model: initial?.textModel ?? "",
      provider: initial?.textProvider ?? "",
    },
    {
      key: "image",
      label: "绘图模型",
      icon: "fa-solid fa-palette",
      baseUrl: initial?.imageBaseUrl ?? "",
      apiKey: initial?.imageApiKey ?? "",
      model: initial?.imageModel ?? "",
      provider: initial?.imageProvider ?? "",
    },
    {
      key: "vision",
      label: "识图模型",
      icon: "fa-solid fa-eye",
      baseUrl: initial?.visionBaseUrl ?? "",
      apiKey: initial?.visionApiKey ?? "",
      model: initial?.visionModel ?? "",
      provider: initial?.visionProvider ?? "",
    },
  ]);

  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const close = () => {
    setShown(false);
    setTimeout(onClose, 280);
  };

  const updateGroup = (
    key: string,
    field: keyof Omit<ModelGroup, "key" | "label" | "icon">,
    value: string,
  ) => {
    setGroups((prev) =>
      prev.map((g) => (g.key === key ? { ...g, [field]: value } : g)),
    );
  };

  const save = () => {
    const [text, image, vision] = groups;
    writeStoredModelConfig({
      textBaseUrl: text.baseUrl,
      textApiKey: text.apiKey,
      textModel: text.model,
      textProvider: (text.provider as ProviderProtocol) || undefined,
      imageBaseUrl: image.baseUrl,
      imageApiKey: image.apiKey,
      imageModel: image.model,
      imageProvider: (image.provider as ProviderProtocol) || undefined,
      visionBaseUrl: vision.baseUrl,
      visionApiKey: vision.apiKey,
      visionModel: vision.model,
      visionProvider: (vision.provider as ProviderProtocol) || undefined,
    });
    onSaved();
    close();
  };

  const clearAll = () => {
    clearStoredModelConfig();
    setGroups((prev) =
      prev.map((g) => ({ ...g, baseUrl: "", apiKey: "", model: "", provider: "" })),
    );
    onSaved();
    close();
  };

  const hasAnySetting = groups.some(
    (g) => g.baseUrl.trim() && g.apiKey.trim() && g.model.trim(),
  );

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
          "flex w-[600px] max-w-[96vw] max-h-[90vh] flex-col overflow-hidden rounded-sm border border-clay-900/15 bg-cream-50 shadow-2xl shadow-clay-900/25 transition-all duration-300 " +
          (shown ? "opacity-100 scale-100" : "opacity-0 scale-95")
        }
      >
        {/* Header */}
        <div className="flex items-center gap-5 px-6 md:px-8 py-5 border-b border-clay-900/10">
          <div className="flex flex-col">
            <span className="font-serif text-xl md:text-2xl text-clay-900">
              模型设置
            </span>
            <span className="text-[11px] text-clay-500 mt-1 tracking-wide">
              API Key 仅保存在浏览器本地，不会发送到服务器
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
          {groups.map((g, idx) => (
            <div key={g.key}>
              {idx > 0 && (
                <div className="border-t border-clay-900/8 mx-6 md:mx-8" />
              )}
              <div className="flex flex-col gap-3 px-6 md:px-8 py-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-sm border border-clay-900/10 bg-cream-100 text-clay-400">
                    <i className={`${g.icon} text-[11px]`} />
                  </span>
                  <span className="font-serif text-base text-clay-900">
                    {g.label}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[10px] smallcaps text-clay-500">
                    B A S E · U R L
                  </span>
                  <input
                    value={g.baseUrl}
                    onChange={(e) => updateGroup(g.key, "baseUrl", e.target.value)}
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="https://api.example.com/v1"
                    className="h-10 w-full rounded-sm border border-clay-900/15 bg-cream-100 px-4 font-sans text-sm text-clay-900 outline-none transition-colors focus:border-ember-500 placeholder:text-clay-400"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[10px] smallcaps text-clay-500">
                    A P I · K e y
                  </span>
                  <div className="relative">
                    <input
                      value={g.apiKey}
                      onChange={(e) => updateGroup(g.key, "apiKey", e.target.value)}
                      type={showKeys[g.key] ? "text" : "password"}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="sk-..."
                      className="h-10 w-full rounded-sm border border-clay-900/15 bg-cream-100 pl-4 pr-11 font-sans text-sm text-clay-900 outline-none transition-colors focus:border-ember-500 placeholder:text-clay-400"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowKeys((prev) => ({
                          ...prev,
                          [g.key]: !prev[g.key],
                        }))
                      }
                      aria-label={showKeys[g.key] ? "隐藏" : "显示"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-clay-400 hover:text-clay-700 transition-colors"
                    >
                      <i
                        className={`fa-solid ${showKeys[g.key] ? "fa-eye-slash" : "fa-eye"} text-sm`}
                      />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[10px] smallcaps text-clay-500">
                    M o d e l
                  </span>
                  <input
                    value={g.model}
                    onChange={(e) => updateGroup(g.key, "model", e.target.value)}
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="gpt-4o / claude-3-5-sonnet / flux-1-dev ..."
                    className="h-10 w-full rounded-sm border border-clay-900/15 bg-cream-100 px-4 font-sans text-sm text-clay-900 outline-none transition-colors focus:border-ember-500 placeholder:text-clay-400"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[10px] smallcaps text-clay-500">
                    P r o v i d e r（可选）
                  </span>
                  <select
                    value={g.provider}
                    onChange={(e) => updateGroup(g.key, "provider", e.target.value)}
                    className="h-10 w-full rounded-sm border border-clay-900/15 bg-cream-100 px-4 font-sans text-sm text-clay-900 outline-none transition-colors focus:border-ember-500"
                  >
                    {PROVIDER_OPTIONS.map((opt) => (
                      <option key={opt.value || "auto"} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-clay-400">
                    留空时系统会根据 Base URL 自动推断协议。
                  </span>
                </div>
              </div>
            </div>
          ))}

          <div className="border-t border-clay-900/8 mx-6 md:mx-8" />

          <div className="px-6 md:px-8 py-4">
            <p className="text-[11px] leading-relaxed text-clay-400">
              <i className="fa-solid fa-circle-info mr-1.5" />
              请确保你的 API 端点支持浏览器跨域请求（CORS）。大多数主流提供商（OpenAI、Anthropic、Gemini、Runware 等）已默认支持。
            </p>
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
