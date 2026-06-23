import { memo } from "react";
import { ListFilter } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { type ColorScale, type NumericClass } from "~/lib/mapbox";
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
  /** Opens/closes the filters panel (icon lives in this card's corner). */
  onToggleFilters: () => void;
  /** Whether any filter is applied — shows a dot on the filter icon. */
  filtersActive: boolean;
  /** When true, shift right by the panel width so the panel doesn't cover it. */
  shifted?: boolean;
}

/**
 * Map legend + thematic control: picks the coloring metric, explains the color
 * scale, and hosts the filters toggle in its corner. Memoized so hover-driven
 * `MapView` re-renders don't reconcile it.
 */
export const MapLegend = memo(function MapLegend({
  metric,
  scale,
  onMetricChange,
  onToggleFilters,
  filtersActive,
  shifted = false,
}: MapLegendProps) {
  return (
    <Card
      size="sm"
      className={cn(
        "absolute bottom-10 left-6 z-10 w-56 gap-2 bg-card/90 shadow-md backdrop-blur transition-transform duration-300 ease-out",
        shifted && "sm:translate-x-96",
      )}
    >
      <CardHeader>
        <CardTitle className="text-sm">Legend</CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="icon"
            className="relative size-6"
            onClick={onToggleFilters}
            aria-label="Filters"
          >
            <ListFilter className="size-3" />
            {filtersActive && (
              <span className="absolute right-1 top-1 size-1.5 rounded-full bg-primary" />
            )}
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-3">
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

        {scale.kind === "numeric" ? (
          <NumericScale
            metric={metric}
            range={scale.range}
            classes={scale.classes}
          />
        ) : (
          <CategoricalScale entries={scale.entries} />
        )}
      </CardContent>
    </Card>
  );
});

/** Discrete numeric classes — a swatch + value range per class. */
function NumericScale({
  metric,
  range,
  classes,
}: {
  metric: MetricKey;
  range: MetricRange | null;
  classes: NumericClass[];
}) {
  if (!range || classes.length === 0) {
    return <p className="text-xs text-muted-foreground">No data</p>;
  }

  return (
    <ul className="space-y-1">
      {classes.map((cls, i) => {
        const upper = i < classes.length - 1 ? classes[i + 1].min : range.max;
        return (
          <li key={cls.min} className="flex items-center gap-2 text-sm">
            <span
              className="size-3.5 shrink-0 rounded-sm border border-black/10"
              style={{ backgroundColor: cls.color }}
            />
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {formatMetricValue(cls.min, metric, true)} –{" "}
              {formatMetricValue(upper, metric, true)}
            </span>
          </li>
        );
      })}
    </ul>
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
