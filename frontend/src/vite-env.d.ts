/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  // Server-side KEENAN_WIKI_ENABLED cannot reach a static bundle, so the tab is
  // gated at build time. The server flag remains authoritative for the API.
  readonly VITE_KEENAN_WIKI_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
