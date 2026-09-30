import { useState } from "react";
import { download, money, number, type CatalogItem } from "./model";
import {
  pilotFields,
  pilotScenario,
  validatePilot,
  type PilotFile,
  type PilotInputs,
} from "./pilot";
const empty = () =>
  Object.fromEntries(pilotFields.map((f) => [f.key, ""])) as Record<
    string,
    string
  >;
export default function PilotPlanner({ item }: { item: CatalogItem }) {
  const [values, setValues] = useState(empty),
    [source, setSource] = useState(""),
    [asOf, setAsOf] = useState("");
  const [share, setShare] = useState(""),
    [rounding, setRounding] = useState<PilotInputs["rounding"]>("nearest"),
    [fileError, setFileError] = useState("");
  let result: ReturnType<typeof pilotScenario> | null = null,
    packet: PilotFile | null = null,
    error = "";
  if (pilotFields.every((f) => values[f.key].trim()) && source.trim() && asOf) {
    try {
      packet = validatePilot({
        schemaVersion: 1,
        kind: "pilot-scenario",
        jurisdiction: item.slug,
        asOf,
        source,
        inputs: {
          ...Object.fromEntries(
            pilotFields.map((f) => [f.key, Number(values[f.key])]),
          ),
          countySharePercent: share.trim() ? Number(share) : null,
          rounding,
        },
      });
      result = pilotScenario(packet.inputs);
    } catch (e) {
      error = (e as Error).message;
    }
  } else
    error =
      "Enter the dated assumptions or load a pilot scenario file to calculate.";
  const currency = (v: number | null) =>
    v === null ? "Withheld · county share needed" : money(v);
  const multiple = (v: number | null) =>
    v === null ? "Unavailable" : v.toFixed(2) + "×";
  return (
    <details className="panel estimates pilot-planner">
      <summary>Pilot stress test & cost comparison</summary>
      <div className="estimate-body">
        <p>
          Model screening leads and confirmed situs corrections over explicit
          periods. These are planning assumptions, not verified liabilities, a
          procurement determination or a promise of recovery.
        </p>
        <div className="estimate-actions">
          <label>
            Load pilot scenario (JSON)
            <input
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  if (file.size > 200000)
                    throw Error("Use a pilot file smaller than 200 KB.");
                  const d = validatePilot(JSON.parse(await file.text()));
                  if (d.jurisdiction !== item.slug)
                    throw Error("Pilot file is for a different jurisdiction.");
                  setValues(
                    Object.fromEntries(
                      pilotFields.map((f) => [f.key, String(d.inputs[f.key])]),
                    ),
                  );
                  setShare(
                    d.inputs.countySharePercent === null
                      ? ""
                      : String(d.inputs.countySharePercent),
                  );
                  setRounding(d.inputs.rounding);
                  setSource(d.source);
                  setAsOf(d.asOf);
                  setFileError("");
                } catch (err) {
                  setFileError((err as Error).message);
                }
                e.target.value = "";
              }}
            />
          </label>
          <button
            onClick={() => {
              setValues(empty());
              setSource("");
              setAsOf("");
              setShare("");
              setRounding("nearest");
              setFileError("");
            }}
          >
            Clear pilot assumptions
          </button>
        </div>
        {fileError && <p role="alert">{fileError}</p>}
        <p className="muted">
          Inputs stay in this session. Export before leaving or reloading. This
          pilot scenario is separate from the county benchmark estimate above;
          do not add them together.
        </p>
        <div className="estimate-actions">
          <label>
            Assumption source
            <input value={source} onChange={(e) => setSource(e.target.value)} />
          </label>
          <label>
            Assumptions as of
            <input
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
            />
          </label>
        </div>
        <div className="estimate-actions">
          {pilotFields.map((f) => (
            <label key={f.key}>
              {f.label}
              <input
                type="number"
                min="0"
                max={f.percent ? 100 : undefined}
                step={f.count ? 1 : "any"}
                value={values[f.key]}
                onChange={(e) =>
                  setValues({ ...values, [f.key]: e.target.value })
                }
              />
            </label>
          ))}
          <label>
            County share of situs recovery (%)
            <input
              type="number"
              min="0"
              max="100"
              step="any"
              placeholder="Unknown — county total withheld"
              value={share}
              onChange={(e) => setShare(e.target.value)}
            />
          </label>
          <label>
            Modeled case rounding
            <select
              value={rounding}
              onChange={(e) =>
                setRounding(e.target.value as PilotInputs["rounding"])
              }
            >
              <option value="nearest">Nearest whole case</option>
              <option value="expected">Fractional expected cases</option>
            </select>
          </label>
        </div>
        <p>
          TPP and license lead pools may overlap; billable leads are entered
          once. Their confirmation rates are independent. License fees apply
          once. Situs periods and allocation are assumptions that require
          verification.
        </p>
        {error && <p role="status">{error}</p>}
        {result && (
          <div aria-live="polite">
            <div className="table-scroll">
              <table>
                <caption>Pilot scenario by revenue stream</caption>
                <thead>
                  <tr>
                    <th>Stream</th>
                    <th>Modeled cases</th>
                    <th>Period / recipient</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">TPP</th>
                    <td>{number(result.tppCases)}</td>
                    <td>One year · county</td>
                    <td>{money(result.tpp)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Business license</th>
                    <td>{number(result.licenseCases)}</td>
                    <td>One-time fees · county</td>
                    <td>{money(result.license)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Situs lookback</th>
                    <td>{number(result.situsCases)}</td>
                    <td>
                      {values.lookbackYears} assumed years · all local
                      recipients
                    </td>
                    <td>{money(result.situsLookback)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Situs forward</th>
                    <td>{number(result.situsCases)}</td>
                    <td>
                      {values.forwardYears} assumed years · all local recipients
                    </td>
                    <td>{money(result.situsForward)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Pilot cost: <strong>{money(result.cost)}</strong>
            </p>
            <p>
              TPP + one-time license fees:{" "}
              <strong>{money(result.tppLicense)}</strong> · gross benefit/cost{" "}
              {multiple(result.tppLicenseMultiple)}
            </p>
            <p>
              Combined local scenario across stated periods:{" "}
              <strong>{money(result.combinedLocal)}</strong> · gross
              benefit/cost {multiple(result.combinedLocalMultiple)}
            </p>
            <p>
              County-attributable scenario:{" "}
              <strong>{currency(result.countyTotal)}</strong> · gross
              benefit/cost {multiple(result.countyMultiple)}
            </p>
            <p className="muted">
              Combined local recovery includes city recipients and mixes the
              explicitly stated periods. A gross benefit/cost multiple is not a
              net ROI or a county-only annual return. No back-year TPP or
              recurring license fees are inferred from business age.
            </p>
          </div>
        )}
        <button
          disabled={!result}
          onClick={() =>
            download(
              `civvix-${item.slug}-pilot-scenario.json`,
              JSON.stringify(
                {
                  ...packet,
                  result,
                  exportedAt: new Date().toISOString(),
                  notice:
                    "Planning scenario only. Verify cohorts, applicable periods, jurisdiction allocation and procurement separately.",
                },
                null,
                2,
              ),
              "application/json",
            )
          }
        >
          Export pilot scenario
        </button>
      </div>
    </details>
  );
}
