import type { ExpressionSpecification } from "mapbox-gl";

/** Public Mapbox token, injected at build time (see `.env`). */
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

/** Base map style. */
export const MAP_STYLE = "mapbox://styles/mapbox/light-v11";

/** Single source + the layers derived from it. Centralized so every */
/** `addLayer` / `setFeatureState` / `setFilter` call shares one name. */
export const SUBSTATIONS_SOURCE = "substations";
export const SUBSTATIONS_FILL_LAYER = "substations-fill";

/**
 * Feature property promoted to the Mapbox feature `id`.
 *
 * GeoJSON features have no intrinsic `id`, which `setFeatureState` requires.
 * Promoting the stable business key gives us a reliable handle for hover
 * (and, in Phase 2, selection) state.
 */
export const FEATURE_ID_PROPERTY = "FACILITYID";

/** Linear-light sRGB channel → 2-digit gamma-corrected hex, clamped to gamut. */
function channelToHex(linear: number): string {
  const gamma =
    linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
  const value = Math.max(0, Math.min(255, Math.round(gamma * 255)));
  return value.toString(16).padStart(2, "0");
}

/** Parses an `oklch(L C H)` string into `[L, C, H°]` (L accepts `%` or 0–1). */
function parseOklch(value: string): [number, number, number] {
  const match = value
    .trim()
    .match(/oklch\(\s*([\d.]+%?)\s+([-\d.]+)\s+([-\d.]+)/i);
  if (!match) {
    throw new Error(`Could not parse OKLCH value: "${value}"`);
  }
  const lightness = match[1].endsWith("%")
    ? parseFloat(match[1]) / 100
    : parseFloat(match[1]);
  return [lightness, parseFloat(match[2]), parseFloat(match[3])];
}

/**
 * OKLCH → sRGB hex. Pure math: OKLCH → OKLab → linear sRGB → gamma sRGB → hex,
 * clamping any out-of-gamut value into range.
 */
function oklchToHex(L: number, C: number, hDeg: number): string {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  // OKLab → LMS (cube-rooted), then cube back to linear LMS.
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  // LMS → linear sRGB.
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(bl)}`;
}

/**
 * Resolves a chart token (e.g. `"chart-1"` or `"--chart-1"`) to an sRGB hex
 * Mapbox can parse — by reading the token's OKLCH value straight from the
 * stylesheet, so `app.css` stays the single source of truth.
 *
 * Browser-only: `getComputedStyle` needs the DOM, so call it from an effect
 * (at map load), never during SSR or at module-eval time.
 */
export function cssVarToHex(token: string): string {
  const name = token.startsWith("--") ? token : `--${token}`;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (!value) {
    throw new Error(`CSS variable "${name}" is not defined.`);
  }
  return oklchToHex(...parseOklch(value));
}

/**
 * PENETRATION buckets, shared by the fill expression and the legend.
 * `token` references a chart variable in `app.css` — no hardcoded colors.
 */
export const PENETRATION_BUCKETS = [
  { label: "0–20", token: "chart-1", min: 0 },
  { label: "20–40", token: "chart-2", min: 20 },
  { label: "40–60", token: "chart-3", min: 40 },
  { label: "60+", token: "chart-4", min: 60 },
] as const;

/**
 * Builds the `fill-color` `step` expression over PENETRATION, resolving each
 * bucket's chart token to hex from the live stylesheet. Client-only — call at
 * map load (low→high maps to chart-1…4).
 */
export function buildFillColorExpression(): ExpressionSpecification {
  const [first, ...rest] = PENETRATION_BUCKETS;
  const stops = rest.flatMap((bucket) => [
    bucket.min,
    cssVarToHex(bucket.token),
  ]);

  return [
    "step",
    ["get", "PENETRATION"],
    cssVarToHex(first.token),
    ...stops,
  ] as unknown as ExpressionSpecification;
}

/** `fill-opacity` driven by hover feature-state (kept off the React tree). */
export const FILL_OPACITY_EXPRESSION: ExpressionSpecification = [
  "case",
  ["boolean", ["feature-state", "hover"], false],
  0.6,
  0.4,
];
