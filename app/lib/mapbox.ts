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
 * Pastel colors for the numeric metric's discrete classes — one per class,
 * ordered low → high. Not a strict sequential ramp; just distinct soft tones.
 */
export const COLOR_RAMP = [
  "#9ed5b8",
  "#c9b3e4",
  "#f5dd8e",
  "#f2a89a",
  "#a6c4e8",
] as const;

/** Pastel qualitative palette for categorical metrics (cycled if categories exceed it). */
export const CATEGORY_PALETTE = [
  "#efbc8c",
  "#c7d99b",
  "#ccb1db",
  "#f2c5d5",
  "#bfe0d3",
  "#ec988f",
  "#f1e28d",
  "#bcc8e4",
  "#d1d1c9",
  "#ebc8a1",
] as const;

/** Color for values outside the palette or missing entirely. */
const FALLBACK_COLOR = "#9ca3af";

/** A discrete numeric class: its lower bound and color. */
export interface NumericClass {
  min: number;
  color: string;
}

/** Equal-interval classes across the range — one per ramp color, low → high. */
function buildNumericClasses(range: MetricRange | null): NumericClass[] {
  if (!range) return [];
  if (range.max <= range.min) return [{ min: range.min, color: COLOR_RAMP[0] }];

  const span = range.max - range.min;
  return COLOR_RAMP.map((color, i) => ({
    min: range.min + (span * i) / COLOR_RAMP.length,
    color,
  }));
}

/**
 * Resolved coloring for a metric — numeric (a min/max range plus discrete
 * classes) or categorical (each distinct value paired with a palette color).
 * Computed once and shared by both the map fill expression and the legend.
 */
export type ColorScale =
  | { kind: "numeric"; range: MetricRange | null; classes: NumericClass[] }
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
  const range = computeMetricRange(collection, metric);
  return { kind: "numeric", range, classes: buildNumericClasses(range) };
}

/**
 * Builds the `fill-color` expression for the active metric:
 *  - numeric → `step` into discrete classes (a classic choropleth),
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

  const { classes } = scale;
  if (classes.length === 0) return COLOR_RAMP[0];
  if (classes.length === 1) return classes[0].color;

  // step: first color applies below the second class's lower bound, then each
  // subsequent [bound, color] pair opens the next class.
  const [first, ...rest] = classes;
  const stops = rest.flatMap((c) => [c.min, c.color]);
  return [
    "step",
    ["to-number", ["get", metric]],
    first.color,
    ...stops,
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
