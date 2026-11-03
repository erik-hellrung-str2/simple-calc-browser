// T7 robustness of loading in the builder (TASK-010; REQ-001, spec 4.6, UI-02):
//   - a conversion worker that starts and then hangs mid-conversion becomes an `unreadable` error after the stall
//     timeout (TASK-002 follow-up; test hooks hangNextConversion / stallTimeoutMs shorten it), the next load works;
//   - a file dropped while a model is being removed, or while the IfcSpace option is switched, is queued and loaded
//     right after that action (TASK-002 defect A covered only the drop during a load);
//   - the progress bar of the overlay is drawn in the accent red of UI-02, not in the browser's default blue.
// Expected counts come from test/fixtures/reference-values.json (STEP-text derivation).
import { readFileSync } from "node:fs";
import { test, expect } from "../support/network-guard.mjs";
import { REF, fixture, loadFiles, openBuilder } from "../support/builder.mjs";

const FZK = fixture("AC20-FZK-Haus.ifc");
const DUPLEX = fixture("Ifc2x3_Duplex_Architecture.ifc");
const fzkRef = REF["AC20-FZK-Haus"];
const FZK_ROWS = Object.entries(fzkRef.elementsInStepTextByKategorie)
  .filter(([k]) => k !== "IfcOpeningElement")
  .reduce((sum, [, n]) => sum + n, 0);

test.describe.configure({ timeout: 180_000 });

test("@integration @robustness @REQ-001 a conversion worker that hangs mid-conversion becomes an `unreadable` error after the stall timeout", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  await loadFiles(page, DUPLEX);
  await page.evaluate(() => {
    window.__calc.test.hangNextConversion = true;
    window.__calc.test.stallTimeoutMs = 1500;
  });
  const t0 = Date.now();
  await loadFiles(page, FZK);
  const waited = Date.now() - t0;
  const loadErrors = await page.evaluate(() => window.__calc.loadErrors);
  expect(loadErrors).toEqual([
    {
      fileName: "AC20-FZK-Haus.ifc",
      loadClass: "unreadable",
      message:
        "AC20-FZK-Haus.ifc konnte nicht gelesen werden: der Konverter antwortet nicht mehr (keine Rückmeldung seit 2 s).",
    },
  ]);
  expect(waited, "the stall timeout, not the 30 s start timeout").toBeLessThan(25_000);
  await expect(page.locator("#cv-messages")).toContainText(loadErrors[0].message);
  // the valid model stays, the page stays usable, the worker of the hung conversion was terminated
  expect(await page.evaluate(() => window.__calc.models.map((m) => m.modell))).toEqual(["Ifc2x3_Duplex_Architecture"]);
  expect(await page.evaluate(() => window.__calc.conversion)).toMatchObject({ fileName: "AC20-FZK-Haus.ifc" });
  await page.evaluate(() => (window.__calc.test.stallTimeoutMs = null));
  await loadFiles(page, FZK);
  expect(await page.evaluate(() => window.__calc.models.map((m) => [m.modell, m.elements]))).toEqual([
    ["Ifc2x3_Duplex_Architecture", expect.any(Number)],
    ["AC20-FZK-Haus", FZK_ROWS],
  ]);
  // a normal conversion records its longest silence between two worker messages (NFR-002 / stall limit)
  const conversion = await page.evaluate(() => window.__calc.conversion);
  expect(conversion.fileName).toBe("AC20-FZK-Haus.ifc");
  expect(conversion.maxSilenceMs).toBeGreaterThanOrEqual(0);
  expect(conversion.maxSilenceMs).toBeLessThanOrEqual(conversion.ms);
  expect(errors).toEqual([]);
});

/**
 * Runs action (a function name in the page: "remove" clicks a model's remove button, "spaces" clicks the IfcSpace
 * option) and drops the files in the same task, so the drop arrives while that action runs. Returns
 * { busyPhase, queued } right after the drop.
 */
async function actAndDrop(page, action, paths, modell) {
  const files = paths.map((p) => ({ name: p.split("/").pop(), data: readFileSync(p).toString("base64") }));
  return page.evaluate(
    ({ action, files, modell }) => {
      const transfer = new DataTransfer();
      for (const { name, data } of files)
        transfer.items.add(new File([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], name));
      if (action === "remove") {
        const label = `Modell entfernen: ${modell}`;
        [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === label).click();
      } else {
        document.getElementById("cv-opt-spaces").click();
      }
      const busyPhase = window.__calc.phase;
      document
        .querySelector(".cv-app")
        .dispatchEvent(new DragEvent("drop", { dataTransfer: transfer, bubbles: true, cancelable: true }));
      return { busyPhase, queued: window.__calc.queued };
    },
    { action, files, modell },
  );
}

