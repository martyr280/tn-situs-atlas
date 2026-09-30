# Civvix web deployment

The `web/` application implements the atlas redesign. The Python pipeline remains the authoritative geospatial processor. No confidential roster is bundled in the public build.

## Reproducible build

Node 24 is recommended. From repository root:

```
npm --prefix web ci
npm --prefix web run build
npm --prefix web test
```

The build reads committed `site/` datasets using JSON parsing, validates required jurisdiction files, exports compressed and versioned assets, typechecks, and compiles the frontend to `web/dist`. It does not execute downloaded JavaScript or rerun live GIS ingestion. Tests cover all county/city queue counts, original evidence, source totals, asset checksums, matching, persistence errors and core UI interactions. UI tests use jsdom; they do not substitute for browser layout, screen-reader, Web Worker or deployed HTTP checks.

## Vercel configuration

Import `martyr280/tn-situs-atlas` under the intended team. Use repository root (`./`), not `web/`, because the export needs sibling `site/` and `configs/` inputs. Root `vercel.json` declares the install/build commands, output directory, SPA routing, cache policies and response security headers. No environment variables or database are required for the device-local release.

1. Deploy the feature branch as a preview.
2. Verify `/`, `/counties`, `/counties/wilson/review`, `/counties/davidson`, `/cities/ardmore`, `/scenarios`, `/sources` and direct-link reloads.
3. Verify the legacy `/wilson/` and `/flows/` redirects (client-side compatibility routes).
4. Test a synthetic roster and verify no content is transmitted. Data downloads must be GETs to this deployment only; imports must not generate POSTs or content telemetry.
5. Check mobile widths, keyboard workflows, screen readers, browser worker parsing, downloads, clipboard and canvas interaction.
6. Release the validated branch through the normal production merge/deploy workflow. Do not change the existing custom domain until the new deployment passes the checks.

The generated files end in `.json.gz`. They are downloaded as binary and decompressed with the browser's `DecompressionStream`; **do not add a Content-Encoding: gzip header** to these files, which would cause a second decompression. Chrome, Edge, Firefox and Safari current versions are the supported baseline. HTML/release manifests are revalidated; snapshot assets are immutable. A browser session pins the first fetched snapshot ID. Deploy frontend and snapshot atomically. Vercel rollback must restore the complete earlier deployment, not only the HTML.

The existing refresh job can continue building committed `site/` snapshots. Verify the fork's scheduled workflow is enabled and a refresh commit triggers Vercel; bot-trigger behavior must be observed after linking. CI should be required before production merges. Configure these GitHub/Vercel project settings during activation.

## Data scope

Index counts and workbench counts can differ; the UI reports them separately. Full records are exported losslessly, with point-only records explicitly labeled. IDs include source identity, legacy source record ID, name and coordinates; review storage is additionally namespaced by snapshot so a review does not silently carry across changed analysis. County/city copies of a source record share the identity where their source IDs align. Review state is not a durable case management database.

## Review storage and confidentiality

Review status, notes and history are in localStorage on the user's device. Save failures are surfaced; revision checks reject stale edits from another tab. Local storage is not encrypted by this application. Roster file content and coded values stay in worker/session memory; reload and Clear imported data discard them. Users should not put confidential roster details into review notes unless their device/storage policy permits it. Exported packets may include the selected record's coded value only after an explicit export/copy action.

The optional shared-team workflow is not enabled. Do not advertise shared persistence, authentication or multi-user audit history until that separate extension is implemented and tested.

## Known release gates

Automated tests cannot establish WCAG conformance. Complete real browser tests for focus, contrast, 320px reflow, zoom, actual screen readers, download/clipboard, worker handling and deployed cache behavior. Core Web Vitals targets remain goals until measured on an agreed device/network. The UI has no telemetry or session replay.
