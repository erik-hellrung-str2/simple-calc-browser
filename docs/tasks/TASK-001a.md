---
id: TASK-001a
title: Toolchain, CDN cache, fixtures, check and pre-commit
type: enabler
status: done
implements: []
relates_to: [CON-001, CON-002, CON-004, NFR-002, NFR-005, STK-01, ASM-003, DEC-10]
depends_on: []
touches: [package.json, package-lock.json, .gitignore, .prettierrc.json, .prettierignore, eslint.config.mjs, playwright.config.mjs, calc-viewer-builder.html, scripts/, test/, .githooks/]
---
# TASK-001a: Toolchain, CDN cache, fixtures, check and pre-commit

## What was built
- **Dev tooling** (spec §4.1, exact versions): `prettier@3.9.10`, `eslint@9.39.5`, `@eslint/js@9.39.5`, `eslint-plugin-html@8.2.1`, `globals@17.14.0`, `c8@12.0.0`, `@playwright/test@1.63.0` (matches preinstalled Chromium revision 1243; `playwright install` never run). `package.json` script `prepare` sets `git config core.hooksPath .githooks` on every `npm ci`.
- **ESLint** flat config with eslint-plugin-html; `html/javascript-mime-types` includes `text/plain`, so the `cv-*-src` blocks of the builder are linted as modules (verified: an unused variable inside a `text/plain` block is reported).
- **Prettier** (`printWidth` 120) on code only; prose (`*.md`, `*.yaml`, `docs/`, `process/`, `.github/`, `.claude/`) and `test/fixtures/` are ignored.
- **`scripts/vendor-cdn.mjs`** + committed lock `test/cdn.lock.json`: crawls `@thatopen/fragments@3.4.7/+esm` with the reference regex (ref L1991), adds three's OrbitControls at the found three version, the fragments worker and `web-ifc.wasm`; 9 files into `test-cache/cdn/`; verifies every file against the sha256 lock and fails on drift, on files missing from the lock or graph, and unless exactly three `0.185.1` and web-ifc `0.0.77` are in the graph (DEC-10). `--update` rewrites the lock deliberately.
- **`scripts/fetch-fixtures.mjs`**: downloads SampleCastle (49.3 MB), Revit MEP (29.2 MB), Revit ARC (13.6 MB), Duplex MEP (17.9 MB) from commit-pinned raw.githubusercontent.com URLs into `test-cache/fixtures/` (gitignored), sha256-checked; keeps cached files whose hash matches; also re-verifies the committed fixtures. Generates `synthetic-castle-x3.ifc` (151.8 MB, 2,143,459 entities) reproducibly with `scripts/lib/ifc-synth.mjs`: 3 copies of SampleCastle in one IfcProject, STEP ids renumbered (id + k * maxId), fresh deterministic GlobalIds on every rooted entity (seeded sha256 → 22-char IFC GUID), every top-level `IfcLocalPlacement` of copy k re-based on an offset placement of k * 500 m; structural validation (unique ids, no dangling references, one IfcProject, GlobalId duplicates = 3 × those of the source) before the file is accepted; its sha256 is recorded in the manifest (`--record` only after a deliberate generator change). Regenerating after deleting the file produced the identical sha256 `641d1276…b2d8e9`. Sanity check outside the repo: web-ifc 0.0.77 (Node) opens the synthetic file with exactly 3× the walls (846) and meshes (10,707) of the source and one IfcProject.
- **Committed fixtures** in `test/fixtures/` with `manifest.json` (source URL, licence, sha256): `AC20-FZK-Haus.ifc` (IFC4), `Ifc2x3_Duplex_Architecture.ifc` (IFC2X3), error classes `error-empty.ifc`, `error-renamed-pdf.ifc` (minimal valid PDF), `error-ifc4x3-header.ifc` (FILE_SCHEMA IFC4X3_ADD2), `error-truncated.ifc` (first 64 KiB of FZK-Haus) — the error files are written by `scripts/make-error-fixtures.mjs` and a unit test checks they are byte-identical to its output.
- **`scripts/serve.mjs`**: zero-dependency static server for the repo root on 127.0.0.1, `PORT` (default 8080), path-traversal guarded.
- **`scripts/check.mjs`**: fail-fast `format` (prettier --check), `lint`, `typecheck` n/a, `build` n/a, `cdn-cache` (vendor-cdn verify), `test_fast` (c8 ≥ 70 % lines of `.cache/**` + node:test unit, Playwright `@integration` in project `http`); `--all` adds all Playwright tests in both projects and `node --test 'test/perf/**/*.test.mjs'`. Names the failing step.
- **`.githooks/pre-commit`** (existing, unchanged) reads `check` from AGENTS.md §4 and runs it; `core.hooksPath` set to `.githooks` in this clone and by `npm ci` (`prepare`).
- **Playwright** `playwright.config.mjs`: projects `file` (repo root as `file://` baseURL) and `http` (serve.mjs on port 4173), `retries: 0`, `forbidOnly`. Network-guard fixture `test/support/network-guard.mjs` (auto): jsDelivr answered from `test-cache/cdn/` (shared path mapping `scripts/lib/cdn-cache.mjs`), every other non-local request aborted, recorded, and fails the test in teardown.
- **`test/load-core.mjs`**: extracts `<script type="text/plain" id="cv-core-src">` from `calc-viewer-builder.html` into `.cache/cv-core.mjs`, padded so line numbers equal the HTML's, then imports it.
- **Placeholder builder skeleton** `calc-viewer-builder.html` with the §4.2 blocks (`cv-css`, `cv-core-src` with a placeholder `coreInfo()`, empty `cv-ui-src`/`cv-3d-src`/`cv-app-src`/`cv-viewer-bootstrap`, `cv-builder` module) so that load-core, coverage and the smoke test have a real target.
- **Tests**: `test/unit/core.test.mjs` (`[unit]` placeholder `coreInfo`, line preservation, missing-block error, ASCII-only embedded blocks), `test/unit/fixtures.test.mjs` (`[unit]` manifest sha256/source/licence, error fixtures reproducible, GUID generator, STEP record splitting, synthesizer renumbering/offset/shared project/GlobalIds/strings untouched), `test/integration/network-guard.spec.mjs` (`@integration` fragments 3.4.7 graph + three 0.185.1 + web-ifc +esm and wasm served from the cache; request outside the cache aborted and recorded), `test/e2e/smoke.spec.mjs` (`@smoke` placeholder: builder opens, header, no page errors).