test("@integration @robustness @REQ-001 a file dropped while a model is removed is queued and loaded right after the removal", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  await loadFiles(page, [FZK, DUPLEX]);
  const before = await page.evaluate(() => window.__calc.loads);
  const removeLabel = await page
    .getByRole("button", { name: "Modell entfernen: Ifc2x3_Duplex_Architecture", exact: true })
    .getAttribute("aria-label");
  expect(removeLabel).toBe("Modell entfernen: Ifc2x3_Duplex_Architecture");
  const dropped = await actAndDrop(page, "remove", [FZK], "Ifc2x3_Duplex_Architecture");
  expect(dropped).toEqual({ busyPhase: "loading", queued: 1 });
  // the removal finishes (loads + 1), then the queued file loads (loads + 2)
  await page.waitForFunction((n) => window.__calc.loads >= n + 2 && window.__calc.phase === "ready", before, {
    timeout: 120_000,
  });
  expect(await page.evaluate(() => window.__calc.models.map((m) => [m.modell, m.elements]))).toEqual([
    ["AC20-FZK-Haus", FZK_ROWS],
    ["AC20-FZK-Haus (2)", FZK_ROWS],
  ]);
  expect(await page.evaluate(() => [window.__calc.queued, window.__calc.loadErrors, window.__calc.modelCount])).toEqual(
    [0, [], 2],
  );
  await expect(page.locator("#cv-status")).toHaveText(`${FZK_ROWS * 2} von ${FZK_ROWS * 2} Elementen`);
  await expect(page.locator("#cv-overlay")).toBeHidden();
  expect(errors).toEqual([]);
});

test("@integration @robustness @REQ-001 @REQ-001-AC4 a file dropped while the IfcSpace option is switched is queued and loaded with the new option", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  await loadFiles(page, FZK);
  const before = await page.evaluate(() => window.__calc.loads);
  const dropped = await actAndDrop(page, "spaces", [FZK]);
  expect(dropped).toEqual({ busyPhase: "loading", queued: 1 });
  await page.waitForFunction((n) => window.__calc.loads >= n + 2 && window.__calc.phase === "ready", before, {
    timeout: 120_000,
  });
  // option on: both models show their IfcSpace rows (reference count of the STEP text)
  expect(await page.evaluate(() => window.__calc.options.includeSpaces)).toBe(true);
  await expect(page.locator("#cv-opt-spaces")).toBeChecked();
  const spaces = await page.evaluate(() => {
    const out = {};
    for (const row of window.__calc.rows)
      if (row.values.Kategorie === "IfcSpace") out[row.values.Modell] = (out[row.values.Modell] || 0) + 1;
    return out;
  });
  expect(spaces).toEqual({ "AC20-FZK-Haus": fzkRef.spaces.count, "AC20-FZK-Haus (2)": fzkRef.spaces.count });
  expect(await page.evaluate(() => window.__calc.models.map((m) => [m.modell, m.elements]))).toEqual([
    ["AC20-FZK-Haus", FZK_ROWS + fzkRef.spaces.count],
    ["AC20-FZK-Haus (2)", FZK_ROWS + fzkRef.spaces.count],
  ]);
  expect(await page.evaluate(() => [window.__calc.queued, window.__calc.loadErrors])).toEqual([0, []]);
  // the dropped model's spaces follow the option in 3D too: visible now, hidden after switching it off
  const spaceItems = await page.evaluate(() =>
    Promise.all(window.__calc.models.map((m) => window.CalcView.engineVisible(m.id, m.spaceIds))),
  );
  for (const visible of spaceItems) expect(visible.every(Boolean)).toBe(true);
  const n = await page.evaluate(() => window.__calc.loads);
  await page.locator("#cv-opt-spaces").click();
  await page.waitForFunction((k) => window.__calc.loads > k && window.__calc.phase === "ready", n);
  const hidden = await page.evaluate(() =>
    Promise.all(window.__calc.models.map((m) => window.CalcView.engineVisible(m.id, m.spaceIds))),
  );
  for (const visible of hidden) expect(visible.some(Boolean)).toBe(false);
  expect(errors).toEqual([]);
});

const ACCENT = [0xd7, 0x26, 0x22]; // UI-02 accent #D72622

