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
export type EnumOperator = "in" | "notIn";
export type Operator = TextOperator | NumberOperator | EnumOperator;

/** Separator for the comma-joined values an `enum` filter stores in `value`. */
export const ENUM_VALUE_SEPARATOR = ",";

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
  { value: "in", label: "is any of" },
  { value: "notIn", label: "is none of" },
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

// ── URL persistence ────────────────────────────────────────────────────────
// Query shape: `<attr>[_<op>]=<value>` — the operator suffix is omitted for an
// attribute's default operator, so common filters read cleanly:
//   ?name=tra&district=OC&penetration_gt=20

const SLUG_TO_ATTRIBUTE = new Map<string, AttributeKey>(
  ATTRIBUTE_KEYS.map((key) => [key.toLowerCase(), key]),
);

const OPERATOR_SUFFIX: Record<Operator, string> = {
  contains: "ct",
  startsWith: "sw",
  equals: "eq",
  gt: "gt",
  lt: "lt",
  gte: "gte",
  lte: "lte",
  between: "bt",
  in: "in",
  notIn: "nin",
};
const SUFFIX_OPERATOR = new Map<string, Operator>(
  Object.entries(OPERATOR_SUFFIX).map(([op, suffix]) => [suffix, op as Operator]),
);

const BETWEEN_SEPARATOR = "..";

function isComplete(filter: Filter): boolean {
  if (filter.value.trim() === "") return false;
  if (filter.operator === "between" && filter.upper.trim() === "") return false;
  return true;
}

function paramKey(attribute: AttributeKey, operator: Operator): string {
  const slug = attribute.toLowerCase();
  return operator === defaultOperator(attribute)
    ? slug
    : `${slug}_${OPERATOR_SUFFIX[operator]}`;
}

/** Splits a param key into its attribute + operator (or `null` if unknown). */
function parseKey(
  rawKey: string,
): { attribute: AttributeKey; operator: Operator } | null {
  const key = rawKey.toLowerCase();

  const exact = SLUG_TO_ATTRIBUTE.get(key);
  if (exact) return { attribute: exact, operator: defaultOperator(exact) };

  // Attribute slugs contain underscores too, so match the longest valid slug
  // by splitting only at the final `_` and validating both halves.
  const underscore = key.lastIndexOf("_");
  if (underscore > 0) {
    const operator = SUFFIX_OPERATOR.get(key.slice(underscore + 1));
    const attribute = SLUG_TO_ATTRIBUTE.get(key.slice(0, underscore));
    if (
      operator &&
      attribute &&
      operatorsForType(FILTER_ATTRIBUTES[attribute].type).some(
        (o) => o.value === operator,
      )
    ) {
      return { attribute, operator };
    }
  }
  return null;
}

/** Serializes complete filters to query params (incomplete rows are skipped). */
export function filtersToSearchParams(filters: Filter[]): URLSearchParams {
  const params = new URLSearchParams();
  for (const filter of filters) {
    if (!isComplete(filter)) continue;
    const value =
      filter.operator === "between"
        ? `${filter.value}${BETWEEN_SEPARATOR}${filter.upper}`
        : filter.value;
    params.append(paramKey(filter.attribute, filter.operator), value);
  }
  return params;
}

/** Parses query params back into editable filter rows. */
export function filtersFromSearchParams(params: URLSearchParams): Filter[] {
  const filters: Filter[] = [];
  for (const [key, raw] of params) {
    const parsed = parseKey(key);
    if (!parsed) continue;
    const { attribute, operator } = parsed;
    const [value = "", upper = ""] =
      operator === "between" ? raw.split(BETWEEN_SEPARATOR) : [raw];
    filters.push({ id: crypto.randomUUID(), attribute, operator, value, upper });
  }
  return filters;
}
