import type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Polygon,
} from "geojson";

/**
 * Attributes attached to every substation GeoJSON feature.
 *
 * Mirrors the source dataset exactly. Numeric fields are kept as `number`
 * (not `string`) because the Mapbox `step`/`case` expressions and the
 * legend buckets rely on numeric comparison.
 */
export interface SubstationProperties {
  NAME: string;
  FACILITYID: string;
  SUBSTATIONTYPE: string;
  DISTRICT: string;
  IMAP_VOLTAGE: number;
  EXIST_GEN: number;
  QUE_GEN: number;
  TOT_GEN: number;
  PROJ_LOAD: number;
  /** Renewable penetration percentage — drives polygon color. */
  PENETRATION: number;
}

/** A single substation polygon feature. */
export type SubstationFeature = Feature<
  Polygon | MultiPolygon,
  SubstationProperties
>;

/** The whole `substations.geojson` payload. */
export type SubstationCollection = FeatureCollection<
  Polygon | MultiPolygon,
  SubstationProperties
>;

/** A `[west, south, east, north]` bounding box. */
export type BoundingBox = [number, number, number, number];
