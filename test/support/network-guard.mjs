// Playwright fixture used by every browser test (spec Testing, T3): requests to jsDelivr are answered from the
// hash-locked cache test-cache/cdn/ (scripts/vendor-cdn.mjs); any other request leaving the machine is aborted and
// recorded, and the test fails in teardown if one happened. Import { test, expect } from here, not from @playwright/test.
import { test as base, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { CDN, cacheFileFor, contentTypeFor } from "../../scripts/lib/cdn-cache.mjs";

export const test = base.extend({
  net: [
    async ({ context }, use) => {
      const served = [];
      const blocked = [];
      await context.route(`${CDN}/**`, async (route) => {
        const path = new URL(route.request().url()).pathname;
        let body;
        try {
          body = await readFile(cacheFileFor(path));
        } catch {
          blocked.push(route.request().url());
          return route.abort("blockedbyclient");
        }
        served.push(path);
        return route.fulfill({
          body,
          contentType: contentTypeFor(path),
          headers: { "access-control-allow-origin": "*" },
        });
      });
      await context.route(/^(https?|wss?):\/\/(?!127\.0\.0\.1[:/]|localhost[:/]|cdn\.jsdelivr\.net\/)/, (route) => {
        blocked.push(route.request().url());
        return route.abort("blockedbyclient");
      });
      await use({ served, blocked });
      expect(blocked, "requests outside the CDN cache / local server were blocked").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };
