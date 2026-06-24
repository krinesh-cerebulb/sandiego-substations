import type { Position } from "geojson";

import type {
  BoundingBox,
  SubstationCollection,
  SubstationFeature,
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

/** Signed area (×2) of a ring — used to pick the largest polygon. */
function ringArea2(ring: Position[]): number {
  let a = 0;
  for (let i = 0, n = ring.length - 1; i < n; i++) {
    a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return a;
}

/** Area-weighted centroid of a ring. */
function ringCentroid(ring: Position[]): [number, number] {
  let cx = 0;
  let cy = 0;
  let a = 0;
  for (let i = 0, n = ring.length - 1; i < n; i++) {
    const cross = ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    a += cross;
    cx += (ring[i][0] + ring[i + 1][0]) * cross;
    cy += (ring[i][1] + ring[i + 1][1]) * cross;
  }
  if (a === 0) return [ring[0][0], ring[0][1]];
  return [cx / (3 * a), cy / (3 * a)];
}

/** Even-odd ray cast — is `[x, y]` inside the ring? */
function pointInRing(ring: Position[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * A point `[lng, lat]` guaranteed to lie inside the feature — used to anchor
 * its label. The area centroid when that's inside; otherwise the midpoint of
 * the widest interior span at the centroid's latitude (handles concave shapes).
 * The bbox center won't do: for irregular polygons it often falls outside, so
 * clicking the label would miss the polygon.
 */
export function getFeatureCenter(
  feature: SubstationFeature,
): [number, number] {
  const polygons =
    feature.geometry.type === "MultiPolygon"
      ? feature.geometry.coordinates
      : [feature.geometry.coordinates];

  let ring = polygons[0][0];
  let maxArea = 0;
  for (const rings of polygons) {
    const area = Math.abs(ringArea2(rings[0]));
    if (area > maxArea) {
      maxArea = area;
      ring = rings[0];
    }
  }

  const [cx, cy] = ringCentroid(ring);
  if (pointInRing(ring, cx, cy)) return [cx, cy];

  // Concave: scan a horizontal line at the centroid's latitude, take the
  // midpoint of the widest interior segment (always inside the polygon).
  const crossings: number[] = [];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > cy !== yj > cy) {
      crossings.push(xi + ((xj - xi) * (cy - yi)) / (yj - yi));
    }
  }
  crossings.sort((p, q) => p - q);

  let bestX = cx;
  let bestSpan = -1;
  for (let i = 0; i + 1 < crossings.length; i += 2) {
    const span = crossings[i + 1] - crossings[i];
    if (span > bestSpan) {
      bestSpan = span;
      bestX = (crossings[i] + crossings[i + 1]) / 2;
    }
  }
  return [bestX, cy];
}
