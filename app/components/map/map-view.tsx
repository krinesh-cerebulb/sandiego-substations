import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import { getBounds } from "~/lib/geojson";
import {
  buildColorExpression,
  buildFilterExpression,
  computeColorScale,
  FILL_OPACITY_EXPRESSION,
  FILL_SLOT,
  FEATURE_ID_PROPERTY,
  MAP_STYLE,
  MAPBOX_TOKEN,
  SUBSTATIONS_FILL_LAYER,
  SUBSTATIONS_SOURCE,
} from "~/lib/mapbox";
import type { Filter } from "~/lib/filters";
import type { MetricKey } from "~/lib/metrics";
import type {
  SubstationCollection,
  SubstationProperties,
} from "~/types/substation";
import { MapLegend } from "./map-legend";
import { MapTooltip } from "./map-tooltip";

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
  /** Active attribute filters (combined with AND). */
  filters: Filter[];
}

export function MapView({ data, selectedId, onSelect, filters }: MapViewProps) {
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

  /** Imperatively-positioned hover tooltip — kept out of React state. */
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Active thematic metric — map-local state (the side panel/selection don't
  // need it). Range + color expression are derived from it and the data.
  const [colorMetric, setColorMetric] = useState<MetricKey>("PENETRATION");
  const scale = useMemo(
    () => computeColorScale(data, colorMetric),
    [data, colorMetric],
  );
  const colorExpression = useMemo(
    () => buildColorExpression(colorMetric, scale),
    [colorMetric, scale],
  );
  /** Latest expression, so the mount-once `load` handler paints correctly. */
  const colorExpressionRef = useRef(colorExpression);
  colorExpressionRef.current = colorExpression;

  const filterExpression = useMemo(
    () => buildFilterExpression(filters),
    [filters],
  );
  /** Latest filter, so the mount-once `load` handler filters correctly. */
  const filterExpressionRef = useRef(filterExpression);
  filterExpressionRef.current = filterExpression;

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
      const tooltip = tooltipRef.current;

      // Move the hover flag + tooltip text only when the feature changes.
      if (hoveredIdRef.current !== feature.id) {
        clearHover();
        hoveredIdRef.current = feature.id;
        map.setFeatureState(
          { source: SUBSTATIONS_SOURCE, id: feature.id },
          { hover: true },
        );
        if (tooltip) {
          tooltip.textContent = (
            feature.properties as SubstationProperties
          ).NAME;
        }
      }

      // Position follows the cursor every move — no React state, no re-render.
      if (tooltip) {
        tooltip.style.opacity = "1";
        tooltip.style.transform = `translate(${event.point.x}px, ${event.point.y}px) translate(-50%, calc(-100% - 12px))`;
      }
    };

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = "";
      clearHover();
      if (tooltipRef.current) tooltipRef.current.style.opacity = "0";
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
        slot: FILL_SLOT,
        // Only set `filter` when one exists — `filter: undefined` fails Mapbox's
        // layer validation and the layer is silently dropped. The setFilter
        // effect below applies (and clears) filters after load regardless.
        ...(filterExpressionRef.current
          ? { filter: filterExpressionRef.current }
          : {}),
        paint: {
          "fill-color": colorExpressionRef.current,
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

  // ── Recolor the fill when the active metric (or its range) changes ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    whenSourceReady(map, () => {
      map.setPaintProperty(SUBSTATIONS_FILL_LAYER, "fill-color", colorExpression);
    });
  }, [colorExpression]);

  // ── Apply attribute filters: hide non-matching polygons ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    whenSourceReady(map, () => {
      map.setFilter(SUBSTATIONS_FILL_LAYER, filterExpression);
    });
  }, [filterExpression]);

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
      <MapTooltip ref={tooltipRef} />
      <MapLegend
        metric={colorMetric}
        scale={scale}
        onMetricChange={setColorMetric}
        shifted={selectedId !== null}
      />
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
