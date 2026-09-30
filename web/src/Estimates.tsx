import { useState } from "react";
import { useData } from "./data";
import { download, money, number, type CatalogItem } from "./model";
import {
  estimate,
  tppOpportunity,
  validateSnapshot,
  type EstimateInput,
  type EstimateSnapshot,
} from "./estimates";

export default function Estimates({ item }: { item: CatalogItem }) {
  const source = useData<EstimateSnapshot>("/data/estimates.json");
  const [uploaded, setUploaded] = useState<EstimateSnapshot | null>(null);
  const [error, setError] = useState("");
  const [month, setMonth] = useState("");
  const records =
    (uploaded || source.data)?.records
      .filter((r) => r.kind === item.kind && r.slug === item.slug)
      .sort((a, b) => b.month.localeCompare(a.month)) || [];
  const selected = records.find((r) => r.month === month) || records[0];
  const latestBenchmark = selected?.tppBenchmarks
    ?.slice()
    .sort((a, b) => b.tax_year - a.tax_year)[0];
  const sourceMetrics = selected
    ? {
        ...selected,
        tppFiled: latestBenchmark
          ? {
              value: latestBenchmark.returns_received,
              period: String(latestBenchmark.tax_year),
              source: latestBenchmark.source_note,
            }
          : selected.tppFiled,
      }
    : null;
  return (
    <section className="panel estimates" aria-labelledby="estimate-heading">
      <div className="panel-heading">
        <div className="eyebrow">JURISDICTION PLANNING</div>
        <h2 id="estimate-heading">
          {item.kind === "counties"
            ? "TPP & business-license estimates"
            : "Business-license estimates"}
        </h2>
        <p>
          Aggregate screening gaps help prioritize verification. They do not
          identify verified non-filers or establish an obligation to file.
        </p>
      </div>
      <div className="estimate-body">
        {source.error && !uploaded && (
          <p role="alert">
            {source.error}{" "}
            <button onClick={source.retry}>Retry estimate data</button>
          </p>
        )}
        {!source.data && !source.error && !uploaded && (
          <p role="status">Loading estimate inputs…</p>
        )}
        <div className="estimate-actions">
          {!!records.length && (
            <label>
              Input snapshot
              <select
                value={selected.month}
                onChange={(e) => setMonth(e.target.value)}
              >
                {records.map((r) => (
                  <option key={r.month} value={r.month}>
                    {r.month} ·{" "}
                    {r.status === "reported-baseline"
                      ? "Reported baseline"
                      : "Reconciled inputs"}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Load monthly inputs (JSON)
            <input
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  if (file.size > 2_000_000)
                    throw Error("Use an aggregate snapshot smaller than 2 MB.");
                  const next = validateSnapshot(JSON.parse(await file.text()));
                  if (
                    !next.records.some(
                      (r) => r.kind === item.kind && r.slug === item.slug,
                    )
                  )
                    throw Error(
                      "This file has no inputs for this jurisdiction.",
                    );
                  setUploaded(next);
                  setMonth("");
                  setError("");
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Unable to read inputs.",
                  );
                }
                e.target.value = "";
              }}
            />
          </label>
          <button
            onClick={() =>
              download(
                `civvix-${item.slug}-input-template.json`,
                JSON.stringify(
                  {
                    schemaVersion: 1,
                    records: [
                      {
                        kind: item.kind,
                        slug: item.slug,
                        month: new Date().toISOString().slice(0, 7),
                        status: "reported-baseline",
                        population: { value: null, period: "", source: "" },
                        ...(item.kind === "counties"
                          ? {
                              tppBenchmarks: [
                                {
                                  tax_year: new Date().getUTCFullYear() - 1,
                                  returns_received: null,
                                  total_tpp_collected: null,
                                  source_note: "",
                                },
                              ],
                            }
                          : {}),
                        licensed: { value: null, period: "", source: "" },
                        note: "Replace blank fields with reviewed source inputs. Omit unavailable optional metrics; do not replace missing data with zero.",
                      },
                    ],
                  },
                  null,
                  2,
                ),
                "application/json",
              )
            }
          >
            Download input template
          </button>
          {uploaded && (
            <button
              onClick={() => {
                setUploaded(null);
                setMonth("");
                setError("");
              }}
            >
              Restore published inputs
            </button>
          )}
        </div>
        <p className="muted">
          {uploaded
            ? "Session inputs · cleared when you leave this jurisdiction or reload."
            : "Published inputs · monthly refresh requires a new validated source snapshot."}{" "}
          No automatic SoS/UCC connection is configured.
        </p>
        {error && <p role="alert">{error}</p>}
        {!selected && (uploaded || source.data) && (
          <p>
            No dated inputs published for this jurisdiction. Load
            jurisdiction-specific inputs to calculate a scenario; atlas
            business-point counts are not a filing population.
          </p>
        )}
        {selected && (
          <div
            key={`${uploaded ? "session" : "published"}/${selected.month}/${JSON.stringify(selected)}`}
          >
            <p className="notice">{selected.note}</p>
            <div className="table-scroll">
              <table>
                <caption>Source inputs · {selected.month}</caption>
                <thead>
                  <tr>
                    <th>Measure</th>
                    <th>Count</th>
                    <th>Period</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["population", "Registered business population"],
                      ["tppFiled", "Annual TPP schedules"],
                      ["licensed", "Licensed businesses"],
                      ["ucc", "UCC leads (context only)"],
                    ] as const
                  )
                    .filter(
                      ([key]) => item.kind === "counties" || key !== "tppFiled",
                    )
                    .map(([key, label]) => (
                      <tr key={key}>
                        <th scope="row">{label}</th>
                        <td>{number(sourceMetrics?.[key]?.value)}</td>
                        <td>
                          {sourceMetrics?.[key]?.period || "Not supplied"}
                        </td>
                        <td>
                          {sourceMetrics?.[key]?.source || "Not supplied"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <p>
              UCC leads may overlap registrations and are never added to the
              population. A source month is not proof that filing data are
              current. Reconcile legal entities, locations, exemptions and
              reporting periods before using a gap.
            </p>
            <div className="estimate-grid">
              {item.kind === "counties" &&
                (selected.tppBenchmarks?.length ? (
                  <TppOpportunity input={selected} />
                ) : (
                  <Calculator
                    input={selected}
                    measure="tppFiled"
                    label="Tangible personal property"
                  />
                ))}
              <Calculator
                input={selected}
                measure="licensed"
                label="Business license"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
function Calculator({
  input,
  measure,
  label,
}: {
  input: EstimateInput;
  measure: "tppFiled" | "licensed";
  label: string;
}) {
  const [confirmation, setConfirmation] = useState("10");
  const [amount, setAmount] = useState("");
  const [collection, setCollection] = useState("100");
  const assumptions = {
    confirmation: Number(confirmation),
    amount: Number(amount),
    collection: Number(collection),
  };
  let problem = "",
    result = null;
  try {
    if ([confirmation, amount, collection].some((v) => !v.trim()))
      problem = "Enter all scenario assumptions to calculate revenue.";
    else
      result = estimate(
        input.population.value,
        input[measure]?.value,
        assumptions,
      );
  } catch (e) {
    problem = (e as Error).message;
  }
  const gap = input[measure]
    ? Math.max(0, input.population.value - input[measure]!.value)
    : null;
  return (
    <section className="estimate-card" aria-label={label + " scenario"}>
      <h3>{label}</h3>
      {measure === "tppFiled" && (
        <p className="muted">
          Reported-count scenario. Load annual TPP benchmarks to use the
          recovery app’s weighted county-opportunity model.
        </p>
      )}
      <p>
        Screening gap <strong>{number(gap)}</strong>
      </p>
      {input[measure] ? (
        <>
          <p>
            {number(input.population.value)} registrations −{" "}
            {number(input[measure]!.value)}{" "}
            {measure === "tppFiled" ? "schedules" : "licensed businesses"}.
          </p>
          {input[measure]!.value > input.population.value && (
            <p role="status">
              Filings exceed registrations. The screening gap is floored at
              zero; reconcile source coverage.
            </p>
          )}
          <label>
            Assumed eligible share of gap (%)
            <input
              aria-label={`${label} eligible share`}
              type="number"
              min="0"
              max="100"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>
          <label>
            {measure === "tppFiled"
              ? "Annual tax per modeled case ($)"
              : "One-time license fee per modeled case ($)"}
            <input
              aria-label={`${label} ${measure === "tppFiled" ? "annual amount" : "one-time fee"}`}
              type="number"
              min="0"
              step="any"
              value={amount}
              placeholder="Enter local assumption"
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label>
            Assumed collection rate (%)
            <input
              aria-label={`${label} collection rate`}
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={collection}
              onChange={(e) => setCollection(e.target.value)}
            />
          </label>
          {problem && <p role="status">{problem}</p>}
          {result && (
            <div aria-live="polite">
              <p>
                Modeled cases: <strong>{number(result.modeledCases)}</strong>
              </p>
              <p>
                {measure === "tppFiled"
                  ? "Annual TPP scenario:"
                  : "One-time license fee scenario:"}{" "}
                <strong>{money(result.annualRevenue)}</strong>
              </p>
            </div>
          )}
          <button
            disabled={!result}
            onClick={() =>
              download(
                `civvix-${input.slug}-${measure}-${input.month}.json`,
                JSON.stringify(
                  {
                    schemaVersion: 1,
                    input,
                    measure,
                    assumptions,
                    result: result
                      ? {
                          difference: result.difference,
                          screeningGap: result.screeningGap,
                          modeledCases: result.modeledCases,
                          revenue: result.annualRevenue,
                        }
                      : null,
                    period:
                      measure === "tppFiled"
                        ? "one year"
                        : "one-time initial fees",
                    exportedAt: new Date().toISOString(),
                    notice:
                      "Planning scenario, not verified non-filers or realized revenue. Gap × assumed eligible share × per-case amount × collection rate. Do not sum overlapping populations or jurisdictions.",
                  },
                  null,
                  2,
                ),
                "application/json",
              )
            }
          >
            Export {label.toLowerCase()} scenario
          </button>
        </>
      ) : (
        <p>
          A dated {measure === "tppFiled" ? "TPP filing" : "business-license"}{" "}
          count is required. TPP schedules cannot substitute for license
          records.
        </p>
      )}
      <p className="muted">
        Gap × eligible share × annual amount × collection rate. Fractional cases
        represent an expectation. No arrears, penalties or growth included.
      </p>
    </section>
  );
}

function TppOpportunity({ input }: { input: EstimateInput }) {
  const [capture, setCapture] = useState("25");
  let result = null,
    error = "";
  try {
    if (!capture.trim()) error = "Enter a capture rate.";
    else
      result = tppOpportunity(
        input.population.value,
        input.tppBenchmarks || [],
        Number(capture),
      );
  } catch (e) {
    error = (e as Error).message;
  }
  const currency = (n: number | null) =>
    n === null ? "Unavailable" : money(n);
  return (
    <section
      className="estimate-card"
      aria-label="Tangible personal property opportunity"
    >
      <h3>Tangible personal property</h3>
      <p>
        Recovery app methodology · latest return count and up to three benchmark
        years.
      </p>
      <label>
        Assumed capture rate (%)
        <input
          aria-label="TPP capture rate"
          type="number"
          min="0"
          max="100"
          step="any"
          value={capture}
          onChange={(e) => setCapture(e.target.value)}
        />
      </label>
      <p className="muted">
        25% is the recovery app’s default assumption, not a measured recovery
        rate.
      </p>
      {error && <p role="status">{error}</p>}
      {result && (
        <>
          <div className="table-scroll">
            <table>
              <caption>
                Annual TPP benchmarks · newest {result.years.length} loaded
                years
              </caption>
              <thead>
                <tr>
                  <th>Tax year</th>
                  <th>Returns</th>
                  <th>Collected</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {result.years.map((b) => (
                  <tr key={b.tax_year}>
                    <th scope="row">{b.tax_year}</th>
                    <td>{number(b.returns_received)}</td>
                    <td>{money(b.total_tpp_collected)}</td>
                    <td>{b.source_note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Latest returns ({result.latestYear}):{" "}
            <strong>{number(result.latestReturns)}</strong>
          </p>
          <p>
            Average annual returns:{" "}
            <strong>{number(result.averageAnnualReturns)}</strong> · contextual
            only
          </p>
          <p>
            Weighted tax per return:{" "}
            <strong>
              {result.averageReturnValue === null
                ? "Unavailable"
                : result.averageReturnValue.toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
            </strong>
          </p>
          <p>
            Screening gap: <strong>{number(result.screeningGap)}</strong> (
            {number(input.population.value)} registrations −{" "}
            {number(result.latestReturns)} latest-year returns)
          </p>
          {result.difference < 0 && (
            <p>
              Raw difference: {number(result.difference)}. Filings exceed
              registrations; reconcile coverage. Opportunity is floored at zero.
            </p>
          )}
          <div aria-live="polite">
            <p>
              Annual opportunity before capture:{" "}
              <strong>{currency(result.annualOpportunity)}</strong>
            </p>
            <p>
              Modeled annual recovery:{" "}
              <strong>{currency(result.annualRecovery)}</strong>
            </p>
          </div>
          <p className="muted">
            Sum of collected tax ÷ sum of returns across the newest three loaded
            years, multiplied by the screening gap and capture rate. No
            additional collection-rate multiplier. County totals cannot
            establish individual liability.
          </p>
        </>
      )}
      <button
        disabled={!result || result.annualRecovery === null}
        onClick={() =>
          download(
            `civvix-${input.slug}-tpp-opportunity-${input.month}.json`,
            JSON.stringify(
              {
                schemaVersion: 1,
                method: "county-opportunity-v1",
                input,
                assumptions: { capturePercent: Number(capture) },
                result,
                exportedAt: new Date().toISOString(),
                notice:
                  "Aggregate planning scenario, not verified non-filers or realized revenue.",
              },
              null,
              2,
            ),
            "application/json",
          )
        }
      >
        Export TPP opportunity
      </button>
    </section>
  );
}
