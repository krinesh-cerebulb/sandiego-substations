import { isRouteErrorResponse } from "react-router";

import type { Route } from "./+types/home";
import { MapView } from "~/components/map/map-view";
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
  return await fetchSubstations();
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
  return (
    <main className="h-screen w-screen overflow-hidden">
      <MapView data={loaderData} />
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
