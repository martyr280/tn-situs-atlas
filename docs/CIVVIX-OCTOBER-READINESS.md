# October 10 readiness follow-up

## Scope and implementation

This follow-up builds on draft PR #2 (`feat/jurisdiction-estimates`, baseline `da1da5038c1c149438689512201208da0f879bec`). That PR already implements county TPP, county/city business-license estimates, monthly input imports and pilot planning. It has not been merged or promoted. This change adds a blank pilot import template and source-handoff requirements, prevents pending file reads from restoring cleared assumptions or overriding newer imports, tightens month validation and labels the license formula as a one-time fee.

The estimate component now has an unambiguous module name: `JurisdictionEstimates.tsx`. `Estimates.tsx` conflicted with the calculation module `estimates.ts` on Windows; extensionless lazy imports resolved to the wrong module. Test fixtures now use platform-independent path containment and Python executable selection. The source-map-js development dependency is patched from 1.2.1 to 1.2.2.

No geospatial/SoS extraction logic, source datasets, financial defaults, credentials, permissions or production configuration changed. The exported public planning snapshot remains empty. County/city source dates, counts and model assumptions remain distinct. Existing browser roster parsing uses a Worker; tests simulate it and do not establish real-browser behavior.

## Verification and release boundaries

Local verification uses Node 24.21 and Python 3.13 on Windows. Automated coverage includes provenance, benchmark mathematics, city separation, zero/missing inputs, pilot allocation, Python history/conflict/atomic replacement and session clearing. The complete build validates 95 county and 345 city workspaces; this coverage is not a claim of reviewed financial baselines or contracted customers.

Real-browser QA could not run in this execution environment: computer-use reported no available apps or browsers. Mobile 320px reflow, zoom, keyboard focus, screen readers, actual Worker processing, downloads/clipboard, deployed route reloads and HTTP cache behavior remain release gates. The previous PR's desktop preview QA does not verify these new changes. Review `CIVVIX-WEB-DEPLOYMENT.md` before completing release.

Vercel read-only inspection on October 10 confirmed a READY production deployment from main `7af0c855bbaedccc101277fb606a04a5f748577b`, the verified `atlas.civvix.ai` project domain, and a READY protected PR #2 preview at https://tn-situs-atlas-2sy861wd3-resolve6.vercel.app/ . Preview protection is enabled for non-custom domains; it is not application authentication. No merge or deployment was performed by this task.

Release approval remains separate. Reviewed monthly counts/annual benchmarks, source owner/handoff, initial pilot county/city scope and verified-lead acceptance criteria remain required inputs. Historical source files can be inspected separately; their existence does not establish a connected recurring feed. Shared review storage is not enabled. Commercial pricing, revenue shares and legal/procurement terms are outside the application's defaults and require separate approval.
