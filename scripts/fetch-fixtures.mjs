// Downloads the large test fixtures listed in test/fixtures/manifest.json ("fetched") into test-cache/fixtures/
// (gitignored), verifies their sha256, and generates the synthetic >= 100 MB IFC ("generated") reproducibly.
// Files already present with the right sha256 are kept. Also verifies the committed fixtures.
//
//   node scripts/fetch-fixtures.mjs            fetch/generate and verify (fails on any sha256 mismatch)
//   node scripts/fetch-fixtures.mjs --record   additionally write the sha256 of generated files into the manifest
//                                              (only after a deliberate change of the generator or its parameters)
import { createHash } from "node:crypto";
import {
  closeSync,
  createReadStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { synthesize, validateStep } from "./lib/ifc-synth.mjs";

const MANIFEST = fileURLToPath(new URL("../test/fixtures/manifest.json", import.meta.url));
const COMMITTED_DIR = fileURLToPath(new URL("../test/fixtures/", import.meta.url));
export const FETCHED_DIR = fileURLToPath(new URL("../test-cache/fixtures/", import.meta.url));
const record = process.argv.includes("--record");
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const problems = [];

const fileSha256 = (path) =>
  new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(path)
      .on("data", (d) => hash.update(d))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });

for (const f of manifest.committed) {
  const got = await fileSha256(COMMITTED_DIR + f.file);
  if (got !== f.sha256) problems.push(`committed ${f.file}: sha256 ${got}, manifest ${f.sha256}`);
}

mkdirSync(FETCHED_DIR, { recursive: true });
for (const f of manifest.fetched) {
  const path = FETCHED_DIR + f.file;
  if (existsSync(path) && (await fileSha256(path)) === f.sha256) {
    console.log(`fetch-fixtures: ok (cached) ${f.file}`);
    continue;
  }
  const t0 = Date.now();
  const res = await fetch(f.url);
  if (!res.ok) throw new Error(`fetch-fixtures: HTTP ${res.status} for ${f.url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const got = createHash("sha256").update(buf).digest("hex");
  if (got !== f.sha256) {
    problems.push(`fetched ${f.file}: sha256 ${got}, manifest ${f.sha256} (file not kept)`);
    continue;
  }
  writeFileSync(path + ".part", buf);
  renameSync(path + ".part", path);
  console.log(`fetch-fixtures: downloaded ${f.file} (${(buf.length / 1e6).toFixed(1)} MB, ${Date.now() - t0} ms)`);
}

for (const g of manifest.generated) {
  const path = FETCHED_DIR + g.file;
  if (g.sha256 && existsSync(path) && (await fileSha256(path)) === g.sha256) {
    console.log(`fetch-fixtures: ok (cached) ${g.file}`);
    continue;
  }
  const t0 = Date.now();
  const source = readFileSync(FETCHED_DIR + g.from, "latin1"); // STEP is 7-bit; latin1 round-trips bytes exactly
  const hash = createHash("sha256");
  const fd = openSync(path + ".part", "w");
  let batch = [];
  let size = 0;
  const flush = () => {
    const buf = Buffer.from(batch.join(""), "latin1");
    hash.update(buf);
    writeSync(fd, buf);
    size += buf.length;
    batch = [];
  };
  for (const chunk of synthesize(source, { ...g.params, fileName: g.file })) {
    batch.push(chunk);
    if (batch.length >= 20000) flush();
  }
  flush();
  closeSync(fd);
  const got = hash.digest("hex");
  const check = validateStep(readFileSync(path + ".part", "latin1"));
  const sourceCheck = validateStep(source);
  const before = problems.length;
  if (
    check.projects !== 1 ||
    check.danglingCount ||
    check.duplicateGuids !== g.params.copies * sourceCheck.duplicateGuids
  )
    problems.push(`generated ${g.file}: structural check failed ${JSON.stringify(check)}`);
  if (size < 100 * 1024 * 1024) problems.push(`generated ${g.file}: ${size} bytes, expected >= 100 MiB`);
  if (record && problems.length === before) g.sha256 = got;
  else if (got !== g.sha256) problems.push(`generated ${g.file}: sha256 ${got}, manifest ${g.sha256 || "(none)"}`);
  if (problems.length > before) continue; // keep only the .part file for inspection
  renameSync(path + ".part", path);
  console.log(
    `fetch-fixtures: generated ${g.file} (${(size / 1e6).toFixed(1)} MB, ${check.entities} entities, ${Date.now() - t0} ms)`,
  );
}

if (record) writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
if (problems.length) {
  console.error("fetch-fixtures FAILED:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log(`fetch-fixtures: all fixtures verified in ${FETCHED_DIR}`);
