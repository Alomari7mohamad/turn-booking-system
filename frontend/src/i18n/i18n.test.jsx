import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { useState } from "react";
import i18n, { LANGUAGE_STORAGE_KEY, LANGUAGES } from "./index.js";
import { LanguageProvider, useLanguage } from "../context/LanguageContext.jsx";
import ar from "./resources/ar.js";
import en from "./resources/en.js";
import he from "./resources/he.js";
import extra from "./resources/extra.js";

function flatKeys(obj, prefix = "") {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? flatKeys(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  );
}

async function setLang(lng) {
  await act(async () => {
    await i18n.changeLanguage(lng);
  });
}

afterEach(async () => {
  await setLang("ar");
});

describe("i18n resources", () => {
  it("has identical key sets across all three languages", () => {
    const arKeys = Object.keys(ar).sort();
    expect(Object.keys(en).sort()).toEqual(arKeys);
    expect(Object.keys(he).sort()).toEqual(arKeys);
  });

  it("never contains empty or undefined values", () => {
    for (const [k, v] of Object.entries(ar)) if (typeof v === "string") expect(v, `ar.${k}`).toBeTruthy();
    for (const [k, v] of Object.entries(en)) if (typeof v === "string") expect(v, `en.${k}`).toBeTruthy();
    for (const [k, v] of Object.entries(he)) if (typeof v === "string") expect(v, `he.${k}`).toBeTruthy();
  });

  it("keeps per-page (extra.js) namespaces aligned across languages", () => {
    const arKeys = flatKeys(extra.ar).sort();
    expect(flatKeys(extra.en).sort()).toEqual(arKeys);
    expect(flatKeys(extra.he).sort()).toEqual(arKeys);
  });
});

describe("language engine", () => {
  it("defaults to Arabic when no preference is stored", () => {
    // localStorage starts empty in jsdom, so the detector falls back to 'ar'.
    expect(i18n.resolvedLanguage).toBe("ar");
    expect(i18n.t("save")).toBe("حفظ");
  });

  it("switches translations across ar / en / he", async () => {
    expect(i18n.t("save")).toBe("حفظ");
    await setLang("en");
    expect(i18n.t("save")).toBe("Save");
    await setLang("he");
    expect(i18n.t("save")).toBe("שמירה");
  });

  it("maps text direction correctly and updates the document", async () => {
    await setLang("ar");
    expect(LANGUAGES.ar.dir).toBe("rtl");
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("ar");

    await setLang("en");
    expect(LANGUAGES.en.dir).toBe("ltr");
    expect(document.documentElement.dir).toBe("ltr");
    expect(document.documentElement.lang).toBe("en");

    await setLang("he");
    expect(LANGUAGES.he.dir).toBe("rtl");
    expect(document.documentElement.dir).toBe("rtl");
  });

  it("persists the selected language to localStorage", async () => {
    await setLang("he");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("he");
    await setLang("en");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
  });

  it("falls back to Arabic for a key missing in another language", async () => {
    // Add a key only to Arabic; Hebrew/English must fall back to it.
    i18n.addResource("ar", "translation", "__fallbackProbe", "قيمة عربية");
    const tHe = i18n.getFixedT("he");
    const tEn = i18n.getFixedT("en");
    expect(tHe("__fallbackProbe")).toBe("قيمة عربية");
    expect(tEn("__fallbackProbe")).toBe("قيمة عربية");
  });

  it("never renders a raw undefined value; unknown keys return the key", () => {
    expect(i18n.t("__definitely_missing_key__")).toBe("__definitely_missing_key__");
  });

  it("supports interpolation", () => {
    i18n.addResource("ar", "translation", "__greeting", "أهلاً {{name}}");
    expect(i18n.t("__greeting", { name: "سارة" })).toBe("أهلاً سارة");
  });
});

function StatefulProbe() {
  const [count, setCount] = useState(0);
  const { t, setLanguage, language } = useLanguage();
  return (
    <div>
      <span data-testid="lang">{language}</span>
      <span data-testid="label">{t("save")}</span>
      <span data-testid="count">{count}</span>
      <button data-testid="inc" onClick={() => setCount((c) => c + 1)}>inc</button>
      <button data-testid="to-en" onClick={() => setLanguage("en")}>en</button>
      <button data-testid="to-he" onClick={() => setLanguage("he")}>he</button>
    </div>
  );
}

describe("React integration", () => {
  beforeEach(async () => {
    await setLang("ar");
  });

  it("re-renders all consumers immediately on language change (no reload)", async () => {
    render(
      <LanguageProvider>
        <StatefulProbe />
      </LanguageProvider>
    );
    expect(screen.getByTestId("label").textContent).toBe("حفظ");
    await act(async () => fireEvent.click(screen.getByTestId("to-en")));
    expect(screen.getByTestId("label").textContent).toBe("Save");
    expect(screen.getByTestId("lang").textContent).toBe("en");
  });

  it("preserves component state while switching languages", async () => {
    render(
      <LanguageProvider>
        <StatefulProbe />
      </LanguageProvider>
    );
    // Build up some local state.
    await act(async () => {
      fireEvent.click(screen.getByTestId("inc"));
      fireEvent.click(screen.getByTestId("inc"));
    });
    expect(screen.getByTestId("count").textContent).toBe("2");

    // Switch language twice; the counter (application state) must survive.
    await act(async () => fireEvent.click(screen.getByTestId("to-en")));
    await act(async () => fireEvent.click(screen.getByTestId("to-he")));

    expect(screen.getByTestId("count").textContent).toBe("2");
    expect(screen.getByTestId("label").textContent).toBe("שמירה");
  });
});
