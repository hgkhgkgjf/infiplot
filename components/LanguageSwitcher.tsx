"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n/config";

interface LanguageSwitcherProps {
  className?: string;
  /** "compact" = icon + short label, fits a header next to other icons.
   *  "full" = icon + full label + chevron, for a settings panel row. */
  variant?: "compact" | "full";
}

// Locales with actual filled-in translations. The catalog ships stub files
// for the other 18 locales (so the loader doesn't 404), but only these
// three have been reviewed. Hide the rest until they're translated.
const TRANSLATED_LOCALES: Locale[] = ["zh-CN", "en", "ja"];

// Short labels for the compact header button — keeps the row tidy next to
// the gear/github/x icons where every other item is 1-2 glyphs.
const SHORT_LOCALE_NAMES: Record<Locale, string> = {
  "zh-CN": "中文",
  "zh-TW": "繁中",
  "zh-HK": "繁中",
  en: "EN",
  ja: "日本語",
  ko: "한국어",
  es: "ES",
  fr: "FR",
  de: "DE",
  "pt-BR": "PT",
  pt: "PT",
  ru: "RU",
  it: "IT",
  vi: "VI",
  th: "TH",
  id: "ID",
  tr: "TR",
  pl: "PL",
  nl: "NL",
  uk: "UK",
  hi: "हिन्दी",
  cs: "CZ",
};

export function LanguageSwitcher({ className = "", variant = "full" }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  const currentLocaleName = LOCALE_NAMES[locale] || locale;
  const currentShortName = SHORT_LOCALE_NAMES[locale] || locale;
  const availableLocales = LOCALES.filter((l) => TRANSLATED_LOCALES.includes(l));

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={
          variant === "compact"
            ? "inline-flex items-center gap-1.5 text-base text-clay-500 hover:text-ember-500 transition-colors"
            : "flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-clay-100 transition-colors text-clay-700"
        }
        aria-label={t("language.select")}
        title={t("language.select")}
        aria-expanded={isOpen}
      >
        <i className="fa-solid fa-globe" />
        <span className={variant === "compact" ? "text-[12px] font-sans" : "text-sm"}>
          {variant === "compact" ? currentShortName : currentLocaleName}
        </span>
        {variant === "full" && (
          <i
            className={`fa-solid fa-chevron-down text-[9px] transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 top-full mt-1 w-44 overflow-hidden rounded-sm border border-clay-900/15 bg-cream-50 shadow-xl shadow-clay-900/10 z-20">
            <div className="py-1">
              {availableLocales.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => {
                    setLocale(loc);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-1.5 text-sm font-serif transition-colors hover:bg-cream-100 ${
                    locale === loc ? "text-ember-500" : "text-clay-700"
                  }`}
                >
                  {LOCALE_NAMES[loc]}
                  {locale === loc && <i className="fa-solid fa-check text-[10px]" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

