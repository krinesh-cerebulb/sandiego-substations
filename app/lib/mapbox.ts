import type { ExpressionSpecification } from "mapbox-gl";

import {
  computeCategories,
  computeMetricRange,
  METRICS,
  type MetricKey,
  type MetricRange,
} from "./metrics";
import type { SubstationCollection } from "~/types/substation";

/** Public Mapbox token, injected at build time (see `.env`). */
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

/** Base map style. */
export const MAP_STYLE = "mapbox://styles/mapbox/light-v11";

/** Single source + the layer derived from it. Centralized so every */
/** `addLayer` / `setFeatureState` / `setPaintProperty` shares one name. */
export const SUBSTATIONS_SOURCE = "substations";
export const SUBSTATIONS_FILL_LAYER = "substations-fill";

/**
 * Feature property promoted to the Mapbox feature `id`.
 *
 * GeoJSON features have no intrinsic `id`, which `setFeatureState` requires.
 * Promoting the stable business key gives hover and selection a reliable handle.
 */
export const FEATURE_ID_PROPERTY = "FACILITYID";

/**
 * Continuous low→high color ramp (green → yellow → red) for numeric metrics.
 * Shared by the fill expression and the legend gradient so they can't drift.
 */
export const COLOR_RAMP = ["#22c55e", "#eab308", "#ef4444"] as const;

/** Qualitative palette for categorical metrics (cycled if categories exceed it). */
export const CATEGORY_PALETTE = [
  "#2563eb",
  "#16a34a",
  "#f97316",
  "#db2777",
  "#9333ea",
  "#0891b2",
  "#ca8a04",
  "#dc2626",
  "#4f46e5",
  "#65a30d",
] as const;

/** Color for values outside the palette or missing entirely. */
const FALLBACK_COLOR = "#9ca3af";

/**
 * Resolved coloring for a metric — numeric (a min/max range) or categorical
 * (each distinct value paired with a palette color). Computed once and shared
 * by both the map fill expression and the legend so they always match.
 */
export type ColorScale =
  | { kind: "numeric"; range: MetricRange | null }
  | { kind: "categorical"; entries: Array<{ value: string; color: string }> };

/** Builds the color scale for `metric` from the dataset. */
export function computeColorScale(
  collection: SubstationCollection,
  metric: MetricKey,
): ColorScale {
  if (METRICS[metric].kind === "categorical") {
    const entries = computeCategories(collection, metric).map((value, i) => ({
      value,
      color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
    }));
    return { kind: "categorical", entries };
  }
  return { kind: "numeric", range: computeMetricRange(collection, metric) };
}

/**
 * Builds the `fill-color` expression for the active metric:
 *  - numeric → `interpolate` across the [min, mid, max] ramp,
 *  - categorical → `match` each value to its palette color.
 * Returns a flat color when there's nothing to scale.
 */
export function buildColorExpression(
  metric: string,
  scale: ColorScale,
): ExpressionSpecification | string {
  if (scale.kind === "categorical") {
    if (scale.entries.length === 0) return FALLBACK_COLOR;
    const pairs = scale.entries.flatMap((entry) => [entry.value, entry.color]);
    return [
      "match",
      ["get", metric],
      ...pairs,
      FALLBACK_COLOR,
    ] as unknown as ExpressionSpecification;
  }

  const { range } = scale;
  if (!range || range.max <= range.min) return COLOR_RAMP[0];

  const mid = (range.min + range.max) / 2;
  return [
    "interpolate",
    ["linear"],
    ["to-number", ["get", metric]],
    range.min,
    COLOR_RAMP[0],
    mid,
    COLOR_RAMP[1],
    range.max,
    COLOR_RAMP[2],
  ] as unknown as ExpressionSpecification;
}

/**
 * `fill-opacity` driven by feature-state: selected polygons read strongest,
 * then hovered, then the resting state. Both flags stay off the React tree.
 */
export const FILL_OPACITY_EXPRESSION: ExpressionSpecification = [
  "case",
  ["boolean", ["feature-state", "selected"], false],
  1,
  ["boolean", ["feature-state", "hover"], false],
  0.8,
  0.6,
];
