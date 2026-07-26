// Locale-aware formatting helpers (dates, times, numbers, weekdays, months,
// currency). These read the active language's Intl locale so formatting stays
// consistent with the selected language without touching any business values.
import { LANGUAGES, DEFAULT_LANGUAGE } from "./index.js";

export function localeFor(language) {
  return (LANGUAGES[language] || LANGUAGES[DEFAULT_LANGUAGE]).locale;
}

function toDate(value) {
  if (value instanceof Date) return value;
  if (value == null) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value, language, options) {
  const d = toDate(value);
  if (!d) return "";
  return new Intl.DateTimeFormat(localeFor(language), options || { dateStyle: "medium" }).format(d);
}

export function formatTime(value, language, options) {
  const d = toDate(value);
  if (!d) return "";
  return new Intl.DateTimeFormat(
    localeFor(language),
    options || { hour: "2-digit", minute: "2-digit" }
  ).format(d);
}

export function formatDateTime(value, language, options) {
  const d = toDate(value);
  if (!d) return "";
  return new Intl.DateTimeFormat(
    localeFor(language),
    options || { dateStyle: "medium", timeStyle: "short" }
  ).format(d);
}

export function formatNumber(value, language, options) {
  if (value == null || value === "") return "";
  return new Intl.NumberFormat(localeFor(language), options).format(Number(value));
}

export function formatCurrency(value, language, currency = "ILS", options) {
  if (value == null || value === "") return "";
  return new Intl.NumberFormat(localeFor(language), {
    style: "currency",
    currency,
    ...options,
  }).format(Number(value));
}

export function weekdayName(value, language, format = "long") {
  const d = toDate(value);
  if (!d) return "";
  return new Intl.DateTimeFormat(localeFor(language), { weekday: format }).format(d);
}

export function monthName(value, language, format = "long") {
  const d = toDate(value);
  if (!d) return "";
  return new Intl.DateTimeFormat(localeFor(language), { month: format }).format(d);
}
