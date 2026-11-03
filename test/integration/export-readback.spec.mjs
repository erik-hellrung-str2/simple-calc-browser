// T2 integration (spec Testing): fixture IFC -> extraction -> table -> `Export CSV` / `Export Excel` -> read back by
// the independent reader (test/support/read-export.py: Python csv module, openpyxl 3.1.5 and the ZIP / XML
// structure). The export fixture fzk-export.ifc with the CalcTest_Export column: every exported cell equals the
// reference value of its row (test/fixtures/reference-values.json, REQ-008-export), rows in table order.
import { test, expect } from "../support/network-guard.mjs";
import { REF, fixture, loadFiles, openBuilder } from "../support/builder.mjs";
import { idle } from "../support/view-3d.mjs";
import { csvText, exportFile, readExport } from "../support/export.mjs";

const SINGLE = REF["REQ-008-export"].single;
const NUMBER = SINGLE.properties.number;
const TEXT = SINGLE.properties.text;

test("@integration @REQ-008-AC1 @REQ-008-AC2 export round trip: fzk-export.ifc table -> CSV and .xlsx -> Python reader equals the reference values", async ({
  page,
}, testInfo) => {
  const errors = await openBuilder(page);
  await loadFiles(page, fixture("fzk-export.ifc"));
  await idle(page);
  await page.evaluate(
    (keys) => window.CalcTable.setState({ columns: keys.map((key) => ({ key })) }),
    ["Name", "Material", NUMBER, TEXT],
  );
  const order = await page.evaluate(() => {
    const byKey = new Map(window.__calc.rows.map((r) => [r.key, r.guid]));
    return window.__calc.table.keys.map((k) => byKey.get(k));
  });
  const refs = new Map(SINGLE.rows.filter((r) => r.Modell === "fzk-export").map((r) => [r.GlobalId, r]));

  const csv = readExport("csv", (await exportFile(page, "csv", testInfo.outputPath("t.csv"))).path);
  const x = readExport("xlsx", (await exportFile(page, "xlsx", testInfo.outputPath("t.xlsx"))).path);
  expect(csv.bom).toBe(true);
  expect(x.testzip).toBeNull();
  expect(csv.records).toHaveLength(order.length + 1);
  expect(x.rows).toHaveLength(order.length + 1);
  expect(csv.records[0]).toEqual(["Name", "Material", NUMBER, TEXT]);
  let checked = 0;
  order.forEach((guid, i) => {
    const ref = refs.get(guid);
    if (!ref) return; // not a wall: values of the other classes are covered by the e2e export tests
    checked++;
    expect(csv.records[i + 1], guid).toEqual([
      ref.Name,
      ref.Material.join(", "),
      ref.Zahl ? ref.Zahl.csv : "",
      csvText(ref.Text ?? ""),
    ]);
    const row = x.rows[i + 1];
    expect(row[0].v).toBe(ref.Name);
    expect(row[2].v).toBe(ref.Zahl ? ref.Zahl.value : null);
    if (ref.Zahl) expect(row[2].t).toBe("n");
    expect(row[3].v).toBe(ref.Text);
  });
  expect(checked).toBe(refs.size);
  expect(errors).toEqual([]);
});
