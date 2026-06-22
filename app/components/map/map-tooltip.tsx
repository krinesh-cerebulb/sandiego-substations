/**
 * The hovered feature's display data plus its screen-space anchor.
 *
 * This is the *only* hover information that lives in React state — the polygon
 * highlight itself is handled by Mapbox feature-state, not by re-rendering.
 */
export interface TooltipState {
  name: string;
  /** Cursor position in container pixels. */
  x: number;
  y: number;
}

interface MapTooltipProps {
  tooltip: TooltipState | null;
}

/** Lightweight cursor-following tooltip. Renders nothing when not hovering. */
export function MapTooltip({ tooltip }: MapTooltipProps) {
  if (!tooltip) return null;

  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-md border border-border bg-popover px-2.5 py-1.5 text-popover-foreground shadow-md"
      style={{ left: tooltip.x, top: tooltip.y }}
    >
      <div className="text-sm font-medium leading-tight">{tooltip.name}</div>
    </div>
  );
}
