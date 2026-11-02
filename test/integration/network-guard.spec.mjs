// Proves the test infrastructure (TASK-001a): the jsDelivr graph the builder loads is served from the hash-locked
// cache in both projects, and a request leaving the machine is aborted and recorded (the fixture's teardown fails
// every test with a non-empty record).
import { test, expect } from "../support/network-guard.mjs";

test("@integration network guard serves the fragments 3.4.7 graph and web-ifc wasm from the CDN cache", async ({
  page,
  net,
}) => {
  await page.goto("calc-viewer-builder.html");
  const r = await page.evaluate(async () => {
    const fragments = await import("https://cdn.jsdelivr.net/npm/@thatopen/fragments@3.4.7/+esm");
    const wasm = await fetch("https://cdn.jsdelivr.net/npm/web-ifc@0.0.77/web-ifc.wasm");
    const bytes = new Uint8Array(await wasm.arrayBuffer());
    return {
      fragmentsModels: typeof fragments.FragmentsModels,
      wasmStatus: wasm.status,
      wasmMagic: Array.from(bytes.slice(0, 4)),
    };
  });
  expect(r).toEqual({ fragmentsModels: "function", wasmStatus: 200, wasmMagic: [0, 0x61, 0x73, 0x6d] });
  expect(net.served).toContain("/npm/@thatopen/fragments@3.4.7/+esm");
  expect(net.served).toContain("/npm/three@0.185.1/+esm");
  expect(net.served).toContain("/npm/web-ifc@0.0.77/+esm");
});

test("@integration network guard aborts and records a request outside the cache", async ({ page, net }) => {
  await page.goto("calc-viewer-builder.html");
  const outcome = await page.evaluate(() =>
    fetch("https://example.com/").then(
      () => "answered",
      () => "aborted",
    ),
  );
  expect(outcome).toBe("aborted");
  expect(net.blocked).toEqual(["https://example.com/"]);
  net.blocked.length = 0; // recorded as expected; otherwise the fixture's teardown would fail this test
});
