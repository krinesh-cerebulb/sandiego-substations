/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Mapbox GL public access token (client-side, `pk.…`). */
  readonly VITE_MAPBOX_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
