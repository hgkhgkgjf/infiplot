"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { Locale } from "./config";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  getInitialLocale,
  setLocale as saveLocale,
} from "./config";
import { getNestedValue, formatTranslation } from "./utils";

// Translation function type
export type TranslationFunction = (
  key: string,
  params?: Record<string, string | number | boolean>,
) => string;

// Context type
interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslationFunction;
  // Returns an array of strings stored under the key (e.g. the typewriter
  // example phrases). Falls back to the key wrapped in an array so callers
  // can safely index.
  tArray: (key: string) => string[];
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

// Provider props
interface I18nProviderProps {
  children: ReactNode;
  initialLocale?: Locale;
}

// Dynamic import of locale files
  async function importLocale(locale: Locale) {
    switch (locale) {
      case "zh-CN":
        return (await import("./locales/zh-CN")).zhCN;
      case "en":
        return (await import("./locales/en")).en;
      case "zh-TW":
        return (await import("./locales/zh-TW")).zhTW;
      case "zh-HK":
        return (await import("./locales/zh-HK")).zhHK;
      case "ja":
        return (await import("./locales/ja")).ja;
      case "ko":
        return (await import("./locales/ko")).ko;
      case "es":
        return (await import("./locales/es")).es;
      case "fr":
        return (await import("./locales/fr")).fr;
      case "de":
        return (await import("./locales/de")).de;
      case "pt-BR":
        return (await import("./locales/pt-BR")).ptBR;
      case "pt":
        return (await import("./locales/pt")).pt;
      case "ru":
        return (await import("./locales/ru")).ru;
      case "it":
        return (await import("./locales/it")).it;
      case "vi":
        return (await import("./locales/vi")).vi;
      case "th":
        return (await import("./locales/th")).th;
      case "id":
        return (await import("./locales/id")).id;
      case "tr":
        return (await import("./locales/tr")).tr;
      case "pl":
        return (await import("./locales/pl")).pl;
      case "nl":
        return (await import("./locales/nl")).nl;
      case "uk":
        return (await import("./locales/uk")).uk;
      case "hi":
        return (await import("./locales/hi")).hi;
      case "cs":
        return (await import("./locales/cs")).cs;
      default:
        console.warn(`Locale ${locale} not loaded, falling back to English`);
        return (await import("./locales/en")).en;
    }
  }

// Provider component
export function I18nProvider({ children, initialLocale }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE);
  const [translations, setTranslations] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Load translations when locale changes
  useEffect(() => {
    let cancelled = false;

    async function loadTranslations() {
      setIsLoading(true);
      try {
        const localeData = await importLocale(locale);
        if (!cancelled) {
          setTranslations(localeData as Record<string, unknown>);
          setIsLoading(false);
        }
      } catch (error) {
        console.error(`Failed to load translations for ${locale}:`, error);
        if (!cancelled) {
          // Fallback to default locale on error
          if (locale !== DEFAULT_LOCALE) {
            const fallback = await importLocale(DEFAULT_LOCALE);
            setTranslations(fallback as Record<string, unknown>);
          }
          setIsLoading(false);
        }
      }
    }

    loadTranslations();

    return () => {
      cancelled = true;
    };
  }, [locale]);

  // Keep <html lang="..."> in sync with the active locale for a11y / SEO.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  // Set locale function
  const setLocale = (newLocale: Locale) => {
    saveLocale(newLocale);
    setLocaleState(newLocale);
  };

  // Translation function
  const t: TranslationFunction = (key, params = {}) => {
    if (isLoading) {
      return key; // Return key during loading
    }

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

  const tArray: I18nContextType["tArray"] = (key) => {
    if (isLoading) return [];
    const value = getNestedValue(translations, key);
    if (Array.isArray(value)) {
      return value.map((v) => (typeof v === "string" ? v : String(v)));
    }
    if (value === undefined) {
      console.warn(`Translation array missing for key: ${key}`);
    }
    return [];
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, tArray }}>
      {children}
    </I18nContext.Provider>
  );
}

// Hook to use i18n
export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}

// Hook to get just the translation function (for server-side or non-provider contexts)
export function useTranslation(locale?: Locale) {
  const { t: clientT, locale: currentLocale } = useI18n();

  return {
    t: clientT,
    locale: locale ?? currentLocale,
  };
}
