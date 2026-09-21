# Civvix workspace QA report

Implementation: `feat/civvix-workspace`, based on `affb87729c9ea073b16436746a4f04ebc40959c6`.
Data snapshot: `f43766c77e0dcc28` (source generation September 13, 2026).

## Verified locally

- TypeScript strict compilation and production Vite build pass.
- 18 automated tests cover CSV parsing, conservative identity matching, duplicate/conflicting codes, point-only restrictions, storage failures/revision conflicts, revenue assumptions, a 20,000-row synthetic roster, source parity, and UI workflows.
- All 95 counties and 345 cities preserve their source business/point-only record counts and have unique queue IDs. Statewide source totals remain unchanged. Representative county/city evidence packets are compared with the original source rows; representative asset checksums are verified.
- Integration tests exercise the 95 county map links, county search/comparison, scenario reset, evidence selection, local review saving, unsaved navigation cancellation, direct-link saved-review restoration, and roster parse/map/validate/apply/clear.
- axe-core reports zero structural violations on the overview and Lake County views. Contrast checks are disabled in jsdom, which cannot measure rendered contrast.
- Production dependency audit reports zero known vulnerabilities at execution time.
- Initial JavaScript is approximately 113 KB gzipped; map, review workspace, roster UI and worker are separate bundles. Total static output is approximately 107 MiB on disk, mostly lazy-loaded compressed public datasets.

## Bugs found and corrected

1. County name spacing omitted Van Buren from the statewide map.
2. Record IDs initially collapsed distinct source records; source identity is now included, and all-jurisdiction count checks pass.
3. Direct record links could initialize a review before local saved values loaded.
4. Map polygon/legend color ordering could disagree.
5. Unsaved reviews now block route/record navigation and browser unload. Storage quota and stale-save errors remain visible without discarding edits.

## Environment and release gates

UI integration tests run in jsdom using generated datasets. Their Worker substitute runs the actual matching/parser functions; it does not establish that browser module workers execute correctly. These are not deployed-browser end-to-end tests.

This environment denied local server listeners and browser access to local HTML snapshots. The connected Vercel tools did not provide a working deployment action, and the Vercel browser was signed out. Consequently no production release or real-browser visual signoff is claimed.

Before production release, complete browser QA against the Vercel preview: desktop/mobile reflow, keyboard/focus and screen readers, contrast, canvas map/layers and selection, actual Worker import/cancel behavior, clipboard/download, no roster network transmission, deep-link reloads, gzip delivery/cache headers, and representative large/sparse/multi-county datasets. Measure loading performance and verify source refresh/rollback. See `CIVVIX-WEB-DEPLOYMENT.md` for activation steps.
