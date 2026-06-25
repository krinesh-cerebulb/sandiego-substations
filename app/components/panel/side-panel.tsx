import { X } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { cn } from "~/lib/utils";
import type { SubstationFeature } from "~/types/substation";
import { SubstationDetails } from "./substation-details";

interface SidePanelProps {
  /** The selected feature, or `null` when nothing is selected. */
  substation: SubstationFeature | null;
  onClose: () => void;
}

/**
 * Equipment shortcuts shown beneath the attribute list. Served from `public/`.
 * `href` is a placeholder (no real destination yet) — swap per image later.
 */
const NAV_LINKS = [
  {
    src: "/transformer.png",
    alt: "Transformer",
    href: "https://170.90.111.131/PIVision/#/Displays/116/SDGE_TRANSFORMER_OVERVIEW",
  },
  {
    src: "/circuit-breaker.png",
    alt: "Circuit breaker",
    href: null,
  },
  { src: "/battery.png", alt: "Battery", href: null },
] as const;

/**
 * Selected-substation details as a translucent floating card (top-left),
 * sharing the legend/filter styling. Grows in on select, unmounts on close.
 */
export function SidePanel({ substation, onClose }: SidePanelProps) {
  if (!substation) return null;

  return (
    <Card
      size="sm"
      className={cn(
        "absolute left-6 top-6 z-30 w-80 gap-2 bg-card/90 shadow-md backdrop-blur",
        "origin-top-left animate-in fade-in-0 zoom-in-95 duration-200",
      )}
    >
      <CardHeader>
        <CardTitle className="truncate text-sm">
          {substation.properties.NAME}
        </CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground"
            onClick={onClose}
            aria-label="Close details"
          >
            <X className="size-3.5" />
          </Button>
        </CardAction>
      </CardHeader>

      {/* Fixed max height + native overflow so the data list and image links
          scroll together on short viewports. */}
      <CardContent className="max-h-[calc(100vh-8rem)] overflow-y-auto">
        <SubstationDetails properties={substation.properties} />

        {/* Equipment navigation — image links beneath the data list. */}
        <nav className="mt-3 flex items-center justify-center gap-3 border-t border-border pt-3">
          {NAV_LINKS.map((link) =>
            link?.href ? (
              <a
                key={link.src}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={link.alt}
                className="rounded-md p-1.5 transition-colors hover:bg-accent"
              >
                <img
                  src={link.src}
                  alt={link.alt}
                  className="size-8 object-contain"
                />
              </a>
            ) : (
              <div
                key={link.src}
                rel="noopener noreferrer"
                aria-label={link.alt}
                className="rounded-md p-1.5 transition-colors"
              >
                <img
                  src={link.src}
                  alt={link.alt}
                  className="size-8 object-contain"
                />
              </div>
            ),
          )}
        </nav>
      </CardContent>
    </Card>
  );
}
