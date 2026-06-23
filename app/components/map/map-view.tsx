import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import { getBounds, getFeatureCenter } from "~/lib/geojson";
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
import type { SubstationCollection } from "~/types/substation";
import { MapLegend } from "./map-legend";

/** Tailwind `sm` breakpoint; below it the left rail collapses. */
const PANEL_BREAKPOINT = 640;
/** Left viewport padding (desktop) — shifts the data right, freeing the left
 *  area for KPI overlays. Also keeps the data clear of the detail panel,
 *  since this exceeds the panel's width (`sm:w-96` = 384px). */
const LEFT_RESERVE = 420;

/** Camera padding: reserves the left area on desktop, modest margins on mobile. */
function mapPadding(): mapboxgl.PaddingOptions {
  const left = window.innerWidth >= PANEL_BREAKPOINT ? LEFT_RESERVE : 48;
  return { top: 48, right: 48, bottom: 48, left };
}

const LABEL_BASE =
  "pointer-events-none whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-md";
/** Border accent toggled by classList — a primary accent for the selected one. */
const LABEL_SELECTED = "border-primary";
const LABEL_DEFAULT = "border-border";

/** Full class string for a freshly-created label element. */
function labelClass(selected: boolean): string {
  return `${LABEL_BASE} ${selected ? LABEL_SELECTED : LABEL_DEFAULT}`;
}

interface MapViewProps {
  data: SubstationCollection;
  /** Currently selected substation `FACILITYID`, or `null`. */
  selectedId: string | null;
  /** Select a substation by `FACILITYID`, or clear with `null`. */
  onSelect: (facilityId: string | null) => void;
  /** Active attribute filters (combined with AND). */
  filters: Filter[];
  /** Opens/closes the filters panel (toggle lives in the legend). */
  onToggleFilters: () => void;
}

export function MapView({
  data,
  selectedId,
  onSelect,
  filters,
  onToggleFilters,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  /** Id of the polygon currently flagged `hover` in feature-state. */
  const hoveredIdRef = useRef<string | number | null>(null);
  /** Id currently flagged `selected`, so the next change can clear it. */
  const selectedIdRef = useRef<string | null>(null);
  /** Always-current selection, read by the imperative label logic. */
  const selectedIdPropRef = useRef(selectedId);
  selectedIdPropRef.current = selectedId;
  /** Bridge to the label updater defined inside the mount-once effect. */
  const updateLabelRef = useRef<(() => void) | null>(null);
  /** Always-current callback, so the mount-once effect calls the latest. */
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  /** Always-current data, so the mount-once effect reads the latest. */
  const dataRef = useRef(data);
  dataRef.current = data;

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
      fitBoundsOptions: { padding: mapPadding() },
    });
    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Two geo-anchored labels: a persistent one for the selected polygon and a
    // transient one for the hovered polygon (only when it's a different one), so
    // the active label stays put while you hover around.
    let selectedMarker: mapboxgl.Marker | null = null;
    let hoverMarker: mapboxgl.Marker | null = null;

    const setMarker = (
      marker: mapboxgl.Marker | null,
      id: string | null,
      selected: boolean,
    ): mapboxgl.Marker | null => {
      const feature = id
        ? dataRef.current.features.find((f) => f.properties.FACILITYID === id)
        : undefined;
      if (!feature) {
        marker?.remove();
        return null;
      }

      const center = getFeatureCenter(feature);
      if (!marker) {
        const element = document.createElement("div");
        element.className = labelClass(selected);
        element.textContent = feature.properties.NAME;
        return new mapboxgl.Marker({ element }).setLngLat(center).addTo(map);
      }

      // Toggle only the accent so Mapbox's `mapboxgl-marker` class (which makes
      // it `position: absolute`) survives — replacing className drops it and the
      // label balloons to full width.
      const element = marker.getElement();
      element.classList.toggle(LABEL_SELECTED, selected);
      element.classList.toggle(LABEL_DEFAULT, !selected);
      element.textContent = feature.properties.NAME;
      marker.setLngLat(center);
      return marker;
    };

    const updateHover = () => {
      const hovered =
        hoveredIdRef.current != null ? String(hoveredIdRef.current) : null;
      // No separate hover label for the already-selected polygon.
      const id =
        hovered && hovered !== selectedIdPropRef.current ? hovered : null;
      hoverMarker = setMarker(hoverMarker, id, false);
    };

    const updateLabels = () => {
      selectedMarker = setMarker(
        selectedMarker,
        selectedIdPropRef.current,
        true,
      );
      updateHover();
    };
    updateLabelRef.current = updateLabels;

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

      // Move the hover flag + label only when the feature under the cursor changes.
      if (hoveredIdRef.current !== feature.id) {
        clearHover();
        hoveredIdRef.current = feature.id;
        map.setFeatureState(
          { source: SUBSTATIONS_SOURCE, id: feature.id },
          { hover: true },
        );
        updateHover();
      }
    };

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = "";
      clearHover();
      updateHover(); // drops the hover label; the selected one stays
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
          // Polygon outline for clearer edge definition.
          "fill-outline-color": "rgb(100, 116, 139)",
        },
      });

      map.on("mousemove", SUBSTATIONS_FILL_LAYER, handleMouseMove);
      map.on("mouseleave", SUBSTATIONS_FILL_LAYER, handleMouseLeave);
      map.on("click", handleClick);
    });

    return () => {
      selectedMarker?.remove();
      hoverMarker?.remove();
      updateLabelRef.current = null;
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

  // ── Sync the selection highlight + label down into Mapbox ──
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

    // Keep the label in sync even when selection changes from outside the map.
    updateLabelRef.current?.();
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
      <MapLegend
        metric={colorMetric}
        scale={scale}
        onMetricChange={setColorMetric}
        onToggleFilters={onToggleFilters}
        filtersActive={filters.some((f) => f.value.trim() !== "")}
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
