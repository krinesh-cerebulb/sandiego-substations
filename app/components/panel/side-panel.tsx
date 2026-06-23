import { X } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { ScrollArea } from "~/components/ui/scroll-area";
import { cn } from "~/lib/utils";
import type { SubstationFeature } from "~/types/substation";
import { SubstationDetails } from "./substation-details";

interface SidePanelProps {
  /** The selected feature, or `null` when nothing is selected. */
  substation: SubstationFeature | null;
  onClose: () => void;
}

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

      <CardContent>
        <ScrollArea className="max-h-[calc(100vh-3rem)]">
          <SubstationDetails properties={substation.properties} />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
