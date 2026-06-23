import type { ExpressionSpecification, FilterSpecification } from "mapbox-gl";

import {
  ENUM_VALUE_SEPARATOR,
  FILTER_ATTRIBUTES,
  type Filter,
} from "./filters";
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

/** Base map style — Mapbox Standard (natural 3D basemap). */
export const MAP_STYLE = "mapbox://styles/mapbox/standard";

/**
 * Slot for inserting our layers in the Standard style: above the basemap and
 * terrain, below labels/POIs. Ignored by classic styles.
 */
export const FILL_SLOT = "middle";

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
 * Continuous low→high ramp (green → amber → red) for numeric metrics. Muted on
 * purpose: fills render near-solid (see `FILL_OPACITY_EXPRESSION`), so the color
 * itself — not transparency — keeps them easy on the eyes. Shared by the fill
 * expression and the legend gradient so they can't drift.
 */
export const COLOR_RAMP = ["#63a87e", "#e0bd5f", "#d97b6e"] as const;

/** Soft qualitative palette for categorical metrics (cycled if categories exceed it). */
export const CATEGORY_PALETTE = [
  "#6c9bd2",
  "#67b08a",
  "#e6a366",
  "#d98ab4",
  "#a596d6",
  "#5cb5c4",
  "#d9b95e",
  "#dd8676",
  "#8c9cd9",
  "#9bbd6e",
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
 * Translates the filter list into a single Mapbox layer filter (AND of every
 * clause). Returns `null` when there are no filters, which clears `setFilter`.
 * Applied with `setFilter` so non-matching polygons stop rendering — no GeoJSON
 * reload, and `fill-color` / feature-state are untouched.
 */
export function buildFilterExpression(
  filters: Filter[],
): FilterSpecification | null {
  const clauses = filters
    .map(filterClause)
    .filter((clause): clause is unknown[] => clause !== null);
  if (clauses.length === 0) return null;
  return ["all", ...clauses] as unknown as FilterSpecification;
}

/** Translates one editable row to a Mapbox clause, or `null` if incomplete. */
function filterClause(filter: Filter): unknown[] | null {
  const type = FILTER_ATTRIBUTES[filter.attribute].type;

  if (type === "enum") {
    // Multi-select: any of (OR) the chosen values, or none of them.
    const values = filter.value
      .split(ENUM_VALUE_SEPARATOR)
      .map((v) => v.trim())
      .filter(Boolean);
    if (values.length === 0) return null;

    const membership = [
      "in",
      ["to-string", ["get", filter.attribute]],
      ["literal", values],
    ];
    return filter.operator === "notIn" ? ["!", membership] : membership;
  }

  if (type === "text") {
    const value = filter.value.trim();
    if (!value) return null;
    // Case-insensitive: downcase the field and compare to a lowered needle.
    const field = ["downcase", ["to-string", ["get", filter.attribute]]];
    const needle = value.toLowerCase();
    if (filter.operator === "contains") return ["in", needle, field];
    if (filter.operator === "startsWith") {
      return ["==", ["index-of", needle, field], 0];
    }
    return ["==", field, needle]; // equals
  }

  if (filter.value.trim() === "") return null;
  const value = Number(filter.value);
  if (!Number.isFinite(value)) return null;

  // Numeric: guard with `has` so features missing the property don't match.
  const field = ["to-number", ["get", filter.attribute]];
  const guard = ["has", filter.attribute];
  switch (filter.operator) {
    case "gt":
      return ["all", guard, [">", field, value]];
    case "lt":
      return ["all", guard, ["<", field, value]];
    case "gte":
      return ["all", guard, [">=", field, value]];
    case "lte":
      return ["all", guard, ["<=", field, value]];
    case "between": {
      if (filter.upper.trim() === "") return null;
      const upper = Number(filter.upper);
      if (!Number.isFinite(upper)) return null;
      return ["all", guard, [">=", field, value], ["<=", field, upper]];
    }
    case "equals":
    default:
      return ["all", guard, ["==", field, value]];
  }
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
  1,
  0.85,
];
