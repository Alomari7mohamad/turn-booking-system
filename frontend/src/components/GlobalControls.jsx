import { useEffect, useState } from "react";
import { LANGUAGES, useLanguage } from "../context/LanguageContext.jsx";

const A11Y_KEY = "turn_booking_accessibility";

const defaultA11y = {
  fontScale: 1,
  grayscale: false,
  invert: false,
  lowSaturation: false,
  colorFilter: "none",
  contrast: false,
  bigText: false,
  highlightLinks: false,
  underlineLinks: false,
  hideImages: false,
  readableFont: false,
  lineSpacing: false,
  letterSpacing: false,
  alignLeft: false,
  bigCursor: false,
  reduceMotion: false,
  stopAnimations: false,
};

const copy = {
  ar: {
    title: "أدوات إمكانية الوصول",
    subtitle: "قم بتخصيص تجربتك لتناسب احتياجاتك",
    fontSize: "حجم النص",
    colorModes: "أوضاع الألوان",
    grayscale: "تدرج الرمادي",
    invert: "عكس الألوان",
    lowSaturation: "تشبع منخفض",
    colorFilter: "فلتر عمى الألوان",
    none: "لا شيء",
    red: "أحمر",
    blueYellow: "أزرق-أصفر",
    redGreen: "أحمر-أخضر",
    visual: "خيارات بصرية",
    contrast: "تباين عالي",
    bigText: "نص كبير",
    highlightLinks: "تسليط الضوء على الروابط",
    underlineLinks: "تسطير الروابط",
    hideImages: "إخفاء الصور",
    text: "خيارات النص",
    readableFont: "خط قابل للقراءة",
    lineSpacing: "زيادة المسافة بين الأسطر",
    letterSpacing: "مسافة بين الحروف",
    alignLeft: "محاذاة النص لليسار",
    navigation: "خيارات التنقل",
    bigCursor: "مؤشر كبير",
    reduceMotion: "تقليل الحركة",
    stopAnimations: "إيقاف الرسوم المتحركة",
    reset: "إعادة تعيين إلى الافتراضي",
    close: "إغلاق",
  },
  he: {
    title: "כלי נגישות",
    subtitle: "התאימו את חוויית השימוש לצרכים שלכם",
    fontSize: "גודל טקסט",
    colorModes: "מצבי צבע",
    grayscale: "גווני אפור",
    invert: "היפוך צבעים",
    lowSaturation: "רוויה נמוכה",
    colorFilter: "מסנן עיוורון צבעים",
    none: "ללא",
    red: "אדום",
    blueYellow: "כחול-צהוב",
    redGreen: "אדום-ירוק",
    visual: "אפשרויות חזותיות",
    contrast: "ניגודיות גבוהה",
    bigText: "טקסט גדול",
    highlightLinks: "הדגשת קישורים",
    underlineLinks: "קו תחתון לקישורים",
    hideImages: "הסתרת תמונות",
    text: "אפשרויות טקסט",
    readableFont: "גופן קריא",
    lineSpacing: "הגדלת רווח בין שורות",
    letterSpacing: "רווח בין אותיות",
    alignLeft: "יישור טקסט לשמאל",
    navigation: "אפשרויות ניווט",
    bigCursor: "סמן גדול",
    reduceMotion: "הפחתת תנועה",
    stopAnimations: "עצירת אנימציות",
    reset: "איפוס לברירת מחדל",
    close: "סגירה",
  },
};

