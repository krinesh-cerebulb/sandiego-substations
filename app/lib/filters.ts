import type { SubstationCollection } from "~/types/substation";

export type AttributeType = "text" | "number" | "enum";

export interface AttributeConfig {
  label: string;
  type: AttributeType;
}

/**
 * Typed registry of filterable GeoJSON attributes. The `type` drives which
 * operators are offered, which value control renders, and how the Mapbox clause
 * is built — so filter behavior is never hardcoded in the components.
 *
 * - `text`   → free-text input (high-cardinality strings: NAME, FACILITYID)
 * - `number` → numeric input + comparison operators
 * - `enum`   → dropdown of the dataset's distinct values (low-cardinality)
 *
 * (IMAP_LOAD_PROFILE is intentionally omitted for now.)
 */
export const FILTER_ATTRIBUTES = {
  NAME: { label: "Name", type: "text" },
  FACILITYID: { label: "Facility ID", type: "text" },
  DISTRICT: { label: "District", type: "enum" },
  SUBSTATIONTYPE: { label: "Substation Type", type: "enum" },
  IMAP_VOLTAGE: { label: "Voltage", type: "enum" },
  EXIST_GEN: { label: "Existing Generation", type: "number" },
  QUE_GEN: { label: "Queued Generation", type: "number" },
  TOT_GEN: { label: "Total Generation", type: "number" },
  PROJ_LOAD: { label: "Projected Load", type: "number" },
  PENETRATION: { label: "Penetration", type: "number" },
  Shape__Area: { label: "Shape Area", type: "number" },
  Shape__Length: { label: "Shape Length", type: "number" },
} as const satisfies Record<string, AttributeConfig>;

export type AttributeKey = keyof typeof FILTER_ATTRIBUTES;
export const ATTRIBUTE_KEYS = Object.keys(FILTER_ATTRIBUTES) as AttributeKey[];

export type TextOperator = "contains" | "equals" | "startsWith";
export type NumberOperator = "equals" | "gt" | "lt" | "gte" | "lte" | "between";
export type EnumOperator = "equals" | "notEquals";
export type Operator = TextOperator | NumberOperator | EnumOperator;

interface OperatorOption<T extends string> {
  value: T;
  label: string;
}

export const TEXT_OPERATORS: ReadonlyArray<OperatorOption<TextOperator>> = [
  { value: "contains", label: "contains" },
  { value: "equals", label: "equals" },
  { value: "startsWith", label: "starts with" },
];

export const NUMBER_OPERATORS: ReadonlyArray<OperatorOption<NumberOperator>> = [
  { value: "equals", label: "=" },
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
  { value: "gte", label: "≥" },
  { value: "lte", label: "≤" },
  { value: "between", label: "between" },
];

export const ENUM_OPERATORS: ReadonlyArray<OperatorOption<EnumOperator>> = [
  { value: "equals", label: "is" },
  { value: "notEquals", label: "is not" },
];

/** Operators available for an attribute type. */
export function operatorsForType(
  type: AttributeType,
): ReadonlyArray<OperatorOption<Operator>> {
  if (type === "text") return TEXT_OPERATORS;
  if (type === "enum") return ENUM_OPERATORS;
  return NUMBER_OPERATORS;
}

/** Default operator when an attribute is (re)selected. */
export function defaultOperator(attribute: AttributeKey): Operator {
  return operatorsForType(FILTER_ATTRIBUTES[attribute].type)[0].value;
}

/** Sorted distinct values of an attribute across the dataset (for `enum`). */
export function distinctValues(
  collection: SubstationCollection,
  attribute: AttributeKey,
): string[] {
  const values = new Set<string>();
  for (const feature of collection.features) {
    const value = feature.properties[attribute];
    if (value != null && value !== "") values.add(String(value));
  }
  return [...values].sort();
}

/**
 * A live-editable filter row. Values are kept as raw strings (straight from the
 * inputs) and parsed when the Mapbox clause is built, so a row can be partially
 * filled while editing without breaking the map — incomplete rows are skipped.
 */
export interface Filter {
  id: string;
  attribute: AttributeKey;
  operator: Operator;
  value: string;
  /** Upper bound, only used by the `between` operator. */
  upper: string;
}

/** A fresh, empty filter row (NAME contains …) ready to edit. */
export function createEmptyFilter(): Filter {
  return {
    id: crypto.randomUUID(),
    attribute: "NAME",
    operator: defaultOperator("NAME"),
    value: "",
    upper: "",
  };
}
