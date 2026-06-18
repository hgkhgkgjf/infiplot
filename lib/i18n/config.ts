// Supported locales for InfiPlot
export const DEFAULT_LOCALE = "zh-CN" as const;

export type Locale =
  | "en"
  | "zh-CN"
  | "zh-TW"
  | "zh-HK"
  | "ja"
  | "ko"
  | "es"
  | "fr"
  | "de"
  | "pt-BR"
  | "pt"
  | "ru"
  | "it"
  | "vi"
  | "th"
  | "id"
  | "tr"
  | "pl"
  | "nl"
  | "uk"
  | "hi"
  | "cs";

export const LOCALE_NAMES: Record<Locale, string> = {
  "en": "English",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文（台灣）",
  "zh-HK": "繁體中文（香港）",
  "ja": "日本語",
  "ko": "한국어",
  "es": "Español",
  "fr": "Français",
  "de": "Deutsch",
  "pt-BR": "Português (Brasil)",
  "pt": "Português",
  "ru": "Русский",
  "it": "Italiano",
  "vi": "Tiếng Việt",
  "th": "ภาษาไทย",
  "id": "Bahasa Indonesia",
  "tr": "Türkçe",
  "pl": "Polski",
  "nl": "Nederlands",
  "uk": "Українська",
  "hi": "हिन्दी",
  "cs": "Čeština",
};

export const LOCALES: Locale[] = Object.keys(LOCALE_NAMES) as Locale[];

// Locale storage key
export const LOCALE_STORAGE_KEY = "infiplot:locale";

// Get locale from localStorage or browser language
export function getInitialLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;

  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && LOCALES.includes(stored as Locale)) {
      return stored as Locale;
    }
  } catch {
    // ignore localStorage errors
  }

  // Try to match browser language
  const browserLang = navigator.language;
  const exactMatch = LOCALES.find((l) => l === browserLang);
  if (exactMatch) return exactMatch;

  // Try base language match (e.g., "zh" for "zh-TW")
  const baseLang = browserLang.split("-")[0];
  if (baseLang) {
    const baseMatch = LOCALES.find((l) => l.startsWith(baseLang));
    if (baseMatch) return baseMatch;
  }

  return DEFAULT_LOCALE;
}

// Save locale to localStorage
export function setLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore localStorage errors
  }
}

// Get RTL locales (right-to-left languages)
export const RTL_LOCALES: Set<Locale> = new Set();

export function isRTL(locale: Locale): boolean {
  return RTL_LOCALES.has(locale);
}