const cleanA11yCopy = {
  ar: {
    title: "أدوات إمكانية الوصول",
    subtitle: "قم بتخصيص تجربتك لتناسب احتياجاتك",
    fontSize: "حجم النص",
    colorModes: "أوضاع الألوان",
    grayscale: "تدرج الرمادي",
    invert: "عكس الألوان",
    lowSaturation: "تشبع منخفض",
    colorFilter: "فلتر عمى الألوان",
    none: "لا شيء",
    red: "أحمر",
    blueYellow: "أزرق-أصفر",
    redGreen: "أحمر-أخضر",
    visual: "خيارات بصرية",
    contrast: "تباين عالي",
    bigText: "نص كبير",
    highlightLinks: "تسليط الضوء على الروابط",
    underlineLinks: "تسطير الروابط",
    hideImages: "إخفاء الصور",
    text: "خيارات النص",
    readableFont: "خط قابل للقراءة",
    lineSpacing: "زيادة المسافة بين الأسطر",
    letterSpacing: "مسافة بين الحروف",
    alignLeft: "محاذاة النص لليسار",
    navigation: "خيارات التنقل",
    bigCursor: "مؤشر كبير",
    reduceMotion: "تقليل الحركة",
    stopAnimations: "إيقاف الرسوم المتحركة",
    reset: "إعادة تعيين إلى الافتراضي",
    close: "إغلاق",
  },
  he: {
    title: "כלי נגישות",
    subtitle: "התאימו את חוויית השימוש לצרכים שלכם",
    fontSize: "גודל טקסט",
    colorModes: "מצבי צבע",
    grayscale: "גווני אפור",
    invert: "היפוך צבעים",
    lowSaturation: "רוויה נמוכה",
    colorFilter: "מסנן עיוורון צבעים",
    none: "ללא",
    red: "אדום",
    blueYellow: "כחול-צהוב",
    redGreen: "אדום-ירוק",
    visual: "אפשרויות חזותיות",
    contrast: "ניגודיות גבוהה",
    bigText: "טקסט גדול",
    highlightLinks: "הדגשת קישורים",
    underlineLinks: "קו תחתון לקישורים",
    hideImages: "הסתרת תמונות",
    text: "אפשרויות טקסט",
    readableFont: "גופן קריא",
    lineSpacing: "הגדלת רווח בין שורות",
    letterSpacing: "רווח בין אותיות",
    alignLeft: "יישור טקסט לשמאל",
    navigation: "אפשרויות ניווט",
    bigCursor: "סמן גדול",
    reduceMotion: "הפחתת תנועה",
    stopAnimations: "עצירת אנימציות",
    reset: "איפוס לברירת מחדל",
    close: "סגירה",
  },
};

const textTranslations = new Map(Object.entries({
  "لوحة التحكم": "לוח בקרה",
  "إدارة المحلات": "ניהול עסקים",
  "إدارة المدراء": "ניהול מנהלים",
  "الحجوزات": "תורים",
  "الحجوزات التي تم رفضها": "תורים שנדחו",
  "الخدمات": "שירותים",
  "الموظفون": "עובדים",
  "ساعات العمل": "שעות פעילות",
  "الاشتراك": "מנוי",
  "سجل النشاط": "יומן פעילות",
  "إعدادات المحل": "הגדרות העסק",
  "إدارة الخدمات": "ניהול שירותים",
  "إدارة الموظفين": "ניהול עובדים",
  "البيانات الأساسية": "פרטים בסיסיים",
  "إعدادات الدفع": "הגדרות תשלום",
  "حفظ التغييرات": "שמירת שינויים",
  "حفظ": "שמירה",
  "إضافة": "הוספה",
  "تعديل": "עריכה",
  "حذف": "מחיקה",
  "إلغاء": "ביטול",
  "بحث": "חיפוש",
  "طباعة": "הדפסה",
  "قبول": "אישור",
  "رفض": "דחייה",
  "تأكيد": "אישור",
  "الاسم": "שם",
  "الهاتف": "טלפון",
  "العنوان": "כתובת",
  "البريد الإلكتروني": "אימייל",
  "كلمة المرور": "סיסמה",
  "اسم المحل": "שם העסק",
  "اسم صاحب المحل": "שם בעל העסק",
  "رقم الهاتف": "מספר טלפון",
  "شعار المحل": "לוגו העסק",
  "لون المحل": "צבע העסק",
  "طريقة الدفع": "אמצעי תשלום",
  "حالة الدفع": "סטטוס תשלום",
  "الخدمة مجانية": "השירות בחינם",
  "مدفوع": "שולם",
  "غير مدفوع": "לא שולם",
  "بانتظار التأكيد": "ממתין לאישור",
  "مؤكد": "מאושר",
  "مرفوض": "נדחה",
  "مكتمل": "הושלם",
  "لم يحضر": "לא הגיע",
  "تأخر": "איחור",
  "كل الموظفين": "כל העובדים",
  "كل حالات الدفع": "כל מצבי התשלום",
  "اختر الخدمة": "בחר שירות",
  "اختر الموظف": "בחר עובד",
  "اليوم والوقت": "יום ושעה",
  "بياناتك": "הפרטים שלך",
  "تأكيد الحجز": "אישור התור",
  "تأكيد الحجز المجاني": "אישור תור בחינם",
  "لا توجد بيانات": "אין נתונים",
  "لا توجد حجوزات": "אין תורים",
  "لا توجد مواعيد قادمة": "אין תורים קרובים",
  "ستظهر الحجوزات الجديدة هنا": "תורים חדשים יופיעו כאן",
  "الخدمة": "שירות",
  "الموظف": "עובד",
  "العميل": "לקוח",
  "الحالة": "סטטוס",
  "الإجراءات": "פעולות",
  "السعر": "מחיר",
  "المدة": "משך",
  "دقيقة": "דקה",
}));

