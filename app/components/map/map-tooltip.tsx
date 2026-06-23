import type { Ref } from "react";

interface MapTooltipProps {
  ref?: Ref<HTMLDivElement>;
}

/**
 * Hover tooltip positioned imperatively from `MapView`'s mousemove handler
 * (text via `textContent`, position via `transform`). Keeping it out of React
 * state means cursor tracking triggers zero re-renders — the polygon highlight
 * already lives in Mapbox feature-state.
 */
export function MapTooltip({ ref }: MapTooltipProps) {
  return (
    <div
      ref={ref}
      className="pointer-events-none absolute left-0 top-0 z-10 rounded-md border border-border bg-popover px-2.5 py-1.5 text-sm font-medium leading-tight text-popover-foreground opacity-0 shadow-md will-change-transform"
      style={{ transform: "translate(-9999px, -9999px)" }}
    />
  );
}
