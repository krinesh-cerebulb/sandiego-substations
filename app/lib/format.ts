/** Number + unit formatters for substation attributes. */

/** Rendered when a value is missing or not a finite number. */
const EMPTY = "—";

/** Locale-aware number, capped to `maxFractionDigits` decimals. */
export function formatNumber(
  value: number | null | undefined,
  maxFractionDigits = 2,
): string {
  if (value == null || !Number.isFinite(value)) return EMPTY;
  return value.toLocaleString(undefined, { maximumFractionDigits: maxFractionDigits });
}

/** Appends a unit only when the value is present. */
function withUnit(value: number | null | undefined, unit: string): string {
  const formatted = formatNumber(value);
  return formatted === EMPTY ? EMPTY : `${formatted}${unit}`;
}

/** Megawatts, e.g. `96.63 MW`. */
export function formatMW(value: number | null | undefined): string {
  return withUnit(value, " MW");
}

/** Percentage, e.g. `33%`. */
export function formatPercent(value: number | null | undefined): string {
  return withUnit(value, "%");
}
