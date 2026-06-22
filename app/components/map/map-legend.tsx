import { memo } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { COLOR_RAMP, type ColorScale } from "~/lib/mapbox";
import {
  formatMetricValue,
  METRIC_KEYS,
  METRICS,
  type MetricKey,
  type MetricRange,
} from "~/lib/metrics";
import { cn } from "~/lib/utils";

interface MapLegendProps {
  /** Active thematic metric. */
  metric: MetricKey;
  /** Resolved color scale for the active metric. */
  scale: ColorScale;
  onMetricChange: (metric: MetricKey) => void;
  /** When true, shift right by the panel width so the panel doesn't cover it. */
  shifted?: boolean;
}

/**
 * Combined legend + thematic control: selects the coloring metric and explains
 * the current color scale (gradient for numeric, swatches for categorical).
 * Memoized so hover-driven `MapView` re-renders don't reconcile it.
 */
export const MapLegend = memo(function MapLegend({
  metric,
  scale,
  onMetricChange,
  shifted = false,
}: MapLegendProps) {
  return (
    <div
      className={cn(
        "absolute bottom-6 left-6 z-10 w-56 rounded-lg border border-border bg-card/90 p-3 shadow-md backdrop-blur transition-transform duration-300 ease-out",
        shifted && "sm:translate-x-96",
      )}
    >
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Color by
      </span>
      <Select
        value={metric}
        onValueChange={(value) => onMetricChange(value as MetricKey)}
      >
        <SelectTrigger
          className="w-full"
          size="sm"
          aria-label="Color by metric"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          {METRIC_KEYS.map((key) => (
            <SelectItem key={key} value={key}>
              {METRICS[key].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="mt-3">
        {scale.kind === "numeric" ? (
          <NumericScale metric={metric} range={scale.range} />
        ) : (
          <CategoricalScale entries={scale.entries} />
        )}
      </div>
    </div>
  );
});

/** Continuous gradient with min / mid / max value labels. */
function NumericScale({
  metric,
  range,
}: {
  metric: MetricKey;
  range: MetricRange | null;
}) {
  const gradient = `linear-gradient(to right, ${COLOR_RAMP.join(", ")})`;
  const mid = range ? (range.min + range.max) / 2 : null;

  return (
    <>
      <div
        className="h-2 w-full rounded-full"
        style={{ background: gradient }}
      />
      <div className="mt-1 flex justify-between gap-1 font-mono text-[11px] tabular-nums text-muted-foreground">
        <span>{range ? formatMetricValue(range.min, metric, true) : "—"}</span>
        <span>{mid !== null ? formatMetricValue(mid, metric, true) : "—"}</span>
        <span>{range ? formatMetricValue(range.max, metric, true) : "—"}</span>
      </div>
    </>
  );
}

/** Discrete swatches, one per distinct category value. */
function CategoricalScale({
  entries,
}: {
  entries: Array<{ value: string; color: string }>;
}) {
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">No values</p>;
  }

  return (
    <ul className="max-h-40 space-y-1 overflow-y-auto pr-1">
      {entries.map((entry) => (
        <li key={entry.value} className="flex items-center gap-2 text-sm">
          <span
            className="size-3.5 shrink-0 rounded-sm border border-black/10"
            style={{ backgroundColor: entry.color }}
          />
          <span className="truncate">{entry.value}</span>
        </li>
      ))}
    </ul>
  );
}
