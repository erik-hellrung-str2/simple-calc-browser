// [perf] Node micro-benchmark of the TASK-008 export writers in cv-core (spec NFR-004: CSV / Excel export of 30,000
// rows x 20 columns in <= 5 s; T6 median of 3): a deterministic synthetic sheet (10 numeric, 10 text columns, some
// multi-values, unique and repeated texts) through exportSheet + toCsv and exportSheet + toXlsx. The .xlsx is read
// back by openpyxl in read-only mode (test/support/read-export.py xlsx-summary) to prove it is complete.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCore } from "../load-core.mjs";

const { exportSheet, toCsv, toXlsx } = await loadCore();
const READER = fileURLToPath(new URL("../support/read-export.py", import.meta.url));
const ROWS = 30_000;
const BUDGET_MS = 5000; // NFR-004
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

function synthetic() {
  const columns = [];
  for (let c = 0; c < 10; c++) columns.push({ key: "n" + c, title: `Pset.Zahl${c} (m³)` });
  for (let c = 0; c < 10; c++) columns.push({ key: "t" + c, title: `Pset.Text${c}` });
  const rows = [];
  for (let i = 0; i < ROWS; i++) {
    const values = {};
    for (let c = 0; c < 10; c++) if ((i + c) % 7) values["n" + c] = ((i * 7919 + c * 104729) % 1000003) / 997;
    for (let c = 0; c < 10; c++) {
      if (c === 0) values.t0 = "Element " + i;
      else if (c === 1) values.t1 = ["Beton", "Putz " + (i % 13)];
      else if ((i + c) % 5) values["t" + c] = "Wert " + ((i * c) % 211) + (c === 9 ? '; mit "Zitat"' : "");
    }
    rows.push({ key: "m1:" + i, values });
  }
  return { rows, columns };
}

test("[perf] NFR-004 core writers: 30,000 x 20 to CSV and to .xlsx each within 5 s (median of 3)", async (t) => {
  const { rows, columns } = synthetic();
  const order = Uint32Array.from({ length: ROWS }, (_, i) => i);
  const dir = mkdtempSync(join(tmpdir(), "cv-export-perf-"));
  try {
    const times = { csv: [], xlsx: [] };
    let csvText = "";
    let xlsx = null;
    for (let run = 0; run < 3; run++) {
      let t0 = performance.now();
      const sheet = exportSheet({ rows, columns, view: "single", order });
      csvText = await toCsv(sheet, { pause: () => Promise.resolve() });
      times.csv.push(performance.now() - t0);
      t0 = performance.now();
      xlsx = await toXlsx(exportSheet({ rows, columns, view: "single", order }), { pause: () => Promise.resolve() });
      times.xlsx.push(performance.now() - t0);
    }
    const result = {
      csvMedianMs: Math.round(median(times.csv)),
      xlsxMedianMs: Math.round(median(times.xlsx)),
      csvMB: Math.round((Buffer.byteLength(csvText) / 1e6) * 10) / 10,
      xlsxMB: Math.round((xlsx.length / 1e6) * 10) / 10,
      node: process.version,
    };
    t.diagnostic(JSON.stringify(result));
    console.log("NFR-004 core writers:", JSON.stringify(result));
    assert.ok(result.csvMedianMs <= BUDGET_MS, `CSV ${result.csvMedianMs} ms`);
    assert.ok(result.xlsxMedianMs <= BUDGET_MS, `XLSX ${result.xlsxMedianMs} ms`);
    assert.equal(csvText.split("\r\n").length, ROWS + 2); // header, rows, trailing CRLF
    const path = join(dir, "perf.xlsx");
    writeFileSync(path, xlsx);
    const back = JSON.parse(execFileSync("python3", ["-I", READER, "xlsx-summary", path], { encoding: "utf8" }));
    assert.equal(back.testzip, null);
    assert.equal(back.rowCount, ROWS + 1);
    assert.equal(back.columnCount, 20);
    assert.deepEqual(
      back.firstRows[0],
      columns.map((c) => c.title),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
