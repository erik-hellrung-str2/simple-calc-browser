// Zero-dependency static file server for the repository root (AGENTS.md §4 `run`, Playwright project `http`).
//   node scripts/serve.mjs            -> http://localhost:8080/calc-viewer-builder.html
//   PORT=4173 node scripts/serve.mjs  -> other port
// Binds to 127.0.0.1 only (CON-004: nothing leaves the user's computer).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PORT = Number(process.env.PORT ?? 8080);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".wasm": "application/wasm",
  ".ifc": "application/octet-stream",
};

export function resolveInRoot(root, urlPath) {
  const path = resolve(join(root, decodeURIComponent(urlPath)));
  return path === root || path.startsWith(root + sep) ? path : null;
}

const server = createServer(async (req, res) => {
  try {
    let path = resolveInRoot(ROOT, new URL(req.url, "http://localhost").pathname);
    if (!path) return res.writeHead(403).end("forbidden");
    if ((await stat(path)).isDirectory()) path = join(path, "index.html");
    const body = await readFile(path);
    res.writeHead(200, { "content-type": TYPES[extname(path).toLowerCase()] ?? "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});
server.listen(PORT, "127.0.0.1", () =>
  console.log(`serve: http://localhost:${PORT}/calc-viewer-builder.html (root ${ROOT})`),
);
