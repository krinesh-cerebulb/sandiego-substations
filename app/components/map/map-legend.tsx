import { memo } from "react";

import { PENETRATION_BUCKETS } from "~/lib/mapbox";
import { cn } from "~/lib/utils";

interface MapLegendProps {
  /** When true, shift right by the panel width so the panel doesn't cover it. */
  shifted?: boolean;
}

/**
 * Static legend mapping PENETRATION buckets to their polygon colors.
 * Memoized so hover-driven `MapView` re-renders don't reconcile it.
 */
export const MapLegend = memo(function MapLegend({
  shifted = false,
}: MapLegendProps) {
  return (
    <div
      className={cn(
        "absolute bottom-6 left-6 z-10 rounded-lg border border-border bg-card/90 p-3 shadow-md backdrop-blur transition-transform duration-300 ease-out",
        shifted && "sm:translate-x-96",
      )}
    >
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Penetration
      </div>
      <ul className="space-y-1">
        {PENETRATION_BUCKETS.map((bucket) => (
          <li key={bucket.label} className="flex items-center gap-2 text-sm">
            <span
              className="h-3.5 w-3.5 rounded-sm border border-black/10"
              style={{ backgroundColor: `var(--${bucket.token})` }}
            />
            {bucket.label}
          </li>
        ))}
      </ul>
    </div>
  );
});
