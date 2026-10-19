# Planning input handoff and release requirements

The jurisdiction estimates and pilot planner extend the Python atlas workflow; they do not replace geospatial extraction or infer tax liability. County workspaces provide TPP and license scenarios below the review queue. City workspaces provide license scenarios only.

## Source handoff

Use `docs/CIVVIX-ESTIMATES.md` for the version 1 input contract. For each jurisdiction, a source owner must supply the business population's counting unit, exact period and source; annual TPP returns and collected tax with source notes; and a separate license count where available. Reconcile legal entities versus locations, inactive records, exemptions, coverage and time periods before comparing counts. Preserve unknown optional metrics as absent; supplied zero is distinct from missing.

Historical SoS/UCC files are candidates for inspection, not automatically current monthly inputs. Document each file's contents, permitted use, source date, jurisdiction coverage and validation before using its aggregate counts. UCC leads can overlap registrations and must never increase the filing population. Do not publish private source records or financial assumptions in this public repository. The public estimate snapshot remains empty until a publishable source handoff is approved.

Run the Python importer with `--check` first. It validates provenance, preserves history and rejects conflicting jurisdiction/month changes unless `--replace` is explicitly selected after review. The frontend build separately rejects unknown catalog jurisdictions. Browser imports remain session-only and do not write repository snapshots or review storage.

## Scenario requirements

TPP benchmark mode uses the latest year's return count, and weighted collected tax divided by returns across the newest three distinct available years. Apply one capture multiplier only; export the raw signed gap. License scenarios use one-time initial fees. The pilot keeps independent program confirmation rates, explicit situs lookback/forward periods and distinct billable leads. County totals require situs allocation. Zero costs have no benefit/cost multiple. Do not sum overlapping jurisdictions or alternative benchmark/pilot results.

Download the monthly and pilot templates from the workspace. Null/blank template fields intentionally prevent calculation until reviewed assumptions are supplied. No default pricing or legal lookback is provided. Clear/restore invalidates pending reads; a newer import takes precedence over an older read. Invalid files must not replace a previously valid scenario.

## Release verification

Build then test with Node 24.15+ (the locked jsdom version requires this minimum within Node 24). Python integration tests use `python3` on Unix and `py` on Windows; set `ATLAS_PYTHON` to an installed executable when needed. Build output pins one snapshot with immutable gzip assets; frontend and snapshot must deploy together. Preserve the existing extraction scripts and source datasets.

Before release, verify 320px reflow, 200% zoom, visible keyboard focus, screen-reader operation, actual Worker roster import, downloads and clipboard, direct route reloads and legacy redirects in a real browser. Exercise Shelby/Wilson county and a city workspace; test invalid provenance, replacement, clear during a pending import and no import-generated network requests. Automated jsdom tests are not substitutes for these checks.

Release requires explicit approval to merge/deploy. Deployment protection is not application authentication; device-local reviews are not shared case storage. Live feeds and a shared authenticated workflow require separate implementation and approved source/access arrangements. Commercial terms, verified-lead acceptance criteria and the initial county/city scope must be settled separately from these technical tools.
