import { useMemo } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  FILTER_ATTRIBUTES,
  type AttributeKey,
  type Filter,
} from "~/lib/filters";
import { cn } from "~/lib/utils";
import { FilterRow } from "./filter-row";

interface SearchFiltersPanelProps {
  /** Whether the panel is open (toggled from the legend's filter icon). */
  open: boolean;
  onClose: () => void;
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

/**
 * Filters panel — opens from the legend's filter icon, growing up out of its
 * corner. Shares the legend's card styling so they read as a matched pair.
 */
export function SearchFiltersPanel({
  open,
  onClose,
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

  if (!open) return null;

  // Nothing to clear when it's just the single, untouched default row.
  const hasContent =
    filters.length > 1 || filters.some((f) => f.value.trim() !== "");

  return (
    <Card
      size="sm"
      className={cn(
        "absolute bottom-10 left-68 z-20 w-80 origin-bottom-left gap-2 bg-card/90 shadow-md backdrop-blur",
        "animate-in fade-in-0 zoom-in-95 duration-200",
        shifted && "sm:translate-x-96",
      )}
    >
      <CardHeader>
        <CardTitle className="text-sm">Filters</CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground"
            onClick={onClose}
            aria-label="Close filters"
          >
            <X className="size-3.5" />
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-1.5">
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

        <div className="flex items-center justify-between">
          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={onAddFilter}
          >
            <Plus className="size-3.5" />
            Add filter
          </Button>
          {hasContent && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={onClearFilters}
            >
              Clear all
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
