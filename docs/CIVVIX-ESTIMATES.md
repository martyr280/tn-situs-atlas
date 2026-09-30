# Jurisdiction planning estimates

County workspaces include TPP and business-license calculators below the review queue. City workspaces include business-license calculations only. The existing Python GIS and SoS refresh pipeline is preserved unchanged.

The published snapshot starts empty. No private correspondence or reported financial baseline is published with the app. Load an authorized JSON snapshot in a jurisdiction workspace for a session-only scenario. Inputs never leave the browser through this feature. Reload or restore published inputs to clear them. Export captures the complete source record, assumptions, result, and time.

## Recovery app alignment

The TPP county-opportunity model was checked against the recovery project's `src/utils/countyOpportunity.ts` at revision `c1f8c704f30c54af3d5105d1a5fddd71fb107580`.

When `tppBenchmarks` are supplied:

- Use the latest tax year's return count for the gap, not the average annual return count.
- Sort benchmark years newest first and use up to three distinct loaded years.
- Weighted tax per return = sum of collected tax / sum of returns across that window.
- Annual opportunity = max(0, population − latest returns) × weighted tax per return.
- Modeled annual recovery = opportunity × capture rate (default 25%, explicitly an assumption).
- No second collection multiplier applies to this benchmark-based model.

The raw signed gap is retained in exports; the displayed screening gap is floored at zero. The reference app's wording about verified non-filers is not adopted: aggregate subtraction does not establish individual filing status. Its account-level Davidson district rates, interest schedules, demand letters and deal pricing are separate workflows and are not statewide defaults here.

For recovery-style input, each `tppBenchmarks` row uses its existing field names: `tax_year`, `returns_received`, `total_tpp_collected`, `source_note`. Group annual rows under the appropriate county record, and use the latest reviewed entity count and its exact as-of date for `population`. This requires authorized aggregate exports; no direct production database access or writes were added. The app provides an input template with blanks to fill; it intentionally fails validation until required fields are supplied. Remove optional unknown metrics rather than treating them as zero.

## Reported-count model

Screening gap = max(0, registration population − filing/license count).
Modeled cases = gap × assumed eligible share / 100.
Annual scenario = modeled cases × annual amount per case × collection rate / 100.

The subtraction compares aggregate counts, not individual matched businesses. Different periods and counting units, exemptions, inactive locations, and entity/location differences must be reconciled. UCC leads are contextual and never added to registrations. Missing counts stay unavailable; zero is a valid supplied count. TPP filings never substitute for licenses. No arrears, penalties or growth are assumed; overlapping county/city or program totals must not be summed as independent recoveries. Dollar results are rounded only for display; export retains precision. Annual amounts are deliberately blank until supplied by the analyst.

## Monthly inputs

`data/estimates/monthly.json` uses schema version 1 with a `records` array. Each record requires `kind` (`counties` or `cities`), catalog `slug`, `month` (`YYYY-MM`), `status` (`reported-baseline` or `reconciled`), `note`, and `population`. Optional `tppBenchmarks` contains annual rows described above. If benchmarks are supplied, the TPP calculator uses those rather than `tppFiled`. Optional metrics are `tppFiled` (counties only), `licensed`, and `ucc`. Every metric contains a nonnegative integer `value`, a nonempty `period`, and a nonempty `source`. Status is the source preparer's assertion, not independent validation by the app.

For a complete synthetic example, see `web/tests/fixtures/estimates.json`. Do not publish test values as jurisdiction facts.

```bash
python3 fetch/estimate_refresh.py --input /path/to/approved-month.json --check
python3 fetch/estimate_refresh.py --input /path/to/approved-month.json
npm --prefix web run build
npm --prefix web test
```

The Python import preserves older months, rejects duplicate records and malformed counts/provenance, and replaces the output atomically. Re-running identical inputs is idempotent. Conflicting existing jurisdiction/month data require `--replace`; review corrections before using it. The web build validates the entire snapshot and rejects jurisdictions outside the atlas catalog. A publishable monthly update requires reviewed source counts, a commit and deployment. No live SoS/UCC adapter or scheduled fetch is configured by this change.

`fetch/sos_refresh.py` continues to merge the existing SoS entity extracts. Its output is not automatically treated as the filing population. License and TPP source counts and their scopes must be provided separately. Browser imports replace the published selection for the session without modifying repository files or reviews.

## Verification

Automated coverage includes missing versus zero counts, negative differences, percentages outside range, source provenance, duplicate months, city/TPP separation, Python history retention and conflict handling, session input import, calculator edits, invalid input and export gating. Existing atlas coverage and review/roster tests remain in place. Browser visual verification and deployment status are recorded separately when completed.
