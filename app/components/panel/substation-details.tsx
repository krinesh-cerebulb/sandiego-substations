import { X } from "lucide-react";

import { formatMW, formatNumber, formatPercent } from "~/lib/format";
import { cn } from "~/lib/utils";
import type { SubstationProperties } from "~/types/substation";

interface SubstationDetailsProps {
  properties: SubstationProperties;
  onClose: () => void;
}

/** Read-only detail view for a single selected substation. */
export function SubstationDetails({
  properties,
  onClose,
}: SubstationDetailsProps) {
  // Declared as data so new fields (or future charts) are one entry to add.
  // `numeric` rows render in the mono font for aligned digits.
  const rows: Array<{ label: string; value: string; numeric?: boolean }> = [
    { label: "Object ID", value: String(properties.OBJECTID), numeric: true },
    { label: "Facility ID", value: properties.FACILITYID },
    { label: "Type", value: properties.SUBSTATIONTYPE },
    { label: "District", value: properties.DISTRICT },
    { label: "Voltage", value: properties.IMAP_VOLTAGE },
    { label: "Load Profile", value: properties.IMAP_LOAD_PROFILE },
    { label: "Existing Generation", value: formatMW(properties.EXIST_GEN), numeric: true },
    { label: "Queued Generation", value: formatMW(properties.QUE_GEN), numeric: true },
    { label: "Total Generation", value: formatMW(properties.TOT_GEN), numeric: true },
    { label: "Projected Load", value: formatMW(properties.PROJ_LOAD), numeric: true },
    { label: "Penetration", value: formatPercent(properties.PENETRATION), numeric: true },
    { label: "Shape Area", value: formatNumber(properties.Shape__Area), numeric: true },
    { label: "Shape Length", value: formatNumber(properties.Shape__Length), numeric: true },
  ];

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold leading-tight">
            {properties.NAME}
          </h2>
          <p className="text-sm text-muted-foreground">Substation details</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <dl className="divide-y divide-border">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-4 py-1.5"
            >
              <dt className="text-sm text-muted-foreground">{row.label}</dt>
              <dd
                className={cn(
                  "text-right text-sm font-medium",
                  row.numeric && "font-mono tabular-nums",
                )}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
