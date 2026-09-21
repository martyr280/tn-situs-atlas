import { lazy, Suspense, useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  MapPinned,
  LayoutDashboard,
  Building2,
  Landmark,
  ChartNoAxesCombined,
  Database,
  Search,
  ShieldCheck,
  ChevronRight,
  Menu,
  X,
  SlidersHorizontal,
  Download,
  Info,
  Layers,
} from "lucide-react";
import { useData } from "./data";
import {
  number,
  title,
  download,
  money,
  scenario,
  type CatalogItem,
  type FlowRow,
} from "./model";
const Workspace = lazy(() => import("./Workspace"));
export type Release = {
  snapshotId: string;
  countyCount: number;
  cityCount: number;
  totals: Record<string, number>;
  sourceGeneratedFrom: string;
  sourceGeneratedTo: string;
};
export function DataState({
  error,
  retry,
}: {
  error?: string;
  retry?: () => void;
}) {
  return (
    <div className="empty" role={error ? "alert" : "status"}>
      <Database size={28} />
      <h2>{error ? "Data unavailable" : "Loading the atlas…"}</h2>
      <p>{error || "Preparing your jurisdiction data."}</p>
      {error && <button onClick={retry}>Try again</button>}
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title: heading,
  children,
  action,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{heading}</h1>
        {children && <p>{children}</p>}
      </div>
      {action}
    </div>
  );
}
const nav = [
  ["/", "Overview", LayoutDashboard],
  ["/counties", "Counties", Landmark],
  ["/cities", "Cities", Building2],
  ["/scenarios", "Revenue scenarios", ChartNoAxesCombined],
  ["/sources", "Sources & methodology", Database],
] as const;
export default function App() {
  const catalog = useData<CatalogItem[]>("/data/catalog.json"),
    release = useData<Release>("/data/release.json");
  const [menu, setMenu] = useState(false),
    [query, setQuery] = useState("");
  const navigate = useNavigate(),
    location = useLocation();
  useEffect(() => {
    setMenu(false);
    document.title =
      "Civvix · " +
      (nav.find(([p]) => p !== "/" && location.pathname.startsWith(p))?.[1] ||
        "Tennessee Situs Atlas");
  }, [location.pathname]);
  return (
    <div className="app">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <aside className={"sidebar " + (menu ? "open" : "")}>
        <Link className="brand" to="/" aria-label="Civvix overview">
          <span className="brand-mark">C</span>civvix
          <span className="brand-dot">.</span>
        </Link>
        <div className="workspace-label">TENNESSEE SITUS ATLAS</div>
        <nav aria-label="Main navigation">
          {nav.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === "/"}>
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="source-pill">
            <span />
            Public data workspace
          </div>
          <p>
            Better evidence.
            <br />
            More confident decisions.
          </p>
          <div className="profile">
            <span>TN</span>
            <div>
              Tennessee<span>95 counties · one view</span>
            </div>
          </div>
        </div>
      </aside>
      {menu && (
        <button
          className="scrim"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="app-main">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label={menu ? "Close navigation" : "Open navigation"}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <strong>Tennessee</strong>
          </div>
          <form
            className="global-search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate("/counties?q=" + encodeURIComponent(query));
            }}
          >
            <Search size={16} />
            <input
              aria-label="Find a county"
              placeholder="Find a county…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd>↵</kbd>
          </form>
          <span className="version">
            PUBLIC DATA <span>•</span>{" "}
            {release.data?.sourceGeneratedTo?.slice(0, 10) || "Snapshot"}
          </span>
        </header>
        <main id="main" tabIndex={-1}>
          {!catalog.data || !release.data ? (
            <DataState
              error={catalog.error || release.error}
              retry={() => {
                catalog.retry();
                release.retry();
              }}
            />
          ) : (
            <Suspense fallback={<DataState />}>
              <Routes>
                <Route
                  path="/"
                  element={
                    <Overview catalog={catalog.data} release={release.data} />
                  }
                />
                <Route
                  path="/counties"
                  element={<Directory catalog={catalog.data} kind="counties" />}
                />
                <Route
                  path="/cities"
                  element={<Directory catalog={catalog.data} kind="cities" />}
                />
                <Route
                  path="/counties/:slug/*"
                  element={
                    <Workspace
                      key={location.pathname.split("/").slice(0, 3).join("/")}
                      catalog={catalog.data}
                      release={release.data}
                      kind="counties"
                    />
                  }
                />
                <Route
                  path="/cities/:slug/*"
                  element={
                    <Workspace
                      key={location.pathname.split("/").slice(0, 3).join("/")}
                      catalog={catalog.data}
                      release={release.data}
                      kind="cities"
                    />
                  }
                />
                <Route path="/scenarios" element={<Scenarios />} />
                <Route
                  path="/sources"
                  element={
                    <Sources catalog={catalog.data} release={release.data} />
                  }
                />
                <Route
                  path="/flows/*"
                  element={<Navigate to="/scenarios" replace />}
                />
                <Route
                  path="/:legacy/*"
                  element={<Legacy catalog={catalog.data} />}
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          )}
        </main>
      </div>
    </div>
  );
}
function Legacy({ catalog }: { catalog: CatalogItem[] }) {
  const slug = useLocation().pathname.split("/")[1];
  return catalog.some((c) => c.kind === "counties" && c.slug === slug) ? (
    <Navigate replace to={"/counties/" + slug} />
  ) : (
    <NotFound />
  );
}
export function NotFound() {
  return (
    <div className="page empty">
      <h1>Jurisdiction not found</h1>
      <p>Choose a county or city from the atlas.</p>
      <Link className="button primary" to="/counties">
        Browse counties
      </Link>
    </div>
  );
}
function Stat({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Landmark;
}) {
  return (
    <div className="stat-card">
      <div>
        {label}
        <Icon size={18} />
      </div>
      <strong>{value}</strong>
      <span>{detail}</span>
    </div>
  );
}
function Overview({
  catalog,
  release,
}: {
  catalog: CatalogItem[];
  release: Release;
}) {
  const counties = catalog.filter((c) => c.kind === "counties");
  const ranked = [...counties].sort((a, b) => b.cc - a.cc).slice(0, 5);
  return (
    <div className="page">
      <PageHeading
        eyebrow="THE STATEWIDE PICTURE"
        title="Clarity starts with the right location."
        action={
          <Link className="button primary" to="/counties">
            Explore counties <ArrowUpRight size={17} />
          </Link>
        }
      >
        A boundary-first view of Tennessee’s tax jurisdictions. Find the
        signals. Follow the evidence.
      </PageHeading>
      <div className="stats">
        <Stat
          label="Counties represented"
          value={number(release.countyCount)}
          detail="Statewide public-data coverage"
          icon={Landmark}
        />
        <Stat
          label="Rooftops placed"
          value={number(release.totals.rooftops)}
          detail="Located in DOR situs polygons"
          icon={MapPinned}
        />
        <Stat
          label="Business points"
          value={number(release.totals.biz)}
          detail="Statewide index snapshot"
          icon={Building2}
        />
        <Stat
          label="Cross-county exposure"
          value={number(release.totals.cc)}
          detail="Postal signals awaiting verification"
          icon={Layers}
        />
      </div>
      <div className="overview-grid">
        <section className="panel map-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">95 COUNTIES. ONE CONNECTED VIEW.</span>
              <h2>Explore Tennessee</h2>
            </div>
            <span className="badge teal">Public data</span>
          </div>
          <StateMap counties={counties} />
          <div className="map-caption">
            <span>
              <i className="swatch" />
              Cross-county postal exposure
            </span>
            <span>
              Lower <i className="gradient" /> Higher
            </span>
          </div>
          <div className="panel-foot">
            <span>Select a county to open its workspace.</span>
            <Link to="counties">
              View all counties <ArrowRight size={15} />
            </Link>
          </div>
        </section>
        <section className="panel priorities">
          <div className="panel-heading">
            <div className="eyebrow">WHERE TO LOOK FIRST</div>
            <h2>Priority counties</h2>
            <p>Ranked by cross-county postal signals</p>
          </div>
          {ranked.map((c, i) => (
            <Link className="priority" to={"/counties/" + c.slug} key={c.slug}>
              <span className="rank">0{i + 1}</span>
              <div>
                <strong>{title(c.name)}</strong>
                <div className="bar">
                  <i
                    style={{
                      width: Math.max(6, (c.cc / ranked[0].cc) * 100) + "%",
                    }}
                  />
                </div>
              </div>
              <span>
                {number(c.cc)}
                <ArrowUpRight size={16} />
              </span>
            </Link>
          ))}
          <div className="priority-note">
            <Info size={16} />
            <span>
              Exposure identifies where to look. It does not establish a coding
              error.
            </span>
          </div>
        </section>
      </div>
      <div className="section-heading">
        <div>
          <span className="eyebrow">FROM SIGNAL TO UNDERSTANDING</span>
          <h2>Your next step</h2>
        </div>
        <Link to="sources">
          How the atlas works <ArrowRight size={15} />
        </Link>
      </div>
      <div className="next-grid">
        {[
          {
            to: "/counties/wilson/review",
            n: "01",
            title: "Review the evidence",
            body: "Move from a business location to the sources behind its jurisdiction.",
            icon: MapPinned,
          },
          {
            to: "/scenarios",
            n: "02",
            title: "Explore revenue scenarios",
            body: "See both directions of potential revenue movement, with assumptions in view.",
            icon: ChartNoAxesCombined,
          },
          {
            to: "/sources",
            n: "03",
            title: "Understand your data",
            body: "Check source coverage, snapshot dates and what still needs verification.",
            icon: ShieldCheck,
          },
        ].map((x) => (
          <Link className="next-card" key={x.to} to={x.to}>
            <div>
              <x.icon size={23} />
              <span>{x.n}</span>
            </div>
            <h3>{x.title}</h3>
            <p>{x.body}</p>
            <ArrowUpRight className="next-arrow" size={20} />
          </Link>
        ))}
      </div>
      <footer className="page-foot">
        Civvix · Tennessee Situs Atlas
        <span>
          Snapshot {release.snapshotId.slice(0, 8)} · Public-data analysis, not
          taxpayer coding
        </span>
      </footer>
    </div>
  );
}
function StateMap({ counties }: { counties: CatalogItem[] }) {
  const { data, error, retry } = useData<{
    w: number;
    h: number;
    counties: Record<string, { d: string; cx: number; cy: number }>;
  }>("/data/county-paths.json");
  const [hover, setHover] = useState<string | null>(null);
  const navigate = useNavigate();
  if (!data) return <DataState error={error} retry={retry} />;
  const max = Math.max(...counties.map((c) => c.cc));
  return (
    <div className="state-map">
      <div className="map-watermark">TENNESSEE</div>
      <svg
        viewBox={`-20 -50 ${data.w + 40} ${data.h + 100}`}
        role="group"
        aria-label="Tennessee counties, shaded by cross-county postal exposure"
      >
        {counties.map((c) => {
          const p = data.counties[c.name.replace(/\s+/g, "")];
          if (!p) return null;
          const scale = c.cc / max;
          return (
            <path
              key={c.slug}
              d={p.d}
              fill={
                hover === c.name
                  ? "#112c2b"
                  : `hsl(157 ${20 + scale * 18}% ${88 - scale * 55}%)`
              }
              stroke="#fff"
              strokeWidth="1.7"
              tabIndex={0}
              role="link"
              aria-label={`${title(c.name)} County, ${number(c.cc)} cross-county postal signals`}
              onMouseEnter={() => setHover(c.name)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(c.name)}
              onBlur={() => setHover(null)}
              onClick={() => navigate("/counties/" + c.slug)}
              onKeyDown={(e) => {
                if (e.key === "Enter") navigate("/counties/" + c.slug);
              }}
            >
              <title>
                {title(c.name)} · {number(c.cc)} postal signals
              </title>
            </path>
          );
        })}
      </svg>
      <span className="map-hover">
        {hover ? title(hover) + " County" : "Public boundaries. Local insight."}
      </span>
    </div>
  );
}
function Directory({
  catalog,
  kind,
}: {
  catalog: CatalogItem[];
  kind: "counties" | "cities";
}) {
  const [params, set] = useSearchParams();
  const query = params.get("q") || "",
    sort = params.get("sort") || "name";
  const [selected, choose] = useState<string[]>([]);
  const rows = catalog
    .filter(
      (c) =>
        c.kind === kind &&
        `${c.name} ${c.counties?.join(" ") || ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : Number(b[sort as keyof CatalogItem] || 0) -
          Number(a[sort as keyof CatalogItem] || 0),
    );
  function patch(key: string, v: string) {
    set(
      (p) => {
        if (v) p.set(key, v);
        else p.delete(key);
        return p;
      },
      { replace: true },
    );
  }
  return (
    <div className="page">
      <PageHeading
        eyebrow="JURISDICTION DIRECTORY"
        title={
          kind === "counties"
            ? "Every county. A clearer picture."
            : "A closer look at Tennessee’s cities."
        }
      >
        {kind === "counties"
          ? "Find a county, compare exposure and open the review workspace."
          : "Explore city boundaries, including jurisdictions that span multiple counties."}
      </PageHeading>
      <div className="panel">
        <div className="directory-tools">
          <label className="search-control">
            <Search size={18} />
            <input
              aria-label={"Search " + kind}
              value={query}
              placeholder={"Search " + kind + "…"}
              onChange={(e) => patch("q", e.target.value)}
            />
          </label>
          <label className="sort-control">
            <SlidersHorizontal size={16} />
            <span>Sort by</span>
            <select
              value={sort}
              onChange={(e) => patch("sort", e.target.value)}
            >
              <option value="name">Name</option>
              <option value="cc">Cross-county exposure</option>
              <option value="biz">Businesses</option>
              <option value="br">Boundary risk</option>
            </select>
          </label>
          <span className="muted">
            {rows.length} {kind}
          </span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Compare</th>
                <th scope="col">{kind === "counties" ? "County" : "City"}</th>
                <th scope="col" className="numeric">
                  Businesses
                </th>
                <th scope="col" className="numeric">
                  Cross-county postal
                </th>
                <th scope="col" className="numeric">
                  Boundary risk
                </th>
                <th scope="col">Coverage</th>
                <th scope="col">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.slug}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={"Compare " + title(c.name)}
                      checked={selected.includes(c.slug)}
                      disabled={
                        !selected.includes(c.slug) && selected.length === 3
                      }
                      onChange={(e) =>
                        choose(
                          e.target.checked
                            ? [...selected, c.slug]
                            : selected.filter((s) => s !== c.slug),
                        )
                      }
                    />
                  </td>
                  <th scope="row">
                    <Link to={`/${kind}/${c.slug}`}>{title(c.name)}</Link>
                    {c.counties && (
                      <small>{c.counties.map(title).join(" · ")}</small>
                    )}
                  </th>
                  <td className="numeric">{number(c.biz)}</td>
                  <td className="numeric">{number(c.cc)}</td>
                  <td className="numeric">{number(c.br)}</td>
                  <td>
                    <span
                      className={
                        "badge " +
                        (c.sst != null && c.sst < 60 ? "amber" : "neutral")
                      }
                    >
                      {kind === "counties"
                        ? `${number(c.sst)}${c.sst != null ? "% range match" : ""}`
                        : `${c.coverage.complete} detailed records`}
                    </span>
                  </td>
                  <td>
                    <Link
                      className="icon-link"
                      to={`/${kind}/${c.slug}`}
                      aria-label={"Open " + title(c.name)}
                    >
                      <ArrowUpRight size={17} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <div className="empty">
            <h2>No jurisdictions match</h2>
            <button onClick={() => patch("q", "")}>Clear search</button>
          </div>
        )}
        <div className="panel-foot">
          Counts reflect the index snapshot. Workbench coverage may differ.
          <Link to="/sources">
            About coverage <ArrowRight size={15} />
          </Link>
        </div>
      </div>
      {selected.length > 0 && (
        <section className="panel compare">
          <div className="panel-heading">
            <h2>Compare jurisdictions</h2>
            <button onClick={() => choose([])}>Clear comparison</button>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Measure</th>
                  {selected.map((s) => (
                    <th key={s}>
                      {title(
                        catalog.find((c) => c.kind === kind && c.slug === s)!
                          .name,
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["biz", "Business points"],
                  ["cc", "Cross-county postal"],
                  ["br", "Boundary risk"],
                  ["pe", "Postal-city exposure"],
                  ["rooftops", "Rooftops placed"],
                ].map(([key, label]) => (
                  <tr key={key}>
                    <th scope="row">{label}</th>
                    {selected.map((s) => (
                      <td key={s}>
                        {number(
                          Number(
                            catalog.find(
                              (c) => c.kind === kind && c.slug === s,
                            )![key as keyof CatalogItem],
                          ),
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
function Scenarios() {
  const f = useData<{
    counties: FlowRow[];
    treasuries: FlowRow[];
    cities: FlowRow[];
    verification: Record<string, { verdict: string }>;
    valuation: { fiscal_year: string; source_url: string };
    totals: Record<string, unknown>;
  }>("/data/flows.json");
  const [incoming, setIn] = useState(10),
    [outgoing, setOut] = useState(10),
    [growth, setGrowth] = useState(1),
    [tiers, setTiers] = useState("AB"),
    [kind, setKind] = useState<"counties" | "treasuries" | "cities">(
      "counties",
    ),
    [q, setQ] = useState("");
  if (!f.data) return <DataState error={f.error} retry={f.retry} />;
  const data = f.data;
  const rows = data[kind].filter((r) =>
    r.jurisdiction.toLowerCase().includes(q.toLowerCase()),
  );
  const results = rows.map((row) => ({
    row,
    value: scenario(
      row,
      tiers,
      incoming,
      outgoing,
      growth,
      kind,
      data.verification,
    ),
  }));
  const totals = results.reduce(
    (a, r) => ({
      received: a.received + (r.value?.received || 0),
      ceded: a.ceded + (r.value?.ceded || 0),
    }),
    { received: 0, ceded: 0 },
  );
  return (
    <div className="page">
      <PageHeading
        eyebrow="MODEL THE POSSIBILITIES"
        title="Revenue moves in both directions."
        action={
          <button
            onClick={() =>
              download(
                "civvix-scenario.json",
                JSON.stringify(
                  {
                    assumptions: {
                      incoming,
                      outgoing,
                      growth,
                      tiers,
                      kind,
                      filter: q,
                      fiscalYear: data.valuation.fiscal_year,
                    },
                    results,
                    notice: "Modeled scenario, not realized recovery.",
                  },
                  null,
                  2,
                ),
                "application/json",
              )
            }
          >
            <Download size={17} />
            Export scenario
          </button>
        }
      >
        Explore potential movement using explicit assumptions. These are
        scenarios, not realized recoveries.
      </PageHeading>
      <div className="notice">
        <Info size={18} />
        <span>
          Public-data signals do not establish taxpayer miscoding. City and
          treasury dollars remain withheld unless all contributing counties pass
          the existing verification gate.
        </span>
      </div>
      <div className="panel scenario-controls">
        <label>
          Incoming correction rate <strong>{incoming}%</strong>
          <input
            aria-label="Incoming correction rate slider"
            type="range"
            min="0"
            max="50"
            value={incoming}
            onChange={(e) => setIn(+e.target.value)}
          />
          <input
            aria-label="Incoming correction rate percent"
            type="number"
            min="0"
            max="50"
            value={incoming}
            onChange={(e) => setIn(Math.max(0, Math.min(50, +e.target.value)))}
          />
        </label>
        <label>
          Outgoing correction rate <strong>{outgoing}%</strong>
          <input
            aria-label="Outgoing correction rate slider"
            type="range"
            min="0"
            max="50"
            value={outgoing}
            onChange={(e) => setOut(+e.target.value)}
          />
          <input
            aria-label="Outgoing correction rate percent"
            type="number"
            min="0"
            max="50"
            value={outgoing}
            onChange={(e) => setOut(Math.max(0, Math.min(50, +e.target.value)))}
          />
        </label>
        <label>
          Included evidence tiers
          <select value={tiers} onChange={(e) => setTiers(e.target.value)}>
            <option value="A">Tier A</option>
            <option value="AB">Tiers A + B</option>
            <option value="ABC">Tiers A + B + C</option>
          </select>
          <small>
            Assumed priors: A 90% · B 60% · C 25%. Not measured probabilities.
          </small>
        </label>
        <label>
          Growth multiplier
          <input
            aria-label="Growth multiplier"
            type="number"
            min="0.5"
            max="2"
            step="0.01"
            value={growth}
            onChange={(e) =>
              setGrowth(Math.max(0.5, Math.min(2, +e.target.value)))
            }
          />
          <small>Baseline fiscal year: {data.valuation.fiscal_year}</small>
          <button
            onClick={() => {
              setIn(10);
              setOut(10);
              setGrowth(1);
              setTiers("AB");
            }}
          >
            Reset assumptions
          </button>
        </label>
      </div>
      <div className="stats three">
        <Stat
          label="Potential incoming / year"
          value={money(totals.received)}
          detail="For the filtered, eligible jurisdictions"
          icon={ArrowUpRight}
        />
        <Stat
          label="Potential outgoing / year"
          value={money(totals.ceded)}
          detail="Correction by neighboring jurisdictions"
          icon={ArrowUpRight}
        />
        <Stat
          label="Net scenario / year"
          value={money(totals.received - totals.ceded)}
          detail="Incoming minus outgoing; not a forecast"
          icon={ChartNoAxesCombined}
        />
      </div>
      <section className="panel">
        <div className="directory-tools">
          <label>
            View
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              <option value="counties">Cross-county flows</option>
              <option value="treasuries">County treasuries</option>
              <option value="cities">Cities</option>
            </select>
          </label>
          <label className="search-control">
            <Search size={17} />
            <input
              aria-label="Filter scenario jurisdictions"
              placeholder="Filter jurisdictions…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Jurisdiction</th>
                <th className="numeric">Potential incoming</th>
                <th className="numeric">Potential outgoing</th>
                <th className="numeric">Net scenario</th>
              </tr>
            </thead>
            <tbody>
              {results.map(({ row, value }, i) => (
                <tr key={i}>
                  <th scope="row">
                    {title(row.jurisdiction)}
                    <small>
                      {row.counties?.map(title).join(" · ") ||
                        (row.county && title(row.county))}
                    </small>
                  </th>
                  {value ? (
                    <>
                      <td className="numeric">{money(value.received)}</td>
                      <td className="numeric">{money(value.ceded)}</td>
                      <td className="numeric">
                        <strong>{money(value.net)}</strong>
                      </td>
                    </>
                  ) : (
                    <td colSpan={3}>Withheld · source verification required</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <details className="panel methodology">
        <summary>How the calculation works</summary>
        <p>
          For each selected tier, sum the existing model’s annual incoming and
          outgoing value bases. Multiply each by its respective correction rate
          and the growth multiplier. Net is incoming minus outgoing. No
          additional confidence multiplier is applied to this scenario, matching
          the original model.
        </p>
        <p>
          Evidence priors describe model assumptions; they are not empirically
          measured coding-error rates. County averages are proxies, not
          individual business tax payments. Jurisdiction corrections can
          redistribute the same dollars; do not sum overlapping county, treasury
          and city views.
        </p>
        <a href={data.valuation.source_url} target="_blank" rel="noreferrer">
          Open the baseline collections source <ArrowUpRight size={14} />
        </a>
      </details>
    </div>
  );
}
function Sources({
  catalog,
  release,
}: {
  catalog: CatalogItem[];
  release: Release;
}) {
  return (
    <div className="page">
      <PageHeading
        eyebrow="TRANSPARENCY BY DESIGN"
        title="Know what is behind the evidence."
      >
        Dates, coverage and limitations belong alongside every decision.
      </PageHeading>
      <div className="notice">
        <ShieldCheck size={19} />
        <span>
          This workspace uses public data. Imported DOR rosters stay in browser
          session memory. Reviews and notes are saved on this device only; they
          are not shared with other analysts.
        </span>
      </div>
      <div className="next-grid">
        <section className="panel methodology">
          <h2>One versioned release</h2>
          <p>
            Dataset <code>{release.snapshotId}</code>
          </p>
          <p>
            County workbench generation dates:{" "}
            {release.sourceGeneratedFrom?.slice(0, 10)} to{" "}
            {release.sourceGeneratedTo?.slice(0, 10)}.
          </p>
          <p>
            A new frontend deployment is not a new source-data refresh. Source
            effective dates may be unavailable; retrieval dates are listed
            below.
          </p>
        </section>
        <section className="panel methodology">
          <h2>Geography first</h2>
          <p>
            Situs is the tax jurisdiction assigned to a location. Distances come
            from the existing full-precision Python analysis in Tennessee State
            Plane coordinates.
          </p>
          <p>
            Display polygons are simplified. Postal cities are delivery labels,
            not legal jurisdiction assignments.
          </p>
        </section>
        <section className="panel methodology">
          <h2>Evidence has limits</h2>
          <p>
            Point-only records lack the full evidence packet. A zero flag count
            is not proof that registrations are correct.
          </p>
          <p>
            Statewide index counts and workbench snapshots can differ. Review
            populations are displayed separately and never silently reconciled.
          </p>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>County source coverage</h2>
          <p>
            Dates below are recorded source snapshot dates, not a guarantee of
            current boundaries.
          </p>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>County</th>
                <th>DOR boundaries</th>
                <th>911 addresses</th>
                <th>Address ranges</th>
                <th>Workbench records</th>
                <th>Point-only</th>
              </tr>
            </thead>
            <tbody>
              {catalog
                .filter((c) => c.kind === "counties")
                .map((c) => (
                  <tr key={c.slug}>
                    <th scope="row">
                      <Link to={"/counties/" + c.slug}>{title(c.name)}</Link>
                    </th>
                    <td>
                      {c.sources.dor_tax_rate_boundaries || "Not recorded"}
                    </td>
                    <td>{c.sources.ng911_address_points || "Not recorded"}</td>
                    <td>{c.sources.sst_address_lookup || "Not recorded"}</td>
                    <td>{number(c.coverage.queue)}</td>
                    <td>{number(c.coverage.pointOnly)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
      <details className="panel methodology">
        <summary>Review definitions and safeguards</summary>
        <p>
          Exposure: a public-data reason to investigate. Potential mismatch: an
          imported roster code differs from a matched location. Confirmed
          exception: analyst-reviewed evidence with a recorded reason. DOR
          corrected: documented correction recorded by the analyst.
        </p>
        <p>
          Recording a status never submits information to DOR. Copying or
          downloading a packet is an explicit local export. Notes may contain
          sensitive information: use only an authorized device and clear or
          export reviews according to your organization’s policy.
        </p>
      </details>
    </div>
  );
}
