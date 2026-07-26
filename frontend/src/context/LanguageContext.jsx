import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n, {
  LANGUAGES as I18N_LANGUAGES,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  applyDocumentLanguage,
} from "../i18n/index.js";
import {
  formatDate as fmtDate,
  formatTime as fmtTime,
  formatDateTime as fmtDateTime,
  formatNumber as fmtNumber,
  formatCurrency as fmtCurrency,
  weekdayName as fmtWeekday,
  monthName as fmtMonth,
} from "../i18n/format.js";

// Re-exported so existing imports (e.g. GlobalControls' LanguageSwitcher) keep
// working and automatically gain the English option.
export const LANGUAGES = I18N_LANGUAGES;

const LanguageContext = createContext(null);

// Backward-compatible provider. It preserves the original public surface
// (language, lang, dir, setLanguage, t) and adds locale-aware format helpers.
// Internally everything is powered by the centralized i18next instance.
export function LanguageProvider({ children }) {
  const { t, i18n: i18nInstance } = useTranslation();
  const [language, setLanguage] = useState(
    () => i18nInstance.resolvedLanguage || i18nInstance.language || DEFAULT_LANGUAGE
  );

  // Keep local state in sync with i18next so every consumer re-renders on a
  // language change (rule: update the whole app immediately, no refresh).
  useEffect(() => {
    const handler = (lng) => setLanguage(lng);
    i18nInstance.on("languageChanged", handler);
    return () => i18nInstance.off("languageChanged", handler);
  }, [i18nInstance]);

  // Ensure document lang/dir reflect the active language on mount as well.
  useEffect(() => {
    applyDocumentLanguage(language);
  }, [language]);

  const changeLanguage = useCallback(
    (next) => {
      if (SUPPORTED_LANGUAGES.includes(next)) i18n.changeLanguage(next);
    },
    []
  );

  const value = useMemo(() => {
    const meta = LANGUAGES[language] || LANGUAGES[DEFAULT_LANGUAGE];
    return {
      language,
      lang: language,
      dir: meta.dir,
      locale: meta.locale,
      setLanguage: changeLanguage,
      t,
      // Locale-aware formatters bound to the active language.
      formatDate: (v, options) => fmtDate(v, language, options),
      formatTime: (v, options) => fmtTime(v, language, options),
      formatDateTime: (v, options) => fmtDateTime(v, language, options),
      formatNumber: (v, options) => fmtNumber(v, language, options),
      formatCurrency: (v, currency, options) => fmtCurrency(v, language, currency, options),
      weekdayName: (v, format) => fmtWeekday(v, language, format),
      monthName: (v, format) => fmtMonth(v, language, format),
    };
  }, [language, t, changeLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used inside LanguageProvider");
  return value;
}
