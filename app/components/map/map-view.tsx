import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import { getBounds } from "~/lib/geojson";
import {
  buildFillColorExpression,
  FILL_OPACITY_EXPRESSION,
  FEATURE_ID_PROPERTY,
  MAP_STYLE,
  MAPBOX_TOKEN,
  SUBSTATIONS_FILL_LAYER,
  SUBSTATIONS_SOURCE,
} from "~/lib/mapbox";
import type {
  SubstationCollection,
  SubstationProperties,
} from "~/types/substation";
import { MapLegend } from "./map-legend";
import { MapTooltip, type TooltipState } from "./map-tooltip";

interface MapViewProps {
  data: SubstationCollection;
}

export function MapView({ data }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  /** Id of the polygon currently flagged `hover` in feature-state. */
  const hoveredIdRef = useRef<string | number | null>(null);
  /** Always-current data, so the mount-once effect reads the latest. */
  const dataRef = useRef(data);
  dataRef.current = data;

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // ── Create the map once, wire up sources/layers/handlers on style load ──
  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      bounds: toLngLatBounds(dataRef.current),
      fitBoundsOptions: { padding: 48 },
    });
    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    const clearHover = () => {
      if (hoveredIdRef.current !== null) {
        map.setFeatureState(
          { source: SUBSTATIONS_SOURCE, id: hoveredIdRef.current },
          { hover: false },
        );
        hoveredIdRef.current = null;
      }
    };

    const handleMouseMove = (
      event: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] },
    ) => {
      const feature = event.features?.[0];
      if (!feature || feature.id == null) return;

      map.getCanvas().style.cursor = "pointer";

      // Move the hover flag to the feature under the cursor.
      if (hoveredIdRef.current !== feature.id) {
        clearHover();
        hoveredIdRef.current = feature.id;
        map.setFeatureState(
          { source: SUBSTATIONS_SOURCE, id: feature.id },
          { hover: true },
        );
      }

      const props = feature.properties as SubstationProperties;
      setTooltip({
        name: props.NAME,
        penetration: props.PENETRATION,
        x: event.point.x,
        y: event.point.y,
      });
    };

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = "";
      clearHover();
      setTooltip(null);
    };

    map.on("load", () => {
      map.addSource(SUBSTATIONS_SOURCE, {
        type: "geojson",
        data: dataRef.current,
        promoteId: FEATURE_ID_PROPERTY,
      });

      map.addLayer({
        id: SUBSTATIONS_FILL_LAYER,
        type: "fill",
        source: SUBSTATIONS_SOURCE,
        paint: {
          "fill-color": buildFillColorExpression(),
          "fill-opacity": FILL_OPACITY_EXPRESSION,
        },
      });

      map.on("mousemove", SUBSTATIONS_FILL_LAYER, handleMouseMove);
      map.on("mouseleave", SUBSTATIONS_FILL_LAYER, handleMouseLeave);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      hoveredIdRef.current = null;
    };
  }, []);

  // ── Push new data into the existing source (Phase 6: live updates) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const source = map.getSource(SUBSTATIONS_SOURCE);
    if (source) {
      (source as mapboxgl.GeoJSONSource).setData(data);
    }
  }, [data]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <p className="max-w-md text-sm text-muted-foreground">
          Missing Mapbox token. Set <code>VITE_MAPBOX_TOKEN</code> in a{" "}
          <code>.env</code> file and restart the dev server.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <MapTooltip tooltip={tooltip} />
      <MapLegend />
    </div>
  );
}

/** Adapts the framework-agnostic bounding box to Mapbox's bounds shape. */
function toLngLatBounds(
  collection: SubstationCollection,
): mapboxgl.LngLatBoundsLike | undefined {
  const bounds = getBounds(collection);
  if (!bounds) return undefined;

  const [west, south, east, north] = bounds;
  return [
    [west, south],
    [east, north],
  ];
}
