import { PENETRATION_BUCKETS } from "~/lib/mapbox";

/** Static legend mapping PENETRATION buckets to their polygon colors. */
export function MapLegend() {
  return (
    <div className="absolute bottom-6 left-6 z-10 rounded-lg border border-border bg-card/90 p-3 shadow-md backdrop-blur">
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
}
