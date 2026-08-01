// Centralized i18n engine (i18next + react-i18next).
// This is the single source of truth for language support across the whole app.
// Existing components keep calling t() via useLanguage() (see context/LanguageContext.jsx);
// this module powers that hook and any direct react-i18next usage.
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import ar from "./resources/ar.js";
import en from "./resources/en.js";
import he from "./resources/he.js";
import extra from "./resources/extra.js";
import features from "./resources/features.js";

// Persisted-preference key. Kept identical to the app's previous key so users
// who already selected a language keep their choice (no migration needed).
export const LANGUAGE_STORAGE_KEY = "turn_booking_language";

export const DEFAULT_LANGUAGE = "ar";

// Language metadata: display label (native), text direction, and the locale
// used for Intl date/number/currency formatting.
export const LANGUAGES = {
  ar: { code: "ar", label: "العربية", dir: "rtl", locale: "ar" },
  en: { code: "en", label: "English", dir: "ltr", locale: "en" },
  he: { code: "he", label: "עברית", dir: "rtl", locale: "he-IL" },
};

export const SUPPORTED_LANGUAGES = Object.keys(LANGUAGES);

const isDev =
  typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.DEV : false;

i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      // Base resources (auto-generated from the original dictionary) merged with
      // per-page string extractions kept in extra.js. Both are flat/nested keys
      // in the single "translation" namespace.
      ar: { translation: { ...ar, ...extra.ar, ...features.ar } },
      en: { translation: { ...en, ...extra.en, ...features.en } },
      he: { translation: { ...he, ...extra.he, ...features.he } },
    },
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    defaultNS: "translation",
    // Existing keys are flat camelCase and contain no dots, so the default
    // separators are safe and also allow new grouped keys (e.g. "status.pending").
    load: "languageOnly",
    nonExplicitSupportedLngs: true,
    interpolation: {
      // React already escapes output; double-escaping would corrupt RTL text.
      escapeValue: false,
    },
    returnNull: false,
    returnEmptyString: false,
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ["localStorage"],
    },
    react: {
      // Resources are bundled synchronously, so Suspense is unnecessary and
      // avoids any untranslated flash on first paint.
      useSuspense: false,
    },
    // In development, surface any key that is missing from a resource file so
    // gaps are caught early. Never throws; production stays silent.
    saveMissing: isDev,
    missingKeyHandler: isDev
      ? (lngs, ns, key) => {
          // eslint-disable-next-line no-console
          console.warn(`[i18n] missing translation key: "${key}" (${lngs?.join(",")})`);
        }
      : undefined,
  });

// Applies <html lang/dir> and body dir for the active language.
// Direction-aware styling relies on these attributes (see styles/layout.css).
export function applyDocumentLanguage(language) {
  const meta = LANGUAGES[language] || LANGUAGES[DEFAULT_LANGUAGE];
  if (typeof document !== "undefined") {
    document.documentElement.lang = meta.code;
    document.documentElement.dir = meta.dir;
    if (document.body) document.body.dir = meta.dir;
  }
  return meta;
}

// Keep the document attributes in sync on every language change, including the
// very first initialization.
i18next.on("languageChanged", (lng) => applyDocumentLanguage(lng));
applyDocumentLanguage(i18next.resolvedLanguage || i18next.language || DEFAULT_LANGUAGE);

export default i18next;
