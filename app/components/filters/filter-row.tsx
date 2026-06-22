import { X } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  ATTRIBUTE_KEYS,
  defaultOperator,
  FILTER_ATTRIBUTES,
  operatorsForType,
  type AttributeKey,
  type Filter,
  type Operator,
} from "~/lib/filters";

interface FilterRowProps {
  filter: Filter;
  /** Distinct values for the current attribute (used when its type is `enum`). */
  options: string[];
  onChange: (filter: Filter) => void;
  onRemove: () => void;
}

/** One live-editable filter: attribute · operator · value(s) · remove. */
export function FilterRow({
  filter,
  options,
  onChange,
  onRemove,
}: FilterRowProps) {
  const config = FILTER_ATTRIBUTES[filter.attribute];
  const operators = operatorsForType(config.type);
  const isBetween = config.type === "number" && filter.operator === "between";

  return (
    <div className="flex items-center gap-1">
      <Select
        value={filter.attribute}
        onValueChange={(value) => {
          const attribute = value as AttributeKey;
          // Reset operator/values to valid defaults for the new attribute type.
          onChange({
            ...filter,
            attribute,
            operator: defaultOperator(attribute),
            value: "",
            upper: "",
          });
        }}
      >
        <SelectTrigger
          size="sm"
          className="h-7 w-24 shrink-0 text-xs focus-visible:ring-1 focus-visible:ring-offset-0"
          aria-label="Attribute"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          {ATTRIBUTE_KEYS.map((key) => (
            <SelectItem key={key} value={key}>
              {FILTER_ATTRIBUTES[key].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filter.operator}
        onValueChange={(value) =>
          onChange({ ...filter, operator: value as Operator })
        }
      >
        <SelectTrigger
          size="sm"
          className="h-7 shrink-0 text-xs focus-visible:ring-1 focus-visible:ring-offset-0"
          aria-label="Operator"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          {operators.map((op) => (
            <SelectItem key={op.value} value={op.value}>
              {op.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {config.type === "enum" ? (
        <Select
          value={filter.value}
          onValueChange={(value) => onChange({ ...filter, value })}
        >
          <SelectTrigger
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            size="sm"
            className="h-7 min-w-0 flex-1 text-xs focus-visible:ring-1 focus-visible:ring-offset-0"
            aria-label="Value"
          >
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent position="popper">
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : isBetween ? (
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <Input
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            type="number"
            placeholder="Min"
            value={filter.value}
            onChange={(e) => onChange({ ...filter, value: e.target.value })}
            className="h-7 min-w-0 text-xs focus-visible:ring-1 focus-visible:ring-offset-0"
          />
          <Input
            type="number"
            placeholder="Max"
            value={filter.upper}
            onChange={(e) => onChange({ ...filter, upper: e.target.value })}
            className="h-7 min-w-0 text-xs focus-visible:ring-1 focus-visible:ring-offset-0"
          />
        </div>
      ) : (
        <Input
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          type={config.type === "number" ? "number" : "text"}
          placeholder="Value"
          value={filter.value}
          onChange={(e) => onChange({ ...filter, value: e.target.value })}
          className="h-7 min-w-0 flex-1 text-xs focus-visible:ring-1 focus-visible:ring-offset-0"
        />
      )}

      <Button
        variant="ghost"
        size="icon"
        className="size-6 shrink-0 text-muted-foreground"
        onClick={onRemove}
        aria-label="Remove filter"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