const originalTextNodes = new WeakMap();

function translateTextNode(node, language) {
  const value = node.nodeValue;
  if (!value || !value.trim()) return;
  const parent = node.parentElement;
  if (!parent || parent.closest("[data-no-auto-translate], input, textarea, select, script, style")) return;
  if (!originalTextNodes.has(node)) originalTextNodes.set(node, value);

  const original = originalTextNodes.get(node);
  if (language === "ar") {
    if (node.nodeValue !== original) node.nodeValue = original;
    return;
  }

  const trimmed = original.trim();
  const translated = textTranslations.get(trimmed);
  if (!translated) return;
  node.nodeValue = original.replace(trimmed, translated);
}

function translateTree(root, language) {
  if (!root || typeof document === "undefined") return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    translateTextNode(node, language);
    node = walker.nextNode();
  }
}

function loadA11y() {
  try {
    const saved = JSON.parse(localStorage.getItem(A11Y_KEY)) || {};
    return { ...defaultA11y, ...saved };
  } catch {
    return defaultA11y;
  }
}

function pageFilter(settings) {
  const filters = [];
  if (settings.grayscale) filters.push("grayscale(1)");
  if (settings.invert) filters.push("invert(1) hue-rotate(180deg)");
  if (settings.lowSaturation) filters.push("saturate(.35)");
  if (settings.colorFilter === "red") filters.push("sepia(.3) saturate(1.45) hue-rotate(-18deg)");
  if (settings.colorFilter === "blueYellow") filters.push("sepia(.25) saturate(1.25) hue-rotate(155deg)");
  if (settings.colorFilter === "redGreen") filters.push("sepia(.35) saturate(.8) hue-rotate(25deg)");
  return filters.join(" ") || "none";
}

function applyA11y(settings) {
  const html = document.documentElement;
  const scale = Math.min(1.7, Math.max(0.85, settings.fontScale * (settings.bigText ? 1.18 : 1)));
  html.style.setProperty("--font-scale", scale.toFixed(2));
  html.style.setProperty("--a11y-page-filter", pageFilter(settings));
  html.classList.toggle("a11y-filtered", pageFilter(settings) !== "none");
  [
    "contrast",
    "highlightLinks",
    "underlineLinks",
    "hideImages",
    "readableFont",
    "lineSpacing",
    "letterSpacing",
    "alignLeft",
    "bigCursor",
    "reduceMotion",
    "stopAnimations",
  ].forEach((key) => html.classList.toggle(`a11y-${key}`, !!settings[key]));
}

