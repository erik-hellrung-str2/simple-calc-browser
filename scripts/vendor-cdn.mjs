// Fetches the exact jsDelivr files the builder loads (spec §4.1, CON-002) into test-cache/cdn/ and checks them against
// the committed sha256 lock test/cdn.lock.json, so tests run offline against a hash-locked library graph.
//
//   node scripts/vendor-cdn.mjs            fetch missing files, verify every file against the lock (fails on drift)
//   node scripts/vendor-cdn.mjs --update   refetch everything and rewrite the lock (deliberate library update only)
//
// Graph: @thatopen/fragments@3.4.7/+esm and every /npm/ module it imports (as the reference crawler, ref L1991/L2040),
// three's OrbitControls at the three version found in that graph (ref L2093), the fragments worker and the web-ifc wasm.
import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { CDN, LOCK_FILE, cacheFileFor } from "./lib/cdn-cache.mjs";

export const FRAGMENTS_VERSION = "3.4.7";
export const EXPECTED_THREE = "0.185.1";
export const EXPECTED_WEBIFC = "0.0.77";
const FRAGMENTS_KEY = `/npm/@thatopen/fragments@${FRAGMENTS_VERSION}/+esm`;
const WORKER_KEY = `/npm/@thatopen/fragments@${FRAGMENTS_VERSION}/dist/Worker/worker.min.mjs`;
const NPM_IMPORT_RE = /(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\/npm\/[^"']+)["']/g; // same as ref L1991

const update = process.argv.includes("--update");
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const exists = (f) =>
  access(f).then(
    () => true,
    () => false,
  );

let lock = {};
try {
  lock = JSON.parse(await readFile(LOCK_FILE, "utf8"));
} catch {
  if (!update) {
    console.error(`vendor-cdn: lock ${LOCK_FILE} missing; run with --update to create it deliberately`);
    process.exit(1);
  }
}

const result = {};
const problems = [];

async function get(key) {
  if (key in result) return null;
  const file = cacheFileFor(key);
  let buf;
  if (!update && (await exists(file))) buf = await readFile(file);
  else {
    const res = await fetch(CDN + key);
    if (!res.ok) throw new Error(`vendor-cdn: HTTP ${res.status} for ${CDN + key}`);
    buf = Buffer.from(await res.arrayBuffer());
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, buf);
  }
  const hash = sha256(buf);
  if (!update) {
    if (!lock[key]) problems.push(`not in lock: ${key}`);
    else if (lock[key] !== hash) problems.push(`sha256 mismatch: ${key} (lock ${lock[key]}, got ${hash})`);
  }
  result[key] = hash;
  return buf;
}

async function crawl(roots) {
  const queue = [...roots];
  while (queue.length) {
    const key = queue.shift();
    const buf = await get(key);
    if (!buf) continue;
    for (const m of buf.toString("utf8").matchAll(NPM_IMPORT_RE)) if (!(m[1] in result)) queue.push(m[1]);
  }
}

await crawl([FRAGMENTS_KEY]);
const threeVersions = [...new Set(Object.keys(result).flatMap((k) => k.match(/^\/npm\/three@([^/]+)\//)?.[1] ?? []))];
const webIfcVersions = [
  ...new Set(Object.keys(result).flatMap((k) => k.match(/^\/npm\/web-ifc@([^/]+)\//)?.[1] ?? [])),
];
if (threeVersions.length !== 1 || threeVersions[0] !== EXPECTED_THREE)
  problems.push(`three versions in graph: ${threeVersions.join(", ") || "none"} (expected exactly ${EXPECTED_THREE})`);
if (webIfcVersions.length !== 1 || webIfcVersions[0] !== EXPECTED_WEBIFC)
  problems.push(
    `web-ifc versions in graph: ${webIfcVersions.join(", ") || "none"} (expected exactly ${EXPECTED_WEBIFC})`,
  );
await crawl([`/npm/three@${EXPECTED_THREE}/examples/jsm/controls/OrbitControls.js/+esm`]);
await get(WORKER_KEY);
await get(`/npm/web-ifc@${EXPECTED_WEBIFC}/web-ifc.wasm`);

if (!update)
  for (const key of Object.keys(lock)) if (!(key in result)) problems.push(`in lock but not in graph: ${key}`);
if (problems.length) {
  console.error("vendor-cdn FAILED:\n  " + problems.join("\n  "));
  process.exit(1);
}
if (update) {
  const sorted = Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(LOCK_FILE, JSON.stringify(sorted, null, 2) + "\n");
  console.log(`vendor-cdn: wrote lock with ${Object.keys(sorted).length} files`);
}
console.log(
  `vendor-cdn: ${Object.keys(result).length} files verified (fragments ${FRAGMENTS_VERSION}, three ${EXPECTED_THREE}, web-ifc ${EXPECTED_WEBIFC})`,
);
