// Shared by scripts/vendor-cdn.mjs (writes the cache) and test/e2e/fixtures.mjs (serves it to the browser).
// A jsDelivr path such as /npm/three@0.185.1/+esm is stored at test-cache/cdn/npm/three@0.185.1/_esm.js.
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const CDN = "https://cdn.jsdelivr.net";
export const CACHE_DIR = fileURLToPath(new URL("../../test-cache/cdn/", import.meta.url));
export const LOCK_FILE = fileURLToPath(new URL("../../test/cdn.lock.json", import.meta.url));

export function cacheFileFor(cdnPath) {
  if (!cdnPath.startsWith("/npm/") || cdnPath.includes("..")) throw new Error(`not a jsDelivr npm path: ${cdnPath}`);
  return join(CACHE_DIR, cdnPath.slice(1).replace(/\+esm$/, "_esm.js"));
}

export function contentTypeFor(cdnPath) {
  if (cdnPath.endsWith("+esm") || /\.m?js$/.test(cdnPath)) return "text/javascript";
  if (cdnPath.endsWith(".wasm")) return "application/wasm";
  if (cdnPath.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}
