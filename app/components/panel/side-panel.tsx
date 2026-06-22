import { useEffect, useState } from "react";

import { cn } from "~/lib/utils";
import type { SubstationFeature } from "~/types/substation";
import { SubstationDetails } from "./substation-details";

interface SidePanelProps {
  /** The selected feature, or `null` when nothing is selected. */
  substation: SubstationFeature | null;
  onClose: () => void;
}

/**
 * Left-hand detail panel, overlaid on the map.
 *
 * Slides in when a substation is selected and slides out when cleared, on all
 * breakpoints. The last selection is kept rendered during the slide-out so the
 * panel doesn't blank mid-animation.
 */
export function SidePanel({ substation, onClose }: SidePanelProps) {
  const open = substation !== null;
  const [displayed, setDisplayed] = useState(substation);

  useEffect(() => {
    if (substation) setDisplayed(substation);
  }, [substation]);

  return (
    <aside
      aria-hidden={!open}
      className={cn(
        "absolute inset-y-0 left-0 z-20 w-full max-w-sm border-r border-border bg-card text-card-foreground shadow-xl transition-transform duration-300 ease-out sm:w-96 sm:max-w-none",
        open ? "translate-x-0" : "-translate-x-full pointer-events-none",
      )}
    >
      {displayed && (
        <SubstationDetails properties={displayed.properties} onClose={onClose} />
      )}
    </aside>
  );
}
