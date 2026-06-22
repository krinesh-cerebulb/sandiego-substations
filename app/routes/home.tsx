import { useMemo, useState } from "react";
import { isRouteErrorResponse } from "react-router";

import type { Route } from "./+types/home";
import { MapView } from "~/components/map/map-view";
import { SidePanel } from "~/components/panel/side-panel";
import { fetchShapeMetrics } from "~/lib/csv";
import { fetchSubstations } from "~/lib/geojson";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "San Diego Substations" },
    {
      name: "description",
      content: "Electrical substation renewable-penetration map.",
    },
  ];
}

/**
 * Client-only data load (keeps the POC backend-free). React Router runs this
 * during hydration; `HydrateFallback` covers the wait and a thrown error is
 * caught by `ErrorBoundary`.
 */
export async function clientLoader() {
  const [collection, metrics] = await Promise.all([
    fetchSubstations(),
    // Non-fatal: if the CSV fails, the map still loads (Shape fields blank).
    fetchShapeMetrics().catch(() => new Map()),
  ]);

  // Merge Shape__Area / Shape__Length onto each feature by OBJECTID.
  for (const feature of collection.features) {
    const shape = metrics.get(feature.properties.OBJECTID);
    if (shape) {
      feature.properties.Shape__Area = shape.area;
      feature.properties.Shape__Length = shape.length;
    }
  }

  return collection;
}

export function HydrateFallback() {
  return (
    <div className="grid h-screen place-items-center bg-background">
      <p className="animate-pulse text-sm text-muted-foreground">
        Loading substations…
      </p>
    </div>
  );
}

export default function Home({ loaderData }: Route.ComponentProps) {
  // Single source of truth for selection — a FACILITYID, never an index.
  // Phase 4 (deep linking) swaps this for `useSearchParams` and nothing else
  // changes: the map syncs from whatever drives `selectedId`.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Index by FACILITYID once for O(1) lookups — also reusable for Phase 5 search.
  const byFacilityId = useMemo(
    () =>
      new Map(loaderData.features.map((f) => [f.properties.FACILITYID, f])),
    [loaderData],
  );

  const selected = selectedId ? (byFacilityId.get(selectedId) ?? null) : null;

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <MapView
        data={loaderData}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      <SidePanel substation={selected} onClose={() => setSelectedId(null)} />
    </main>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : "Unknown error";

  return (
    <div className="grid h-screen place-items-center bg-background p-6 text-center">
      <div className="max-w-md space-y-2">
        <h1 className="text-lg font-semibold">Unable to load the map</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
