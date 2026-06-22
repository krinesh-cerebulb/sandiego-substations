import { useMemo } from "react";
import { Plus } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import {
  FILTER_ATTRIBUTES,
  type AttributeKey,
  type Filter,
} from "~/lib/filters";
import { cn } from "~/lib/utils";
import { FilterRow } from "./filter-row";

interface SearchFiltersPanelProps {
  filters: Filter[];
  /** Distinct values per `enum` attribute, for the value dropdowns. */
  optionsByAttribute: Partial<Record<AttributeKey, string[]>>;
  onAddFilter: () => void;
  onUpdateFilter: (filter: Filter) => void;
  onRemoveFilter: (id: string) => void;
  onClearFilters: () => void;
  /** When true, shift right so the detail panel doesn't cover it. */
  shifted?: boolean;
}

/** Floating Search & Filters panel — separate from the legend by design. */
export function SearchFiltersPanel({
  filters,
  optionsByAttribute,
  onAddFilter,
  onUpdateFilter,
  onRemoveFilter,
  onClearFilters,
  shifted = false,
}: SearchFiltersPanelProps) {
  // Enum attributes already in use — passed to rows so they hide them.
  const usedEnumAttributes = useMemo(() => {
    const used = new Set<AttributeKey>();
    for (const filter of filters) {
      if (FILTER_ATTRIBUTES[filter.attribute].type === "enum") {
        used.add(filter.attribute);
      }
    }
    return used;
  }, [filters]);

  const position = cn(
    "absolute left-6 top-6 z-20 transition-transform duration-300 ease-out",
    shifted && "sm:translate-x-96",
  );

  // Empty state: just the button. The card grows out of it on first add.
  if (filters.length === 0) {
    return (
      <Button
        className={cn(position, "h-8 gap-1.5 shadow-md")}
        onClick={onAddFilter}
      >
        <Plus className="size-4" />
        Add filter
      </Button>
    );
  }

  return (
    <Card
      className={cn(
        position,
        "w-80 origin-top-left gap-0 py-0 shadow-md",
        "animate-in fade-in-0 zoom-in-95 duration-200",
      )}
    >
      <CardHeader className="flex items-center justify-between gap-2 px-3 py-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Filters
        </CardTitle>
        <Badge variant="secondary" className="h-5 px-1.5">
          {filters.length}
        </Badge>
      </CardHeader>
      <Separator />

      <CardContent className="space-y-1.5 px-3 py-2">
        <ScrollArea className="-mx-1 max-h-64">
          <div className="space-y-1.5 p-1">
            {filters.map((filter) => (
              <FilterRow
                key={filter.id}
                filter={filter}
                options={optionsByAttribute[filter.attribute] ?? []}
                usedEnumAttributes={usedEnumAttributes}
                onChange={onUpdateFilter}
                onRemove={() => onRemoveFilter(filter.id)}
              />
            ))}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between pt-0.5">
          <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={onAddFilter}>
            <Plus className="size-3.5" />
            Add filter
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={onClearFilters}
          >
            Clear all
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
