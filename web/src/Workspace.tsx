import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useBlocker,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Search,
  Map,
  LayoutList,
  Download,
  FileUp,
  Check,
  Info,
  X,
  ChevronLeft,
  ChevronRight,
  Save,
  Copy,
} from "lucide-react";
import { DataState, NotFound, PageHeading, type Release } from "./App";
import { useData } from "./data";
import {
  descriptions,
  download,
  number,
  reasons,
  reviewKey,
  saveReview,
  statuses,
  title,
  type CatalogItem,
  type Evidence,
  type Meta,
  type QueueRecord,
  type Review,
} from "./model";
import type { MatchResult } from "./matching";
const MapView = lazy(() => import("./MapView"));
const Importer = lazy(() => import("./Importer"));
export default function Workspace({
  catalog,
  release,
  kind,
}: {
  catalog: CatalogItem[];
  release: Release;
  kind: "counties" | "cities";
}) {
  const { slug } = useParams();
  const item = catalog.find((c) => c.kind === kind && c.slug === slug);
  const [params, setParams] = useSearchParams(),
    navigate = useNavigate();
  const base = `/data/${kind}/${slug}`;
  const meta = useData<Meta>(item ? base + "/meta.json" : null),
    queue = useData<QueueRecord[]>(item ? base + "/queue.json" : null);
  const [mode, setMode] = useState<"list" | "map" | "import">("list"),
    [roster, setRoster] = useState<MatchResult[]>([]),
    [reviews, setReviews] = useState<Record<string, Review>>({}),
    [storageError, setStorageError] = useState(""),
    [reviewsLoaded, setReviewsLoaded] = useState(false),
    [page, setPage] = useState(0),
    [dirty, setDirty] = useState(false);
  const evidenceHeading = useRef<HTMLHeadingElement>(null);
  const selected = params.get("record") || "",
    q = params.get("q") || "",
    flag = params.get("reason") || "ALL",
    status = params.get("status") || "ALL",
    completeness = params.get("detail") || "ALL",
    sort = params.get("sort") || "score";
  const selectedRef = useRef(selected);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      (currentLocation.pathname !== nextLocation.pathname ||
        new URLSearchParams(currentLocation.search).get("record") !==
          new URLSearchParams(nextLocation.search).get("record")),
  );
  useEffect(() => {
    if (blocker.state === "blocked") {
      if (window.confirm("Discard unsaved changes to this review?")) {
        setDirty(false);
        blocker.proceed();
      } else blocker.reset();
    }
  }, [blocker]);
  useEffect(() => {
    function before(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);
  useEffect(() => {
    if (!queue.data) return;
    try {
      const all: Record<string, Review> = {};
      const validIds = new Set(queue.data.map((r) => r.id)),
        prefix = `civvix.review.v1.${release.snapshotId}.`;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix)) {
          const id = key.slice(prefix.length);
          if (validIds.has(id)) {
            const s = localStorage.getItem(key);
            if (s) all[id] = JSON.parse(s);
          }
        }
      }
      setReviews(all);
    } catch {
      setStorageError("Saved reviews could not be loaded from this device.");
    } finally {
      setReviewsLoaded(true);
    }
  }, [queue.data, release.snapshotId]);
  const matchMap = useMemo(
    () =>
      Object.fromEntries(
        roster
          .filter((r) => r.state === "matched" && r.id)
          .map((r) => [r.id!, r]),
      ),
    [roster],
  );
  const rows = useMemo(() => {
    return (queue.data || [])
      .filter(
        (r) =>
          (!q ||
            `${r.name} ${r.address}`.toLowerCase().includes(q.toLowerCase())) &&
          (flag === "ALL" ||
            (matchMap[r.id]?.mismatch ? "CODED_MISMATCH" : r.flag) === flag) &&
          (status === "ALL" || (reviews[r.id]?.status || "Open") === status) &&
          (completeness === "ALL" || r.complete === (completeness === "full")),
      )
      .sort((a, b) =>
        sort === "name"
          ? a.name.localeCompare(b.name)
          : sort === "seam"
            ? (a.seam ?? Infinity) - (b.seam ?? Infinity)
            : (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name),
      );
  }, [queue.data, q, flag, status, completeness, sort, reviews, matchMap]);
  useEffect(() => setPage(0), [q, flag, status, completeness, sort]);
  const record = queue.data?.find((r) => r.id === selected);
  const detail = useData<Record<string, Evidence>>(
    record?.complete ? `${base}/evidence/${record.id.slice(0, 1)}.json` : null,
  );
  function safe() {
    if (!dirty) return true;
    return window.confirm("Discard unsaved changes to this review?");
  }
  function select(id: string) {
    setParams((p) => {
      if (id) p.set("record", id);
      else p.delete("record");
      return p;
    });
  }
  useEffect(() => {
    if (selected !== selectedRef.current) {
      selectedRef.current = selected;
      evidenceHeading.current?.focus();
    }
  }, [selected]);
  function filter(k: string, v: string) {
    setParams(
      (p) => {
        v ? p.set(k, v) : p.delete(k);
        return p;
      },
      { replace: true },
    );
  }
  if (!item) return <NotFound />;
  if (!meta.data || !queue.data || !reviewsLoaded)
    return (
      <DataState
        error={meta.error || queue.error}
        retry={() => {
          meta.retry();
          queue.retry();
        }}
      />
    );
  const currentIndex = rows.findIndex((r) => r.id === selected),
    m = meta.data;
  const pageRows = rows.slice(page * 40, page * 40 + 40);
  const flagged = queue.data.filter((r) => r.flag !== "CLEAR").length;
  return (
    <div className="page workspace-page">
      <Link className="back-link" to={"/" + kind}>
        <ArrowLeft size={15} />
        All {kind}
      </Link>
      <PageHeading
        eyebrow={kind === "cities" ? "CITY WORKSPACE" : "COUNTY WORKSPACE"}
        title={title(item.name) + (kind === "counties" ? " County" : "")}
        action={
          <button
            onClick={() => {
              if (safe()) {
                setDirty(false);
                setMode("import");
              }
            }}
          >
            <FileUp size={17} />
            Compare a roster
          </button>
        }
      >
        {m.homes.map(title).join(" · ")} · {number(item.rooftops)} rooftops in
        the index · Review storage: this device only
      </PageHeading>
      <div className="workspace-stats">
        <div>
          <span>Workbench businesses</span>
          <strong>{number(queue.data.length)}</strong>
        </div>
        <div>
          <span>Exposure signals</span>
          <strong>{number(flagged)}</strong>
        </div>
        <div>
          <span>Full evidence records</span>
          <strong>{number(m.coverage.complete)}</strong>
        </div>
        <div>
          <span>Point-only records</span>
          <strong>{number(m.coverage.pointOnly)}</strong>
        </div>
      </div>
      {item.biz !== queue.data.length && (
        <div className="coverage-note">
          <Info size={15} />
          The statewide/city index lists {number(item.biz)} businesses. This
          workbench contains {number(queue.data.length)} reviewable records.
          Source scopes or snapshots differ; totals are not interchangeable.
        </div>
      )}
      <div className="workspace-toolbar">
        <div className="segmented" aria-label="Workspace view">
          {[
            ["list", "Review queue", LayoutList],
            ["map", "Map & evidence", Map],
            ["import", "Roster comparison", FileUp],
          ].map(([key, label, Icon]) => {
            const I = Icon as typeof Map;
            return (
              <button
                key={String(key)}
                aria-pressed={mode === key}
                onClick={() => {
                  if (safe()) {
                    setDirty(false);
                    setMode(key as typeof mode);
                  }
                }}
              >
                <I size={16} />
                {String(label)}
              </button>
            );
          })}
        </div>
        <span className="badge neutral">
          {roster.length
            ? "Roster applied to this session"
            : "Public-data exposure"}
        </span>
      </div>
      {storageError && (
        <div role="alert" className="notice error">
          {storageError}
        </div>
      )}
      {mode === "import" ? (
        <Suspense fallback={<DataState />}>
          <Importer
            records={queue.data}
            onApply={(r) => {
              setRoster(r);
              setMode("list");
              filter("reason", "CODED_MISMATCH");
            }}
            onClear={() => {
              setRoster([]);
              filter("reason", "ALL");
            }}
            applied={roster.length > 0}
          />
        </Suspense>
      ) : (
        <>
          <div className="review-filters">
            <label className="search-control">
              <Search size={17} />
              <input
                aria-label="Search businesses"
                placeholder="Search business or street…"
                value={q}
                onChange={(e) => filter("q", e.target.value)}
              />
            </label>
            <label>
              Reason
              <select
                value={flag}
                onChange={(e) => filter("reason", e.target.value)}
              >
                <option value="ALL">All reasons</option>
                {Object.entries(reasons).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={(e) => filter("status", e.target.value)}
              >
                <option value="ALL">Any status</option>
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Evidence
              <select
                value={completeness}
                onChange={(e) => filter("detail", e.target.value)}
              >
                <option value="ALL">All records</option>
                <option value="full">Full evidence</option>
                <option value="point">Point-only</option>
              </select>
            </label>
            <label>
              Sort
              <select
                value={sort}
                onChange={(e) => filter("sort", e.target.value)}
              >
                <option value="score">Evidence score ↓</option>
                <option value="seam">Boundary distance ↑</option>
                <option value="name">Business name</option>
              </select>
            </label>
            <button
              onClick={() => {
                setParams((p) => {
                  ["q", "reason", "status", "detail", "sort"].forEach((k) =>
                    p.delete(k),
                  );
                  return p;
                });
              }}
            >
              Clear filters
            </button>
          </div>
          <div
            className={
              "review-layout " +
              (record ? "with-evidence" : "") +
              " " +
              (mode === "map" ? "map-mode" : "")
            }
          >
            <section
              className="panel queue-panel"
              aria-label="Business review queue"
            >
              <div className="queue-heading">
                <strong>{number(rows.length)} matching records</strong>
                <span>Exposure is not a finding</span>
              </div>
              <div className="record-list">
                {pageRows.map((r) => (
                  <button
                    className={
                      "record-row " + (r.id === selected ? "selected" : "")
                    }
                    key={r.id}
                    onClick={() => select(r.id)}
                    aria-pressed={r.id === selected}
                  >
                    <div className="record-top">
                      <strong>{r.name}</strong>
                      <span className="score-value">{r.score ?? "—"}</span>
                    </div>
                    <span className="record-address">
                      {r.address ||
                        "Physical address not included in this record"}
                    </span>
                    <div className="record-bottom">
                      <span
                        className={
                          "badge " +
                          (matchMap[r.id]?.mismatch
                            ? "red"
                            : r.flag === "CLEAR"
                              ? "neutral"
                              : "amber")
                        }
                      >
                        {reasons[
                          matchMap[r.id]?.mismatch ? "CODED_MISMATCH" : r.flag
                        ] || r.flag}
                      </span>
                      <span>
                        {r.complete
                          ? r.seam == null
                            ? "Distance unavailable"
                            : number(r.seam) + " ft"
                          : "Point-only"}
                      </span>
                    </div>
                    <span className="record-status">
                      {reviews[r.id]?.status || "Open"}
                    </span>
                  </button>
                ))}
              </div>
              {!rows.length && (
                <div className="empty">
                  <h2>No matching records</h2>
                  <p>
                    Try changing the filters. A zero result is not a clean
                    audit.
                  </p>
                </div>
              )}
              <div className="pagination">
                <button
                  aria-label="Previous results page"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft size={17} />
                </button>
                <span>
                  {rows.length
                    ? `${page * 40 + 1}–${Math.min(rows.length, (page + 1) * 40)} of ${number(rows.length)}`
                    : "0 records"}
                </span>
                <button
                  aria-label="Next results page"
                  disabled={(page + 1) * 40 >= rows.length}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </section>
            {mode === "map" && (
              <section className="panel map-workspace">
                <Suspense fallback={<DataState />}>
                  <MapView
                    base={base}
                    records={rows}
                    selected={selected}
                    onSelect={select}
                    names={m.situsNames}
                  />
                </Suspense>
              </section>
            )}
            {record ? (
              <section className="panel evidence-panel">
                <div className="evidence-nav">
                  <button onClick={() => select("")}>
                    <ArrowLeft size={15} />
                    Back to results
                  </button>
                  <div>
                    <button
                      aria-label="Previous business"
                      disabled={currentIndex <= 0}
                      onClick={() => select(rows[currentIndex - 1].id)}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      aria-label="Next business"
                      disabled={
                        currentIndex < 0 || currentIndex >= rows.length - 1
                      }
                      onClick={() => select(rows[currentIndex + 1].id)}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
                <h2
                  ref={evidenceHeading}
                  tabIndex={-1}
                  className="evidence-name"
                >
                  {record.name}
                </h2>
                <EvidencePanel
                  key={record.id}
                  record={record}
                  evidence={detail.data?.[record.id]}
                  loading={record.complete && !detail.data}
                  error={detail.error}
                  retry={detail.retry}
                  meta={m}
                  release={release}
                  saved={reviews[record.id]}
                  match={matchMap[record.id]}
                  onDirty={setDirty}
                  onSave={(r) => setReviews((v) => ({ ...v, [record.id]: r }))}
                />
              </section>
            ) : (
              mode === "list" && (
                <section className="panel evidence-placeholder">
                  <Map size={40} />
                  <span className="eyebrow">FOLLOW THE EVIDENCE</span>
                  <h2>Every location tells a story.</h2>
                  <p>
                    Select a business to compare jurisdictions, inspect the
                    source evidence and record your review.
                  </p>
                  <div className="notice">
                    <Info size={17} />
                    Public-data exposure is a starting point. A roster and
                    analyst review establish the next step.
                  </div>
                </section>
              )
            )}
          </div>
          {selected && !record && (
            <div className="notice error">
              This record is not in the current snapshot. Choose a record from
              the queue.
            </div>
          )}
        </>
      )}
    </div>
  );
}
function EvidencePanel({
  record,
  evidence,
  loading,
  error,
  retry,
  meta,
  release,
  saved,
  match,
  onDirty,
  onSave,
}: {
  record: QueueRecord;
  evidence?: Evidence;
  loading: boolean;
  error: string;
  retry: () => void;
  meta: Meta;
  release: Release;
  saved?: Review;
  match?: MatchResult;
  onDirty: (v: boolean) => void;
  onSave: (v: Review) => void;
}) {
  const [status, setStatus] = useState(saved?.status || "Open"),
    [note, setNote] = useState(saved?.note || ""),
    [message, setMessage] = useState(""),
    [revision, setRevision] = useState(saved?.revision || null);
  const flag = match?.mismatch ? "CODED_MISMATCH" : record.flag;
  const noteRef = useRef(note);
  useEffect(() => {
    const d =
      status !== (saved?.status || "Open") || note !== (saved?.note || "");
    onDirty(d);
    noteRef.current = note;
  }, [status, note, saved, onDirty]);
  function save() {
    try {
      if (
        [
          "Confirmed exception",
          "Submitted to DOR",
          "DOR corrected",
          "Not an exception",
        ].includes(status) &&
        note.trim().length < 10
      )
        throw Error(
          "Record the evidence and reason for this decision (at least 10 characters).",
        );
      if (
        !record.complete &&
        ["Confirmed exception", "Submitted to DOR", "DOR corrected"].includes(
          status,
        )
      )
        throw Error(
          "This point-only record lacks evidence. Obtain a full packet before confirming or submitting.",
        );
      const at = new Date().toISOString();
      const review: Review = {
        status,
        note,
        updatedAt: at,
        revision: crypto.randomUUID(),
        snapshot: release.snapshotId,
        history: [...(saved?.history || []), { status, at }],
      };
      saveReview(
        localStorage,
        reviewKey(record.id, release.snapshotId),
        review,
        revision,
      );
      setRevision(review.revision);
      onSave(review);
      onDirty(false);
      setMessage("Saved on this device.");
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Save failed. Your edits are still here.",
      );
    }
  }
  function packet() {
    return JSON.stringify(
      {
        business: record,
        evidence: evidence || "Point-only: detailed evidence unavailable",
        codedSitusFromSession: match?.code || null,
        review: { status, note },
        sources: meta.sources,
        snapshot: release.snapshotId,
        limitations: descriptions[flag],
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    );
  }
  return (
    <div className="evidence-body">
      <p className="muted">
        {record.address || "Address unavailable in this snapshot"}
      </p>
      <span className={"badge " + (match?.mismatch ? "red" : "amber")}>
        {reasons[flag]}
      </span>
      <p className="reason-text">{descriptions[flag]}</p>
      <div className="evidence-numbers">
        <div>
          <span>Evidence score</span>
          <strong>
            {record.score ?? "—"}
            <small> / 100</small>
          </strong>
        </div>
        <div>
          <span>Nearest seam</span>
          <strong>
            {record.seam == null ? "—" : number(record.seam)}
            <small> ft</small>
          </strong>
        </div>
      </div>
      {loading ? (
        <DataState error={error} retry={retry} />
      ) : (
        <>
          <h3>Jurisdiction comparison</h3>
          <dl className="key-values">
            <dt>Measured polygon</dt>
            <dd>
              {record.situs} ·{" "}
              {meta.situsNames[record.situs] || "Name unavailable"}
            </dd>
            <dt>Coded situs</dt>
            <dd>{match ? match.code : "Roster not loaded / not matched"}</dd>
            <dt>DOR address file</dt>
            <dd>
              {evidence?.sst_situs
                ? `${evidence.sst_situs} · ${evidence.sst_city || ""}`
                : "No range evidence available"}
            </dd>
            <dt>911 authority</dt>
            <dd>{String(evidence?.e911_muni || "Unavailable")}</dd>
            <dt>Comptroller</dt>
            <dd>{String(evidence?.comp_city || "Unavailable")}</dd>
            <dt>Postal city</dt>
            <dd>
              {String(evidence?.post_city || "Unavailable")} (delivery label)
            </dd>
            <dt>Seam sides</dt>
            <dd>
              {evidence?.seam_a && evidence?.seam_b
                ? `${evidence.seam_a} / ${evidence.seam_b}`
                : "Unavailable"}
            </dd>
            <dt>Address match</dt>
            <dd>
              {evidence?.addr_match_ft != null
                ? `${evidence.addr_match_ft} ft`
                : "Unavailable"}
            </dd>
            <dt>Coordinate</dt>
            <dd>
              {record.lat}, {record.lon}
            </dd>
          </dl>
          {!record.complete && (
            <div className="notice">
              Point-only record. Full analysis fields were not included in the
              source export.
            </div>
          )}
          <details className="evidence-details">
            <summary>Score breakdown & provenance</summary>
            <p>
              {String(evidence?.score_notes || "No detailed score available.")}
            </p>
            <p>
              P: polygon · A: address point · L: layer agreement · R:
              address-range match · B: business proximity · C: address current ·
              I: parcel ID. Negative adjustments can include seam proximity,
              conflicting layers and mailing-only addresses.
            </p>
            <p>Source: {record.source}</p>
            {Object.entries(meta.sources).map(([s, d]) => (
              <p key={s}>
                {s.replaceAll("_", " ")}: {d}
              </p>
            ))}
            <p>
              Snapshot {release.snapshotId}. Display geometry is simplified;
              distances come from the source analysis.
            </p>
          </details>
        </>
      )}
      <div className="review-form">
        <h3>Your review</h3>
        <p className="small muted">
          Saved locally on this browser and device. Notes are not shared.
          Recording a status does not submit anything to DOR.
        </p>
        <label>
          Review status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Evidence and review notes
          <textarea
            rows={4}
            value={note}
            maxLength={4000}
            placeholder="What did you verify? What still needs a closer look?"
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <div className="save-actions">
          <button className="primary" onClick={save}>
            <Save size={16} />
            Save review
          </button>
          <button
            onClick={() => {
              try {
                const raw = localStorage.getItem(
                  reviewKey(record.id, release.snapshotId),
                );
                const latest = raw ? (JSON.parse(raw) as Review) : undefined;
                setStatus(latest?.status || "Open");
                setNote(latest?.note || "");
                setRevision(latest?.revision || null);
                if (latest) onSave(latest);
                setMessage("Loaded the saved review.");
              } catch {
                setMessage("Could not load saved review.");
              }
            }}
          >
            Reload saved
          </button>
        </div>
        <p className="save-message" role="status">
          {message ||
            (status !== (saved?.status || "Open") ||
            note !== (saved?.note || "")
              ? "Unsaved changes"
              : saved
                ? "Saved on this device"
                : "No saved review")}
        </p>
        {!!saved?.history?.length && (
          <details>
            <summary>Local review history ({saved.history.length})</summary>
            {saved.history.map((h, i) => (
              <p key={i}>
                {h.status} · {new Date(h.at).toLocaleString()}
              </p>
            ))}
          </details>
        )}
      </div>
      <div className="evidence-actions">
        <button
          disabled={loading}
          onClick={() =>
            download(
              `civvix-evidence-${record.id.slice(0, 8)}.json`,
              packet(),
              "application/json",
            )
          }
        >
          <Download size={16} />
          Export packet
        </button>
        <button
          disabled={loading}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(packet());
              setMessage("Evidence packet copied.");
            } catch {
              setMessage("Copy failed. Use Export packet instead.");
            }
          }}
        >
          <Copy size={16} />
          Copy
        </button>
      </div>
    </div>
  );
}
