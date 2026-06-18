// Main i18n exports
export * from "./config";
export * from "./types";
export * from "./utils";
export { I18nProvider, useI18n, useTranslation } from "./client";
export {
  getLocaleFromHeaders,
  loadTranslations,
  getTranslations,
  createTranslator,
  getServerLocale,
} from "./server";

// Re-export locale types for convenience
export type { Locale, LOCALES, LOCALE_NAMES } from "./config";
