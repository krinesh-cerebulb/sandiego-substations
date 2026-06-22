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

/** Matches the panel's `sm:w-96` (384px) — used to pad the map viewport. */
const PANEL_WIDTH = 384;
/** Tailwind `sm` breakpoint; below it the panel covers the full map. */
const PANEL_BREAKPOINT = 640;

interface MapViewProps {
  data: SubstationCollection;
  /** Currently selected substation `FACILITYID`, or `null`. */
  selectedId: string | null;
  /** Select a substation by `FACILITYID`, or clear with `null`. */
  onSelect: (facilityId: string | null) => void;
}

export function MapView({ data, selectedId, onSelect }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  /** Id of the polygon currently flagged `hover` in feature-state. */
  const hoveredIdRef = useRef<string | number | null>(null);
  /** Id currently flagged `selected`, so the next change can clear it. */
  const selectedIdRef = useRef<string | null>(null);
  /** Always-current callback, so the mount-once effect calls the latest. */
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
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

    const handleMouseMove = (event: mapboxgl.MapLayerMouseEvent) => {
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

    // One handler selects (hit) or clears (empty space) — keyed on FACILITYID.
    const handleClick = (event: mapboxgl.MapMouseEvent) => {
      const [feature] = map.queryRenderedFeatures(event.point, {
        layers: [SUBSTATIONS_FILL_LAYER],
      });
      onSelectRef.current(feature?.id != null ? String(feature.id) : null);
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
      map.on("click", handleClick);
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

  // ── Sync the selection highlight down into Mapbox feature-state ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    whenSourceReady(map, () => {
      // Clear the previously highlighted feature, then flag the new one.
      if (selectedIdRef.current && selectedIdRef.current !== selectedId) {
        map.setFeatureState(
          { source: SUBSTATIONS_SOURCE, id: selectedIdRef.current },
          { selected: false },
        );
      }
      if (selectedId) {
        map.setFeatureState(
          { source: SUBSTATIONS_SOURCE, id: selectedId },
          { selected: true },
        );
      }
      selectedIdRef.current = selectedId;
    });
  }, [selectedId]);

  // ── Pan the map out from under the panel when it's open (desktop only) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    whenSourceReady(map, () => {
      const left =
        selectedId && window.innerWidth >= PANEL_BREAKPOINT ? PANEL_WIDTH : 0;
      map.easeTo({ padding: { top: 0, right: 0, bottom: 0, left }, duration: 300 });
    });
  }, [selectedId]);

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
      <MapLegend shifted={selectedId !== null} />
    </div>
  );
}

/**
 * Runs `fn` once the substations source exists — immediately if the style has
 * already loaded, otherwise after the next `load`. Lets selection-driven
 * effects fire even when they run before the source is added.
 */
function whenSourceReady(map: mapboxgl.Map, fn: () => void) {
  if (map.getSource(SUBSTATIONS_SOURCE)) {
    fn();
  } else {
    map.once("load", fn);
  }
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
