import type { Config } from "@react-router/dev/config";

export default {
  // SPA mode: no server/SSR. The app is client-only (clientLoader + Mapbox),
  // so the build emits a static `build/client/` deployable to any CDN.
  ssr: false,
} satisfies Config;
