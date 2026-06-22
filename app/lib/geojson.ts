import type {
  BoundingBox,
  SubstationCollection,
} from "~/types/substation";

/** Path to the static dataset served from `public/`. */
const SUBSTATIONS_URL = "/substations.geojson";

/**
 * Fetches and parses `substations.geojson`.
 *
 * Throws on a non-OK response so the route's `ErrorBoundary` can render the
 * error state. Pass an `AbortSignal` to cancel in-flight requests.
 */
export async function fetchSubstations(
  signal?: AbortSignal,
): Promise<SubstationCollection> {
  const response = await fetch(SUBSTATIONS_URL, { signal });

  if (!response.ok) {
    throw new Error(
      `Failed to load substations (${response.status} ${response.statusText}).`,
    );
  }

  return (await response.json()) as SubstationCollection;
}

/**
 * Computes the bounding box that encloses every feature.
 *
 * Walks raw coordinate arrays so it stays independent of Mapbox; the caller
 * adapts the result to whatever `fitBounds` shape it needs. Returns `null`
 * for an empty collection.
 */
export function getBounds(collection: SubstationCollection): BoundingBox | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  for (const feature of collection.features) {
    // Polygon: number[][][], MultiPolygon: number[][][][] — flatten either
    // down to the ring level and walk the [lng, lat] positions.
    const polygons =
      feature.geometry.type === "MultiPolygon"
        ? feature.geometry.coordinates
        : [feature.geometry.coordinates];

    for (const rings of polygons) {
      for (const ring of rings) {
        for (const [lng, lat] of ring) {
          if (lng < west) west = lng;
          if (lng > east) east = lng;
          if (lat < south) south = lat;
          if (lat > north) north = lat;
        }
      }
    }
  }

  return Number.isFinite(west) ? [west, south, east, north] : null;
}
