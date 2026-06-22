import { formatNumber } from "./format";
import type { SubstationCollection } from "~/types/substation";

export interface MetricConfig {
  label: string;
  /** Unit suffix; `""` for unitless. `"%"` renders with no space, others spaced. */
  unit: string;
  /** `numeric` → continuous gradient; `categorical` → discrete swatches. */
  kind: "numeric" | "categorical";
}

/**
 * Single source of truth for the color-able metrics. Keys are GeoJSON property
 * names; free-text categorical fields (NAME, DISTRICT, …) are excluded, but
 * low-cardinality ones like SUBSTATIONTYPE are included as `categorical`.
 * Reused by the legend now and by search / filters / charts later. Insertion
 * order drives the "Color by" dropdown order.
 */
export const METRICS = {
  PENETRATION: { label: "Penetration", unit: "%", kind: "numeric" },
  EXIST_GEN: { label: "Existing Generation", unit: "MW", kind: "numeric" },
  QUE_GEN: { label: "Queued Generation", unit: "MW", kind: "numeric" },
  TOT_GEN: { label: "Total Generation", unit: "MW", kind: "numeric" },
  PROJ_LOAD: { label: "Projected Load", unit: "MW", kind: "numeric" },
  Shape__Area: { label: "Shape Area", unit: "", kind: "numeric" },
  Shape__Length: { label: "Shape Length", unit: "", kind: "numeric" },
  SUBSTATIONTYPE: { label: "Substation Type", unit: "", kind: "categorical" },
} as const satisfies Record<string, MetricConfig>;

export type MetricKey = keyof typeof METRICS;

export const METRIC_KEYS = Object.keys(METRICS) as MetricKey[];

export interface MetricRange {
  min: number;
  max: number;
}

/** Min/max of a metric across all features; `null` if no finite values exist. */
export function computeMetricRange(
  collection: SubstationCollection,
  metric: MetricKey,
): MetricRange | null {
  let min = Infinity;
  let max = -Infinity;

  for (const feature of collection.features) {
    const value = feature.properties[metric];
    if (typeof value === "number" && Number.isFinite(value)) {
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }

  return Number.isFinite(min) ? { min, max } : null;
}

/** Distinct non-empty values of a categorical metric, sorted for stable order. */
export function computeCategories(
  collection: SubstationCollection,
  metric: MetricKey,
): string[] {
  const values = new Set<string>();
  for (const feature of collection.features) {
    const value = feature.properties[metric];
    if (value != null && value !== "") values.add(String(value));
  }
  return [...values].sort();
}

/**
 * Formats a metric value with its unit, e.g. `33%`, `96.63 MW`. Pass
 * `compact` for legend-friendly abbreviations (`997M`, `47.5 MW`).
 */
export function formatMetricValue(
  value: number,
  metric: MetricKey,
  compact = false,
): string {
  const { unit } = METRICS[metric];
  const formatted = compact
    ? value.toLocaleString(undefined, {
        notation: "compact",
        maximumFractionDigits: 1,
      })
    : formatNumber(value);

  if (!unit) return formatted;
  return unit === "%" ? `${formatted}%` : `${formatted} ${unit}`;
}
