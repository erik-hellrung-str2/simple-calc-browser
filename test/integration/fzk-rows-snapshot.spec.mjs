// Row snapshot for the TASK-003 filter-engine unit tests (test/unit/filter-engine.test.mjs): the builder's rows of
// AC20-FZK-Haus.ifc, reduced to the properties those tests use, committed as test/fixtures/fzk-rows.snapshot.json.
// The snapshot is only the INPUT of the unit tests; their expected results come from reference-values.json.
// This test keeps the snapshot honest: it fails when the live extraction no longer matches it.
// Regenerate after an intended extraction change: CV_WRITE_SNAPSHOT=1 npx playwright test fzk-rows-snapshot --project=http
import { readFileSync, writeFileSync } from "node:fs";
import { test, expect } from "../support/network-guard.mjs";
import { fixture, loadFiles, openBuilder } from "../support/builder.mjs";

const SNAPSHOT = fixture("fzk-rows.snapshot.json");
const KEYS = [
  "Modell",
  "Kategorie",
  "Name",
  "GlobalId",
  "Typ",
  "Geschoss",
  "Material",
  "Geometrie",
  "BaseQuantities.Length",
  "BaseQuantities.GrossSideArea",
  "BaseQuantities.NetVolume",
];

test("@integration TASK-003 row snapshot of AC20-FZK-Haus equals the live extraction", async ({ page }) => {
  await openBuilder(page);
  await loadFiles(page, fixture("AC20-FZK-Haus.ifc"));
  const rows = await page.evaluate(
    (keys) =>
      window.__calc.rows.map((r) => {
        const values = {};
        for (const k of keys) if (r.values[k] !== undefined) values[k] = r.values[k];
        return { guid: r.guid, values };
      }),
    KEYS,
  );
  rows.sort((a, b) => (a.guid < b.guid ? -1 : a.guid > b.guid ? 1 : 0));
  const live = {
    source: "AC20-FZK-Haus.ifc",
    generatedBy: "test/integration/fzk-rows-snapshot.spec.mjs",
    keys: KEYS,
    rows,
  };
  if (process.env.CV_WRITE_SNAPSHOT === "1") writeFileSync(SNAPSHOT, JSON.stringify(live, null, 1) + "\n");
  expect(JSON.parse(readFileSync(SNAPSHOT, "utf8"))).toEqual(live);
});