export function GlobalControls() {
  const { language, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(loadA11y);
  const a = cleanA11yCopy[language] || cleanA11yCopy.ar;

  useEffect(() => {
    applyA11y(settings);
    localStorage.setItem(A11Y_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    const root = document.getElementById("root");
    translateTree(root, language);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) translateTextNode(node, language);
          if (node.nodeType === Node.ELEMENT_NODE) translateTree(node, language);
        });
      });
    });
    if (root) observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [language]);

  const toggle = (key) => setSettings((current) => ({ ...current, [key]: !current[key] }));
  const setFilter = (value) => setSettings((current) => ({ ...current, colorFilter: value }));
  const changeFont = (amount) => {
    setSettings((current) => ({
      ...current,
      fontScale: Math.min(1.6, Math.max(0.85, Number((current.fontScale + amount).toFixed(2)))),
    }));
  };
  const reset = () => setSettings(defaultA11y);

  return (
    <>
      <div className="global-tools" data-no-auto-translate="true">
        <button
          type="button"
          className="a11y-floating-button"
          onClick={() => setOpen(true)}
          aria-label={t("openAccessibility")}
          title={t("accessibility")}
        >
          <AccessIcon />
        </button>
      </div>

      {open && (
        <div className="a11y-layer" data-no-auto-translate="true">
          <button className="a11y-scrim" type="button" onClick={() => setOpen(false)} aria-label={a.close} />
          <aside className="a11y-drawer" role="dialog" aria-modal="true" aria-label={a.title}>
            <button type="button" className="a11y-close" onClick={() => setOpen(false)} aria-label={a.close}>
              x
            </button>
            <div className="a11y-title">
              <AccessIcon />
              <h2>{a.title}</h2>
              <p>{a.subtitle}</p>
            </div>

            <section className="a11y-section">
              <div className="a11y-section-title">
                <span>{a.fontSize}</span>
                <IconText />
              </div>
              <div className="a11y-font-control">
                <button type="button" onClick={() => changeFont(0.1)} aria-label="+">+</button>
                <div className="a11y-font-track" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, Math.max(0, ((settings.fontScale - 0.85) / 0.75) * 100))}%` }} />
                </div>
                <button type="button" onClick={() => changeFont(-0.1)} aria-label="-">-</button>
                <b>{Math.round(settings.fontScale * 100)}%</b>
              </div>
            </section>

            <section className="a11y-section">
              <div className="a11y-section-title">
                <span>{a.colorModes}</span>
                <IconPalette />
              </div>
              <Switch label={a.grayscale} active={settings.grayscale} onClick={() => toggle("grayscale")} icon={<IconCircle />} />
              <Switch label={a.invert} active={settings.invert} onClick={() => toggle("invert")} icon={<IconContrast />} />
              <Switch label={a.lowSaturation} active={settings.lowSaturation} onClick={() => toggle("lowSaturation")} icon={<IconSpark />} />
              <div className="a11y-filter-title">{a.colorFilter}</div>
              <div className="a11y-filter-grid">
                {["none", "redGreen", "blueYellow", "red"].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={settings.colorFilter === value ? "active" : ""}
                    onClick={() => setFilter(value)}
                  >
                    {a[value]}
                  </button>
                ))}
              </div>
            </section>

            <section className="a11y-section">
              <div className="a11y-section-title">
                <span>{a.visual}</span>
                <IconEye />
              </div>
              <Switch label={a.contrast} active={settings.contrast} onClick={() => toggle("contrast")} icon={<IconContrast />} />
              <Switch label={a.bigText} active={settings.bigText} onClick={() => toggle("bigText")} icon={<IconText />} />
              <Switch label={a.highlightLinks} active={settings.highlightLinks} onClick={() => toggle("highlightLinks")} icon={<IconPalette />} />
              <Switch label={a.underlineLinks} active={settings.underlineLinks} onClick={() => toggle("underlineLinks")} icon={<IconLink />} />
              <Switch label={a.hideImages} active={settings.hideImages} onClick={() => toggle("hideImages")} icon={<IconEye />} />
            </section>

            <section className="a11y-section">
              <div className="a11y-section-title">
                <span>{a.text}</span>
                <IconDoc />
              </div>
              <Switch label={a.readableFont} active={settings.readableFont} onClick={() => toggle("readableFont")} icon={<IconDoc />} />
              <Switch label={a.lineSpacing} active={settings.lineSpacing} onClick={() => toggle("lineSpacing")} icon={<IconText />} />
              <Switch label={a.letterSpacing} active={settings.letterSpacing} onClick={() => toggle("letterSpacing")} icon={<IconText />} />
              <Switch label={a.alignLeft} active={settings.alignLeft} onClick={() => toggle("alignLeft")} icon={<IconText />} />
            </section>

            <section className="a11y-section">
              <div className="a11y-section-title">
                <span>{a.navigation}</span>
                <IconMouse />
              </div>
              <Switch label={a.bigCursor} active={settings.bigCursor} onClick={() => toggle("bigCursor")} icon={<IconMouse />} />
              <Switch label={a.reduceMotion} active={settings.reduceMotion} onClick={() => toggle("reduceMotion")} icon={<IconMotion />} />
              <Switch label={a.stopAnimations} active={settings.stopAnimations} onClick={() => toggle("stopAnimations")} icon={<IconMotion />} />
            </section>

            <button type="button" className="a11y-reset" onClick={reset}>
              <IconMotion /> {a.reset}
            </button>
          </aside>
        </div>
      )}
    </>
  );
}

export function LanguageSwitcher({ className = "" }) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className={`language-switcher ${className}`} aria-label={t("language")} data-no-auto-translate="true">
      {Object.values(LANGUAGES).map((item) => (
        <button
          key={item.code}
          type="button"
          className={language === item.code ? "active" : ""}
          onClick={() => setLanguage(item.code)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function Switch({ label, active, onClick, icon }) {
  return (
    <button type="button" className={`a11y-switch-row ${active ? "active" : ""}`} onClick={onClick} role="switch" aria-checked={active}>
      <span className="a11y-switch-toggle" aria-hidden="true"><span /></span>
      <span className="a11y-switch-label">{label}</span>
      <span className="a11y-row-icon" aria-hidden="true">{icon}</span>
    </button>
  );
}

function Svg({ children, viewBox = "0 0 24 24" }) {
  return <svg aria-hidden="true" viewBox={viewBox} focusable="false">{children}</svg>;
}

function AccessIcon() {
  return (
    <Svg>
      <circle cx="12" cy="4.5" r="2.2" />
      <path d="M4.8 8.1c4.6-1.5 9.8-1.5 14.4 0 .8.3 1.2 1.1 1 1.9-.3.8-1.1 1.2-1.9 1a20.6 20.6 0 0 0-4.8-.9v3.1l2.7 6.1c.3.8 0 1.7-.8 2-.8.3-1.7 0-2-.8L12 17.2l-1.4 3.3c-.3.8-1.2 1.1-2 .8-.8-.3-1.1-1.2-.8-2l2.7-6.1v-3.1c-1.6.1-3.2.4-4.8.9-.8.2-1.6-.2-1.9-1-.2-.8.2-1.6 1-1.9Z" />
    </Svg>
  );
}

function IconText() {
  return <Svg><path d="M5 5h14v3h-1.5l-.4-1H13v12h2v2H9v-2h2V7H6.9l-.4 1H5V5Z" /></Svg>;
}

function IconPalette() {
  return <Svg><path d="M12 3a9 9 0 0 0 0 18h1.2a2 2 0 0 0 1.4-3.4 1.2 1.2 0 0 1 .8-2h1.1A4.5 4.5 0 0 0 21 11.1C21 6.6 17 3 12 3Zm-4 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm5 1a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" /></Svg>;
}

function IconEye() {
  return <Svg><path d="M12 5c5 0 8.5 4.5 9.5 7-1 2.5-4.5 7-9.5 7s-8.5-4.5-9.5-7C3.5 9.5 7 5 12 5Zm0 3.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Zm0 2a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6Z" /></Svg>;
}

function IconContrast() {
  return <Svg><path d="M12 3a9 9 0 1 0 0 18V3Zm0 2.2v13.6a6.8 6.8 0 0 1 0-13.6Z" /></Svg>;
}

function IconCircle() {
  return <Svg><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2.4" /></Svg>;
}

function IconSpark() {
  return <Svg><path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Zm6 11 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z" /></Svg>;
}

function IconLink() {
  return <Svg><path d="M8.8 13.8a4 4 0 0 1 0-5.7l2-2a4 4 0 0 1 5.7 5.7l-1 1-1.4-1.4 1-1a2 2 0 1 0-2.8-2.8l-2 2a2 2 0 0 0 0 2.8l-1.5 1.4Zm6.4-3.6a4 4 0 0 1 0 5.7l-2 2a4 4 0 0 1-5.7-5.7l1-1 1.4 1.4-1 1a2 2 0 1 0 2.8 2.8l2-2a2 2 0 0 0 0-2.8l1.5-1.4Z" /></Svg>;
}

function IconDoc() {
  return <Svg><path d="M6 3h8l4 4v14H6V3Zm8 1.8V8h3.2L14 4.8ZM8 11h8v2H8v-2Zm0 4h8v2H8v-2Z" /></Svg>;
}

function IconMouse() {
  return <Svg><path d="M12 2a6 6 0 0 0-6 6v8a6 6 0 0 0 12 0V8a6 6 0 0 0-6-6Zm1 8h-2V5.2A3.8 3.8 0 0 1 13 5v5Z" /></Svg>;
}

function IconMotion() {
  return <Svg><path d="M12 5a7 7 0 1 1-6.2 3.8H3.2A9 9 0 1 0 12 3v2ZM4 4v5h5L7.2 7.2A6.8 6.8 0 0 1 12 5V3a8.8 8.8 0 0 0-6.2 2.6L4 4Z" /></Svg>;
}