## Files
New: `package.json`, `package-lock.json`, `.prettierrc.json`, `.prettierignore`, `eslint.config.mjs`, `playwright.config.mjs`, `calc-viewer-builder.html`, `scripts/{vendor-cdn,fetch-fixtures,make-error-fixtures,serve,check}.mjs`, `scripts/lib/{cdn-cache,ifc-synth}.mjs`, `test/cdn.lock.json`, `test/load-core.mjs`, `test/support/network-guard.mjs`, `test/unit/{core,fixtures}.test.mjs`, `test/integration/network-guard.spec.mjs`, `test/e2e/smoke.spec.mjs`, `test/fixtures/{manifest.json, AC20-FZK-Haus.ifc, Ifc2x3_Duplex_Architecture.ifc, error-empty.ifc, error-renamed-pdf.ifc, error-ifc4x3-header.ifc, error-truncated.ifc}`, `docs/tasks/TASK-001a.md`.
Changed: `.gitignore` (node_modules/, .cache/, test-cache/, coverage/, test-results/, playwright-report/).
Committed fixture size ≈ 5 MB; nothing from `test-cache/` (≈ 270 MB) is tracked.

## Commands run (results)
| Command | Result |
|---|---|
| `npm ci` | exit 0, 143 packages; `core.hooksPath` = `.githooks` |
| `python3 -m pip install openpyxl==3.1.5` | exit 0 (already 3.1.5) |
| `node scripts/vendor-cdn.mjs` | `9 files verified (fragments 3.4.7, three 0.185.1, web-ifc 0.0.77)` |
| `node scripts/fetch-fixtures.mjs` | 4 downloads sha256-verified; synthetic 151.8 MB generated in 10–13 s, sha256 matches manifest; second run: all `ok (cached)` |
| `node scripts/check.mjs` | all steps green (~4 s); unit 9/9, coverage cv-core 100 % lines, `@integration` http 2/2 |
| `node scripts/check.mjs --all` | all steps green (~7 s); Playwright 6/6 (file + http: smoke, 2 integration) |
| Clean-clone simulation (tracked + new files copied to an empty dir, `git init`, `npm ci`, vendor, fetch, `check --all`) | all exit 0 |
| `git hook run pre-commit` with misformatted `test/unit/tmp-misformatted.mjs` | exit 1, `check FAILED at step: format`, `commit refused`; file removed, hook exit 0 again |
| `tests.unit`, `tests.integration`, `tests.smoke`, `test_single` (both variants) from AGENTS.md §4 | exit 0 |

## Deviations
- `calc-viewer-builder.html` (listed under TASK-001b) created as a placeholder skeleton with the §4.2 block structure; needed for `load-core`, the coverage gate and the smoke placeholder. TASK-001b replaces the placeholder content.
- `check.mjs` runs an extra `cdn-cache` step (vendor-cdn verify, offline when cached) before `test_fast`, so browser tests never run against an unverified cache. AGENTS.md §4 commands left unchanged; they are all true as written.
- CDN lock lives in `test/cdn.lock.json` (committed) instead of under `test-cache/` (gitignored as a whole).
- Prettier scope limited to code (prose and process files excluded); a first unscoped `prettier --write .` reformatted 57 tracked docs/process files, which were restored to their committed state with `git restore` before anything else happened.
- Derived unit fixtures `fzk-feet.ifc`, `fzk-unit-a.ifc`, `fzk-unit-b.ifc`, configuration error fixtures and `reference-values.json` were not part of the TASK-001a brief; left for TASK-002/TASK-007 (spec Testing → Test data).

## Open points
- Licence of the youshengCode/IfcSampleFiles files is not stated by that repository; `Ifc2x3_Duplex_Architecture.ifc` is committed on that basis (origin: buildingSMART alliance / NIBS Common BIM Files). The orchestrator may want this confirmed or raised as a question before release.
- `tests.system`, `tests.e2e`, `tests.acceptance`, `tests.perf` (Playwright part) and `tests.robustness` currently exit 1 with `No tests found` because those suites do not exist yet; they become green as tasks add tagged tests (deliberately no `--pass-with-no-tests`, so a missing suite is visible).
- The fragments worker and web-ifc are vendored for tests only; whether `FragmentsModels.load` works from `file://` (R-1) is TASK-001b.
