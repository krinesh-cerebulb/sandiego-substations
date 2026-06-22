/** Shape metrics sourced from `substations.csv` (already in the source CRS units). */
export interface ShapeMetrics {
  area: number;
  length: number;
}

const CSV_URL = "/substations.csv";

/**
 * Loads `Shape__Area` / `Shape__Length` from the CSV, keyed by `OBJECTID`.
 *
 * The CSV is clean (no quoted/comma-bearing fields), so a plain split is safe.
 */
export async function fetchShapeMetrics(
  signal?: AbortSignal,
): Promise<Map<number, ShapeMetrics>> {
  const response = await fetch(CSV_URL, { signal });
  if (!response.ok) {
    throw new Error(
      `Failed to load substations CSV (${response.status} ${response.statusText}).`,
    );
  }
  return parseShapeMetrics(await response.text());
}

function parseShapeMetrics(text: string): Map<number, ShapeMetrics> {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const header = lines[0].split(",");

  const idIndex = header.indexOf("OBJECTID");
  const areaIndex = header.indexOf("Shape__Area");
  const lengthIndex = header.indexOf("Shape__Length");
  if (idIndex < 0 || areaIndex < 0 || lengthIndex < 0) {
    throw new Error("substations.csv is missing OBJECTID / Shape__ columns.");
  }

  const metrics = new Map<number, ShapeMetrics>();
  for (let i = 1; i < lines.length; i++) {
    const columns = lines[i].split(",");
    const id = Number(columns[idIndex]);
    if (!Number.isFinite(id)) continue;
    metrics.set(id, {
      area: Number(columns[areaIndex]),
      length: Number(columns[lengthIndex]),
    });
  }
  return metrics;
}
