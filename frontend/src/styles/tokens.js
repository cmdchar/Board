const DARK_THEME = {
  bg0: "#050911",
  bg1: "#0a1020",
  bg2: "#0f1929",
  bg3: "#162032",
  bg4: "#1c2a3e",
  b0: "#1a2a3c",
  b1: "#223146",
  b2: "#2a3d54",
  t0: "#f0f6ff",
  t1: "#8ba4be",
  t2: "#4a6278",
  t3: "#2a3d52",
  y: "#facc15",
  yDim: "#713f12",
  yBg: "rgba(250,204,21,.09)",
  blue: "#3b82f6",
  green: "#22c55e",
  red: "#ef4444",
  purple: "#a78bfa",
  teal: "#2dd4bf",
  primary: "#3b82f6",
  primaryDim: "#1d4ed8",
  primaryBg: "rgba(59,130,246,.14)",
};

const LIGHT_THEME = {
  bg0: "#f6f8fc",
  bg1: "#ffffff",
  bg2: "#f3f6fb",
  bg3: "#eaf0f8",
  bg4: "#dee7f3",
  b0: "#d8e1ef",
  b1: "#c7d3e4",
  b2: "#b5c5dc",
  t0: "#0f172a",
  t1: "#334155",
  t2: "#64748b",
  t3: "#94a3b8",
  y: "#eab308",
  yDim: "#a16207",
  yBg: "rgba(234,179,8,.16)",
  blue: "#2563eb",
  green: "#16a34a",
  red: "#dc2626",
  purple: "#7c3aed",
  teal: "#0f766e",
  primary: "#2563eb",
  primaryDim: "#1d4ed8",
  primaryBg: "rgba(37,99,235,.12)",
};

export const SPACING_SCALE = Object.freeze({
  4: 4,
  8: 8,
  12: 12,
  16: 16,
  24: 24,
  32: 32,
});

export const RADIUS_SCALE = Object.freeze({
  6: 6,
  10: 10,
  16: 16,
});

export const MOTION_TOKENS = Object.freeze({
  fast: "120ms",
  medium: "180ms",
  slow: "260ms",
  easeOut: "cubic-bezier(0.22,1,0.36,1)",
  easeSpring: "cubic-bezier(0.2,0.9,0.25,1.25)",
  // Backward-compatible aliases used by existing UI transitions.
  normal: "180ms",
  panel: "180ms",
  easing: "cubic-bezier(0.22,1,0.36,1)",
});

export const UI_THEME_STORAGE_KEY = "boardai_theme_mode";
export const UI_THEME_PALETTES = {
  dark: DARK_THEME,
  light: LIGHT_THEME,
};

export function normalizeUiTheme(mode) {
  return mode === "light" ? "light" : "dark";
}

export function getStoredUiTheme() {
  try {
    const raw = localStorage.getItem(UI_THEME_STORAGE_KEY);
    if (!raw) return "dark";
    return normalizeUiTheme(raw);
  } catch {
    return "dark";
  }
}

export function applyUiTheme(mode) {
  const nextMode = normalizeUiTheme(mode);
  const palette = UI_THEME_PALETTES[nextMode] || UI_THEME_PALETTES.dark;
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    Object.entries(palette).forEach(([k, v]) => {
      root.style.setProperty(`--ui-${k}`, v);
    });
    root.style.setProperty("--ui-color-background", palette.bg0);
    root.style.setProperty("--ui-color-surface", palette.bg1);
    root.style.setProperty("--ui-color-primary", palette.primary || palette.blue);
    root.style.setProperty("--ui-color-text", palette.t0);
    root.style.setProperty("--ui-color-border", palette.b1);
    root.style.setProperty("--ui-space-4", `${SPACING_SCALE[4]}px`);
    root.style.setProperty("--ui-space-8", `${SPACING_SCALE[8]}px`);
    root.style.setProperty("--ui-space-12", `${SPACING_SCALE[12]}px`);
    root.style.setProperty("--ui-space-16", `${SPACING_SCALE[16]}px`);
    root.style.setProperty("--ui-space-24", `${SPACING_SCALE[24]}px`);
    root.style.setProperty("--ui-space-32", `${SPACING_SCALE[32]}px`);
    root.style.setProperty("--ui-radius-6", `${RADIUS_SCALE[6]}px`);
    root.style.setProperty("--ui-radius-10", `${RADIUS_SCALE[10]}px`);
    root.style.setProperty("--ui-radius-16", `${RADIUS_SCALE[16]}px`);
    root.style.setProperty("--ui-motion-fast", MOTION_TOKENS.fast);
    root.style.setProperty("--ui-motion-medium", MOTION_TOKENS.medium);
    root.style.setProperty("--ui-motion-slow", MOTION_TOKENS.slow);
    root.style.setProperty("--ui-ease-out", MOTION_TOKENS.easeOut);
    root.style.setProperty("--ui-ease-spring", MOTION_TOKENS.easeSpring);
    // Backward-compatible aliases.
    root.style.setProperty("--ui-motion-normal", MOTION_TOKENS.medium);
    root.style.setProperty("--ui-motion-panel", MOTION_TOKENS.medium);
    root.style.setProperty("--ui-ease-standard", MOTION_TOKENS.easeOut);
    root.style.setProperty("--ui-shadow-sm", "0 8px 24px rgba(0,0,0,.18)");
    root.style.setProperty("--ui-shadow-md", "0 14px 36px rgba(0,0,0,.24)");
    root.style.setProperty("--ui-shadow-lg", "0 22px 58px rgba(0,0,0,.34)");
    root.style.colorScheme = nextMode;
    root.dataset.uiTheme = nextMode;
  }
  try {
    localStorage.setItem(UI_THEME_STORAGE_KEY, nextMode);
  } catch {
    // ignore storage errors
  }
  return nextMode;
}