test("@e2e @robustness @REQ-001 the progress bar is drawn in the UI-02 accent red", async ({ page }) => {
  await openBuilder(page);
  // a real load shows the bar with a percentage (conversion / extraction)
  await page.evaluate(() => {
    window.__barSeen = 0;
    new MutationObserver(() => {
      const bar = document.getElementById("cv-progress");
      if (!bar.hidden && !document.getElementById("cv-overlay").hidden) window.__barSeen++;
    }).observe(document.getElementById("cv-overlay"), { subtree: true, attributes: true, characterData: true });
  });
  await loadFiles(page, FZK);
  expect(await page.evaluate(() => window.__barSeen)).toBeGreaterThan(0);
  // the bar as the overlay shows it during a load, at 60 %
  await page.evaluate(() => {
    document.getElementById("cv-overlay").hidden = false;
    document.getElementById("cv-overlay-text").textContent = "AC20-FZK-Haus.ifc – Konvertierung: 60 %";
    const bar = document.getElementById("cv-progress");
    bar.hidden = false;
    bar.value = 60;
  });
  const bar = page.locator("#cv-progress");
  const box = await bar.boundingBox();
  expect(box.width).toBeGreaterThan(100);
  expect(box.height).toBeGreaterThanOrEqual(4);
  const png = await bar.screenshot();
  const share = await page.evaluate(
    async ({ b64, accent }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0);
      const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      let red = 0;
      let blue = 0;
      let leftRed = 0;
      let leftCount = 0;
      for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % bitmap.width;
        const near =
          Math.abs(data[i] - accent[0]) + Math.abs(data[i + 1] - accent[1]) + Math.abs(data[i + 2] - accent[2]) < 40;
        if (near) red++;
        if (data[i + 2] > data[i] + 40) blue++;
        if (x < bitmap.width * 0.5) {
          leftCount++;
          if (near) leftRed++;
        }
      }
      const total = data.length / 4;
      return { red: red / total, blue: blue / total, leftRed: leftRed / leftCount };
    },
    { b64: png.toString("base64"), accent: ACCENT },
  );
  // 60 % filled: the filled part is accent red, nothing is the default blue
  expect(share.leftRed, JSON.stringify(share)).toBeGreaterThan(0.8);
  expect(share.red, JSON.stringify(share)).toBeGreaterThan(0.45);
  expect(share.red, JSON.stringify(share)).toBeLessThan(0.75);
  expect(share.blue, JSON.stringify(share)).toBe(0);
});

test("@integration @robustness @REQ-001 odd file names: upper-case extension, spaces, umlauts, punctuation and a 200-character name", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  const bytes = readFileSync(FZK);
  const names = [
    "HAUS.IFC",
    "Grundriß Ä Ö Ü – Haus (Entwurf) 2026.ifc",
    "a;b,c'd\"e&f<g>.ifc",
    "x".repeat(196) + ".ifc",
    "ohne Endung",
  ];
  await loadFiles(
    page,
    names.map((name) => ({ name, mimeType: "application/octet-stream", buffer: bytes })),
    180_000,
  );
  expect(await page.evaluate(() => window.__calc.loadErrors)).toEqual([]);
  // Modell = file name without its extension (REQ-001); each model complete
  const expected = names.map((n) => n.replace(/\.[^.]*$/, ""));
  expect(await page.evaluate(() => window.__calc.models.map((m) => [m.modell, m.elements]))).toEqual(
    expected.map((m) => [m, FZK_ROWS]),
  );
  // shown as text in the model list (no markup from the name)
  const list = page.locator("#cv-models");
  for (const m of expected) await expect(list).toContainText(m.length > 60 ? m.slice(0, 40) : m);
  expect(await page.locator("#cv-models g").count()).toBe(0);
  expect(errors).toEqual([]);
});

test("@integration @robustness @REQ-001 a cancelled IFC file dialog changes nothing", async ({ page }) => {
  const errors = await openBuilder(page);
  await loadFiles(page, FZK);
  const before = await page.evaluate(() => ({
    loads: window.__calc.loads,
    models: window.__calc.models.map((m) => m.modell),
    phase: window.__calc.phase,
  }));
  // the file dialog closed without a choice: the input reports an empty file list
  await page.locator("#cv-file-input").setInputFiles([]);
  await page.waitForTimeout(300);
  expect(
    await page.evaluate(() => ({
      loads: window.__calc.loads,
      models: window.__calc.models.map((m) => m.modell),
      phase: window.__calc.phase,
    })),
  ).toEqual(before);
  expect(await page.evaluate(() => [window.__calc.loadErrors, window.__calc.queued])).toEqual([[], 0]);
  await expect(page.locator("#cv-overlay")).toBeHidden();
  await expect(page.locator("#cv-load")).toBeEnabled();
  expect(errors).toEqual([]);
});
