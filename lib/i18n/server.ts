import type { Locale } from "./config";
import { DEFAULT_LOCALE, getInitialLocale } from "./config";
import { getNestedValue, formatTranslation } from "./utils";

// Server-side translation cache
const translationCache = new Map<Locale, Record<string, unknown>>();

// Get locale from request headers
export function getLocaleFromHeaders(headers: Headers): Locale {
  // Check for custom locale header
  const customLocale = headers.get("x-locale");
  if (customLocale) {
    return customLocale as Locale;
  }

  // Check Accept-Language header
  const acceptLanguage = headers.get("accept-language");
  if (acceptLanguage) {
    const browserLang = acceptLanguage.split(",")[0]?.split("-")[0];
    // Map common language codes to our locales
    const localeMap: Record<string, Locale> = {
      en: "en",
      zh: "zh-CN",
      ja: "ja",
      ko: "ko",
      es: "es",
      fr: "fr",
      de: "de",
      pt: "pt",
      ru: "ru",
      it: "it",
      vi: "vi",
      th: "th",
      id: "id",
      tr: "tr",
      pl: "pl",
      nl: "nl",
      uk: "uk",
      hi: "hi",
      cs: "cs",
    };

    const browserLangBase = acceptLanguage.split(",")[0]?.split("-")[0];
    if (browserLangBase) {
      const matched = localeMap[browserLangBase];
      if (matched) return matched;
    }
  }

  return DEFAULT_LOCALE;
}

// Load translations for server-side
export async function loadTranslations(locale: Locale): Promise<Record<string, unknown>> {
  // Check cache first
  if (translationCache.has(locale)) {
    return translationCache.get(locale)!;
  }

  try {
    // Dynamic import based on locale
    let translations;
    switch (locale) {
      case "zh-CN":
        translations = (await import("./locales/zh-CN")).zhCN;
        break;
      case "en":
        translations = (await import("./locales/en")).en;
        break;
      case "zh-TW":
        translations = (await import("./locales/zh-TW")).zhTW;
        break;
      case "zh-HK":
        translations = (await import("./locales/zh-HK")).zhHK;
        break;
      case "ja":
        translations = (await import("./locales/ja")).ja;
        break;
      case "ko":
        translations = (await import("./locales/ko")).ko;
        break;
      case "es":
        translations = (await import("./locales/es")).es;
        break;
      case "fr":
        translations = (await import("./locales/fr")).fr;
        break;
      case "de":
        translations = (await import("./locales/de")).de;
        break;
      case "pt-BR":
        translations = (await import("./locales/pt-BR")).ptBR;
        break;
      case "pt":
        translations = (await import("./locales/pt")).pt;
        break;
      case "ru":
        translations = (await import("./locales/ru")).ru;
        break;
      case "it":
        translations = (await import("./locales/it")).it;
        break;
      case "vi":
        translations = (await import("./locales/vi")).vi;
        break;
      case "th":
        translations = (await import("./locales/th")).th;
        break;
      case "id":
        translations = (await import("./locales/id")).id;
        break;
      case "tr":
        translations = (await import("./locales/tr")).tr;
        break;
      case "pl":
        translations = (await import("./locales/pl")).pl;
        break;
      case "nl":
        translations = (await import("./locales/nl")).nl;
        break;
      case "uk":
        translations = (await import("./locales/uk")).uk;
        break;
      case "hi":
        translations = (await import("./locales/hi")).hi;
        break;
      case "cs":
        translations = (await import("./locales/cs")).cs;
        break;
      default:
        console.warn(`Translations for ${locale} not found, using English fallback`);
        translations = (await import("./locales/en")).en;
        break;
    }

    translationCache.set(locale, translations as Record<string, unknown>);
    return translations as Record<string, unknown>;
  } catch (error) {
    console.error(`Failed to load translations for ${locale}:`, error);
    // Fallback to default locale
    const fallback = await import("./locales/zh-CN");
    return fallback.zhCN as Record<string, unknown>;
  }
}

// Server-side translation function
export async function getTranslations(locale: Locale): Promise<Record<string, unknown>> {
  return loadTranslations(locale);
}

// Create a translation function for server components
export function createTranslator(translations: Record<string, unknown>) {
  return function t(key: string, params: Record<string, string | number | boolean> = {}): string {
    const value = getNestedValue(translations, key);

    if (value === undefined) {
      console.warn(`Translation missing for key: ${key}`);
      return key;
    }

    if (typeof value === "function") {
      return (value as (params: Record<string, string | number | boolean>) => string)(params);
    }

    if (typeof value === "string") {
      return formatTranslation(value, params);
    }

    return String(value);
  };
}

// Get initial locale for server components
export function getServerLocale(): Locale {
  return DEFAULT_LOCALE; // Will be overridden by middleware in production
}