export const UI_TOKENS = {
  bg0: `var(--ui-bg0, ${DARK_THEME.bg0})`,
  bg1: `var(--ui-bg1, ${DARK_THEME.bg1})`,
  bg2: `var(--ui-bg2, ${DARK_THEME.bg2})`,
  bg3: `var(--ui-bg3, ${DARK_THEME.bg3})`,
  bg4: `var(--ui-bg4, ${DARK_THEME.bg4})`,
  b0: `var(--ui-b0, ${DARK_THEME.b0})`,
  b1: `var(--ui-b1, ${DARK_THEME.b1})`,
  b2: `var(--ui-b2, ${DARK_THEME.b2})`,
  t0: `var(--ui-t0, ${DARK_THEME.t0})`,
  t1: `var(--ui-t1, ${DARK_THEME.t1})`,
  t2: `var(--ui-t2, ${DARK_THEME.t2})`,
  t3: `var(--ui-t3, ${DARK_THEME.t3})`,
  y: `var(--ui-y, ${DARK_THEME.y})`,
  yDim: `var(--ui-yDim, ${DARK_THEME.yDim})`,
  yBg: `var(--ui-yBg, ${DARK_THEME.yBg})`,
  blue: `var(--ui-blue, ${DARK_THEME.blue})`,
  green: `var(--ui-green, ${DARK_THEME.green})`,
  red: `var(--ui-red, ${DARK_THEME.red})`,
  purple: `var(--ui-purple, ${DARK_THEME.purple})`,
  teal: `var(--ui-teal, ${DARK_THEME.teal})`,
  primary: `var(--ui-primary, ${DARK_THEME.primary})`,
  primaryDim: `var(--ui-primaryDim, ${DARK_THEME.primaryDim})`,
  primaryBg: `var(--ui-primaryBg, ${DARK_THEME.primaryBg})`,

  background: `var(--ui-bg0, ${DARK_THEME.bg0})`,
  surface: `var(--ui-bg1, ${DARK_THEME.bg1})`,
  surfaceElevated: `var(--ui-bg2, ${DARK_THEME.bg2})`,
  surfaceHover: `var(--ui-bg3, ${DARK_THEME.bg3})`,
  border: `var(--ui-b1, ${DARK_THEME.b1})`,
  borderStrong: `var(--ui-b2, ${DARK_THEME.b2})`,
  text: `var(--ui-t0, ${DARK_THEME.t0})`,
  textMuted: `var(--ui-t1, ${DARK_THEME.t1})`,
  textSoft: `var(--ui-t2, ${DARK_THEME.t2})`,
  accent: `var(--ui-y, ${DARK_THEME.y})`,
  accentHover: `var(--ui-y, ${DARK_THEME.y})`,
  accentSoft: `var(--ui-yBg, ${DARK_THEME.yBg})`,
  accentBorder: `var(--ui-yDim, ${DARK_THEME.yDim})`,
  danger: `var(--ui-red, ${DARK_THEME.red})`,
  disabled: `var(--ui-t3, ${DARK_THEME.t3})`,
};

export const DESIGN_TOKENS = {
  color: {
    background: `var(--ui-color-background, ${DARK_THEME.bg0})`,
    surface: `var(--ui-color-surface, ${DARK_THEME.bg1})`,
    primary: `var(--ui-color-primary, ${DARK_THEME.primary})`,
    text: `var(--ui-color-text, ${DARK_THEME.t0})`,
    border: `var(--ui-color-border, ${DARK_THEME.b1})`,
  },
  spacing: SPACING_SCALE,
  radius: RADIUS_SCALE,
  motion: MOTION_TOKENS,
};

export const TOOL_PANEL_TOKENS = {
  surface: UI_TOKENS.bg1,
  surface2: UI_TOKENS.bg2,
  border: UI_TOKENS.b1,
  borderStrong: UI_TOKENS.b2,
  text: UI_TOKENS.t0,
  textMuted: UI_TOKENS.t1,
  primary: UI_TOKENS.primary,
  primarySoft: UI_TOKENS.primaryBg,
  hover: UI_TOKENS.bg3,
  danger: UI_TOKENS.red,
  shortcutBg: UI_TOKENS.bg3,
  shortcutBorder: UI_TOKENS.b1,
};
