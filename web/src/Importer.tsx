import { useEffect, useRef, useState } from "react";
import {
  FileUp,
  ArrowRight,
  ShieldCheck,
  Trash2,
  X,
  CheckCircle2,
} from "lucide-react";
import { useData } from "./data";
import { number, type QueueRecord } from "./model";
import type { MatchResult } from "./matching";
export default function Importer({
  records,
  onApply,
  onClear,
  applied,
}: {
  records: QueueRecord[];
  onApply: (r: MatchResult[]) => void;
  onClear: () => void;
  applied: boolean;
}) {
  const codes = useData<string[]>("/data/codes.json");
  const [text, setText] = useState(""),
    [rows, setRows] = useState<string[][]>([]),
    [mapping, setMapping] = useState([-1, -1, -1]),
    [results, setResults] = useState<MatchResult[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [page, setPage] = useState(0);
  const worker = useRef<Worker | null>(null),
    fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => worker.current?.terminate(), []);
  function run(mode: "parse" | "match") {
    setError("");
    if (!codes.data) {
      setError("The situs directory is not ready. Please retry.");
      return;
    }
    if (mode === "parse" && new Blob([text]).size > 10 * 1024 * 1024) {
      setError(
        "Use a CSV of 10 MB or less for this browser workflow. Split a larger roster into separate files.",
      );
      return;
    }
    worker.current?.terminate();
    const w = new Worker(new URL("./import.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.current = w;
    setBusy(true);
    w.onmessage = (e) => {
      setBusy(false);
      if (e.data.error) setError(e.data.error);
      else if (mode === "parse") {
        const parsed = e.data.rows as string[][];
        if (parsed.length < 2) {
          setError("Include a header row and at least one record.");
          return;
        }
        if (parsed.some((r) => r.length !== parsed[0].length)) {
          setError(
            "CSV rows have different column counts. Check commas and quoted fields.",
          );
          return;
        }
        setRows(parsed);
        setResults([]);
        setMapping(
          [/business|name/i, /address|physical|location/i, /situs|juris/i].map(
            (re) => parsed[0].findIndex((h) => re.test(h)),
          ),
        );
      } else {
        setResults(e.data.results);
        setPage(0);
      }
      w.terminate();
    };
    w.onerror = () => {
      setBusy(false);
      setError(
        "The file could not be processed. Your current session was not changed.",
      );
      w.terminate();
    };
    w.postMessage(
      mode === "parse"
        ? { mode, text }
        : { mode, rows: rows.slice(1), mapping, records, codes: codes.data },
    );
  }
  const totals = results.reduce(
    (a, r) => ({ ...a, [r.state]: (a[r.state] || 0) + 1 }),
    {} as Record<string, number>,
  );
  const matched = results.filter((r) => r.state === "matched");
  const clear = () => {
    worker.current?.terminate();
    setBusy(false);
    setText("");
    setRows([]);
    setResults([]);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
    onClear();
  };
  return (
    <section className="panel importer">
      <div className="panel-heading">
        <div className="eyebrow">BROWSER-ONLY COMPARISON</div>
        <h2>Bring the roster to the evidence.</h2>
        <p>
          Choose a CSV, check the columns, then review the matches before
          applying them to this session.
        </p>
      </div>
      <div className="import-steps">
        {["Choose CSV", "Map & validate", "Review matches"].map((s, i) => (
          <span
            key={s}
            className={
              (results.length ? 2 : rows.length ? 1 : 0) === i ? "active" : ""
            }
          >
            <b>{i + 1}</b>
            {s}
          </span>
        ))}
      </div>
      <div className="notice">
        <ShieldCheck size={19} />
        <span>
          Roster contents remain in this tab’s memory and are cleared on reload.
          Reviews are saved separately on this device. No roster values are sent
          to a server.
        </span>
      </div>
      {applied && (
        <p className="badge teal">
          A roster is already applied to this session.
        </p>
      )}
      <div className="import-input">
        <label className="file-drop">
          <FileUp size={30} />
          <strong>Choose a CSV file</strong>
          <span>UTF-8, header row, up to 10 MB · or paste below</span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            aria-label="Choose roster CSV"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 10 * 1024 * 1024) {
                setError("This file exceeds the 10 MB limit.");
                return;
              }
              setText(await f.text());
              setRows([]);
              setResults([]);
            }}
          />
        </label>
        <label>
          Or paste CSV
          <textarea
            rows={6}
            value={text}
            aria-label="Paste roster CSV"
            placeholder={
              "business_name,physical_address,situs\nExample Company,123 MAIN ST LEBANON 37087,9501"
            }
            onChange={(e) => {
              setText(e.target.value);
              setRows([]);
              setResults([]);
            }}
          />
        </label>
      </div>
      <div className="button-row">
        <button
          className="primary"
          disabled={!text.trim() || busy || !codes.data}
          onClick={() => run("parse")}
        >
          Read CSV <ArrowRight size={16} />
        </button>
        <button onClick={clear}>
          <Trash2 size={16} />
          Clear imported data
        </button>
        {busy && (
          <button
            onClick={() => {
              worker.current?.terminate();
              setBusy(false);
              setError("Processing canceled. Nothing was applied.");
            }}
          >
            <X size={16} />
            Cancel processing
          </button>
        )}
      </div>
      {busy && (
        <p role="status">
          Processing locally… You can cancel without changing the workspace.
        </p>
      )}
      {(error || codes.error) && (
        <div role="alert" className="notice error">
          {error || codes.error}
          {codes.error && (
            <button onClick={codes.retry}>Retry code directory</button>
          )}
        </div>
      )}
      {rows.length > 0 && (
        <section className="import-mapping">
          <h3>Confirm the column mapping</h3>
          <p>
            {number(rows.length - 1)} input rows. All three fields must map to
            different columns.
          </p>
          <div className="three-fields">
            {[
              "Business name",
              "Full physical address",
              "Four-digit situs code",
            ].map((label, i) => (
              <label key={label}>
                {label}
                <select
                  value={mapping[i]}
                  onChange={(e) => {
                    setMapping((v) =>
                      v.map((n, j) => (j === i ? +e.target.value : n)),
                    );
                    setResults([]);
                  }}
                >
                  <option value={-1}>Choose a column</option>
                  {rows[0].map((h, j) => (
                    <option key={j} value={j}>
                      {h || `Column ${j + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="table-scroll">
            <table>
              <caption>Preview of the first three rows</caption>
              <thead>
                <tr>
                  {rows[0].map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1, 4).map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td key={j}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="primary"
            disabled={
              busy || mapping.some((n) => n < 0) || new Set(mapping).size < 3
            }
            onClick={() => run("match")}
          >
            Validate & match <ArrowRight size={16} />
          </button>
        </section>
      )}
      {results.length > 0 && (
        <section className="import-results">
          <h3>Review the results</h3>
          <div className="workspace-stats">
            {["matched", "ambiguous", "unmatched", "invalid"].map((k) => (
              <div key={k}>
                <span>{k[0].toUpperCase() + k.slice(1)}</span>
                <strong>{number(totals[k] || 0)}</strong>
              </div>
            ))}
          </div>
          <p>
            {number(results.length)} rows accounted for ·{" "}
            {number(matched.length)} unique businesses matched ·{" "}
            {number(matched.filter((r) => r.mismatch).length)} potential coding
            mismatches
          </p>
          <div className="notice">
            <span>
              Matching requires a unique normalized business name and full
              address. Resolve ambiguous, duplicate, unmatched or invalid rows
              in the CSV and run again. Only verified matches will be applied;
              mismatches still require analyst review.
            </span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>CSV row</th>
                  <th>Business</th>
                  <th>Outcome</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {results.slice(page * 25, (page + 1) * 25).map((r) => (
                  <tr key={r.row}>
                    <td>{r.row}</td>
                    <th scope="row">{r.name}</th>
                    <td>
                      <span
                        className={
                          "badge " + (r.state === "matched" ? "teal" : "amber")
                        }
                      >
                        {r.state}
                      </span>
                    </td>
                    <td>{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span>
              {page * 25 + 1}–{Math.min(results.length, (page + 1) * 25)} of{" "}
              {results.length}
            </span>
            <button
              disabled={(page + 1) * 25 >= results.length}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
          <button
            className="primary"
            disabled={!matched.length}
            onClick={() => onApply(results)}
          >
            <CheckCircle2 size={17} />
            Apply {matched.length} verified matches to this session
          </button>
        </section>
      )}
    </section>
  );
}
