const DEFAULTS = {
  primary: "#064e3b",
  primaryHover: "#022c22",
  primarySoft: "#dcfce7",
  primarySoft2: "#bbf7d0",
};

function hexToRgb(hex) {
  const clean = String(hex || "").replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("")}`;
}

function mix(hex, target, amount) {
  const rgb = hexToRgb(hex);
  const targetRgb = hexToRgb(target);
  if (!rgb || !targetRgb) return hex;
  return rgbToHex({
    r: rgb.r + (targetRgb.r - rgb.r) * amount,
    g: rgb.g + (targetRgb.g - rgb.g) * amount,
    b: rgb.b + (targetRgb.b - rgb.b) * amount,
  });
}

export function applyBrandTheme(color) {
  const primary = hexToRgb(color) ? color : DEFAULTS.primary;
  const root = document.documentElement;
  const vars = buildBrandThemeVars(primary);
  Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
}

export function resetBrandTheme() {
  const root = document.documentElement;
  root.style.setProperty("--primary", DEFAULTS.primary);
  root.style.setProperty("--primary-hover", DEFAULTS.primaryHover);
  root.style.setProperty("--primary-soft", DEFAULTS.primarySoft);
  root.style.setProperty("--primary-soft-2", DEFAULTS.primarySoft2);
  root.style.setProperty("--gradient", "linear-gradient(135deg, #022c22 0%, #064e3b 58%, #0f766e 100%)");
}

export function buildBrandThemeVars(color) {
  const primary = hexToRgb(color) ? color : DEFAULTS.primary;
  return {
    "--primary": primary,
    "--primary-hover": mix(primary, "#000000", 0.28),
    "--primary-soft": mix(primary, "#ffffff", 0.86),
    "--primary-soft-2": mix(primary, "#ffffff", 0.72),
    "--gradient": `linear-gradient(135deg, ${mix(primary, "#000000", 0.32)} 0%, ${primary} 58%, ${mix(primary, "#ffffff", 0.18)} 100%)`,
  };
}
