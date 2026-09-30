export type Metric = { value: number; period: string; source: string };
export type TppBenchmark = {
  tax_year: number;
  returns_received: number;
  total_tpp_collected: number;
  source_note: string;
};
export type EstimateInput = {
  kind: "counties" | "cities";
  slug: string;
  month: string;
  status: "reported-baseline" | "reconciled";
  population: Metric;
  tppFiled?: Metric;
  tppBenchmarks?: TppBenchmark[];
  licensed?: Metric;
  ucc?: Metric;
  note: string;
};
export type EstimateSnapshot = { schemaVersion: 1; records: EstimateInput[] };
export type Assumptions = {
  confirmation: number;
  amount: number;
  collection: number;
};
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
export function validateSnapshot(input: unknown): EstimateSnapshot {
  if (!input || typeof input !== "object")
    throw Error("Expected a snapshot object.");
  const data = input as EstimateSnapshot;
  if (data.schemaVersion !== 1 || !Array.isArray(data.records))
    throw Error("Unsupported estimate snapshot.");
  const keys = new Set<string>();
  for (const r of data.records) {
    if (
      !r ||
      !["counties", "cities"].includes(r.kind) ||
      typeof r.slug !== "string" ||
      !/^[a-z0-9_-]+$/.test(r.slug) ||
      !monthPattern.test(r.month)
    )
      throw Error("Invalid jurisdiction or snapshot month.");
    if (
      !["reported-baseline", "reconciled"].includes(r.status) ||
      typeof r.note !== "string" ||
      !r.note.trim()
    )
      throw Error("Each record needs a status and scope note.");
    const key = `${r.kind}/${r.slug}/${r.month}`;
    if (keys.has(key)) throw Error(`Duplicate estimate: ${key}`);
    keys.add(key);
    if (!r.population) throw Error(`Missing population: ${key}`);
    for (const name of ["population", "tppFiled", "licensed", "ucc"] as const) {
      const metric = r[name];
      if (
        metric !== undefined &&
        (!metric ||
          !Number.isSafeInteger(metric.value) ||
          metric.value < 0 ||
          typeof metric.period !== "string" ||
          !metric.period.trim() ||
          typeof metric.source !== "string" ||
          !metric.source.trim())
      )
        throw Error(`Invalid ${name} count or provenance: ${key}`);
    }
    if (r.tppBenchmarks !== undefined) {
      if (!Array.isArray(r.tppBenchmarks))
        throw Error("TPP benchmarks must be an array.");
      const years = new Set<number>();
      for (const b of r.tppBenchmarks) {
        if (
          !b ||
          !Number.isInteger(b.tax_year) ||
          b.tax_year < 1900 ||
          b.tax_year > 9999 ||
          !Number.isSafeInteger(b.returns_received) ||
          b.returns_received < 0 ||
          !Number.isFinite(b.total_tpp_collected) ||
          b.total_tpp_collected < 0 ||
          b.total_tpp_collected > Number.MAX_SAFE_INTEGER ||
          typeof b.source_note !== "string" ||
          !b.source_note.trim()
        )
          throw Error("Invalid TPP benchmark or missing provenance.");
        if (years.has(b.tax_year)) throw Error("Duplicate TPP benchmark year.");
        years.add(b.tax_year);
      }
    }
    if (
      r.kind === "cities" &&
      (r.tppFiled !== undefined || r.tppBenchmarks !== undefined)
    )
      throw Error("City snapshots must not contain county TPP counts.");
  }
  return data;
}
export function estimate(
  population: number,
  filed: number | undefined,
  assumptions: Assumptions,
) {
  if (filed === undefined) return null;
  if (
    ![population, filed].every((v) => Number.isSafeInteger(v) && v >= 0) ||
    !Object.values(assumptions).every(Number.isFinite) ||
    assumptions.confirmation < 0 ||
    assumptions.confirmation > 100 ||
    assumptions.collection < 0 ||
    assumptions.collection > 100 ||
    assumptions.amount < 0
  )
    throw Error(
      "Use nonnegative counts and amounts, and percentages from 0 to 100.",
    );
  const difference = population - filed;
  const screeningGap = Math.max(0, difference);
  const modeledCases = (screeningGap * assumptions.confirmation) / 100;
  const annualRevenue =
    (modeledCases * assumptions.amount * assumptions.collection) / 100;
  if (!Number.isFinite(annualRevenue))
    throw Error("Scenario exceeds supported numeric range.");
  return { difference, screeningGap, modeledCases, annualRevenue };
}

/** County-level methodology aligned with the recovery app's countyOpportunity model.
 * The latest return count drives the gap; the newest three loaded years drive the weighted value.
 * A capture rate already scales annual opportunity; no second collection multiplier is applied.
 */
export function tppOpportunity(
  population: number,
  benchmarks: TppBenchmark[],
  capturePercent = 25,
) {
  if (
    !Number.isSafeInteger(population) ||
    population < 0 ||
    !Number.isFinite(capturePercent) ||
    capturePercent < 0 ||
    capturePercent > 100
  )
    throw Error("Capture rate must be from 0 to 100.");
  const years = [...benchmarks]
    .sort((a, b) => b.tax_year - a.tax_year)
    .slice(0, 3);
  if (!years.length) return null;
  const totalReturns = years.reduce((n, b) => n + b.returns_received, 0);
  const totalCollected = years.reduce((n, b) => n + b.total_tpp_collected, 0);
  const averageReturnValue =
    totalReturns > 0 ? totalCollected / totalReturns : null;
  const averageAnnualReturns = totalReturns / years.length;
  const difference = population - years[0].returns_received;
  const screeningGap = Math.max(0, difference);
  const annualOpportunity =
    averageReturnValue === null ? null : screeningGap * averageReturnValue;
  const annualRecovery =
    annualOpportunity === null
      ? null
      : annualOpportunity * (capturePercent / 100);
  if (annualRecovery !== null && !Number.isFinite(annualRecovery))
    throw Error("Scenario exceeds supported numeric range.");
  return {
    years,
    latestYear: years[0].tax_year,
    latestReturns: years[0].returns_received,
    averageAnnualReturns,
    averageReturnValue,
    difference,
    screeningGap,
    coverage: population > 0 ? years[0].returns_received / population : null,
    annualOpportunity,
    capturePercent,
    annualRecovery,
  };
}
