// Memory sampling for the perf specs (NFR-002 "peak memory recorded", TASK-010):
//   pageHeap  the page's JS heap (CDP Performance.getMetrics JSHeapUsedSize; main thread only, not the workers)
//   rss       the resident memory of every Chromium process of this test run (Linux /proc; null elsewhere). The
//             conversion worker and the Fragments worker run inside the renderer process, so their memory is in it.
// Polled every 250 ms until stop(); returns the peaks in MB (10^6 bytes).
import { readdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { chromium } from "@playwright/test";

// the Playwright browsers directory (e.g. ~/.cache/ms-playwright or PLAYWRIGHT_BROWSERS_PATH)
const BROWSERS_DIR = dirname(dirname(dirname(chromium.executablePath())));

/** Sum of VmRSS (bytes) of the Playwright Chromium processes (executable under the browsers directory), or null. */
export function chromiumRss() {
  let pids;
  try {
    pids = readdirSync("/proc").filter((name) => /^\d+$/.test(name));
  } catch {
    return null;
  }
  let sum = 0;
  for (const pid of pids) {
    try {
      const cmd = readFileSync(`/proc/${pid}/cmdline`, "utf8");
      if (!cmd.startsWith(BROWSERS_DIR + "/")) continue;
      const status = readFileSync(`/proc/${pid}/status`, "utf8");
      const m = /VmRSS:\s+(\d+)\s+kB/.exec(status);
      if (m) sum += Number(m[1]) * 1024;
    } catch {
      // process ended meanwhile
    }
  }
  return sum;
}

/** Starts polling page heap and process RSS; await stop() for { pageHeapMB, rssMB } peaks. */
export async function sampleMemory(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  let heap = 0;
  let rss = chromiumRss() === null ? null : 0;
  let polling = true;
  const loop = (async () => {
    while (polling) {
      try {
        const { metrics } = await cdp.send("Performance.getMetrics");
        const used = metrics.find((m) => m.name === "JSHeapUsedSize");
        if (used && used.value > heap) heap = used.value;
      } catch {
        // page closed or crashed
      }
      if (rss !== null) rss = Math.max(rss, chromiumRss() || 0);
      await new Promise((r) => setTimeout(r, 250));
    }
  })();
  return {
    async stop() {
      polling = false;
      await loop;
      await cdp.detach().catch(() => {});
      return { pageHeapMB: Math.round(heap / 1e6), rssMB: rss === null ? null : Math.round(rss / 1e6) };
    },
  };
}

/**
 * The measurement environment (NFR-002 / T6 "environment recorded"): CPU model and cores, load average (1 min),
 * memory, Node and Chromium versions, and the WebGL renderer of the page (software rendering, e.g. SwiftShader).
 */
export async function perfEnvironment(page) {
  const os = await import("node:os");
  const webgl = await page.evaluate(() => {
    const gl =
      document.createElement("canvas").getContext("webgl2") || document.createElement("canvas").getContext("webgl");
    if (!gl) return null;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
  return {
    cpu: os.cpus()[0]?.model ?? null,
    cores: os.cpus().length,
    load1: Math.round(os.loadavg()[0] * 100) / 100,
    memGB: Math.round(os.totalmem() / 1e9),
    node: process.version,
    chromium: page.context().browser()?.version() ?? null,
    webgl,
  };
}
