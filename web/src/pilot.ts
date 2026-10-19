export type PilotInputs = {
  tppLeads: number;
  licenseLeads: number;
  tppPerCase: number;
  collectionPercent: number;
  licenseFee: number;
  situsFlagged: number;
  situsPerLocation: number;
  lookbackYears: number;
  forwardYears: number;
  situsCost: number;
  leadUnitCost: number;
  billableLeads: number;
  tppHitPercent: number;
  licenseHitPercent: number;
  situsHitPercent: number;
  countySharePercent: number | null;
  rounding: "nearest" | "expected";
};
export type PilotFile = {
  schemaVersion: 1;
  kind: "pilot-scenario";
  jurisdiction: string;
  asOf: string;
  source: string;
  inputs: PilotInputs;
};
export const pilotFields: {
  key: Exclude<keyof PilotInputs, "rounding" | "countySharePercent">;
  label: string;
  count?: boolean;
  percent?: boolean;
}[] = [
  { key: "tppLeads", label: "TPP screening leads", count: true },
  { key: "licenseLeads", label: "License screening leads", count: true },
  { key: "tppPerCase", label: "Annual TPP tax per confirmed case ($)" },
  { key: "collectionPercent", label: "TPP collection rate (%)", percent: true },
  { key: "licenseFee", label: "One-time license fee per confirmed case ($)" },
  { key: "tppHitPercent", label: "TPP confirmation rate (%)", percent: true },
  {
    key: "licenseHitPercent",
    label: "License confirmation rate (%)",
    percent: true,
  },
  { key: "situsFlagged", label: "Situs flagged locations", count: true },
  {
    key: "situsPerLocation",
    label: "Annual local tax per situs correction ($)",
  },
  {
    key: "situsHitPercent",
    label: "Situs confirmation rate (%)",
    percent: true,
  },
  { key: "lookbackYears", label: "Assumed situs lookback years", count: true },
  { key: "forwardYears", label: "Assumed situs forward years", count: true },
  { key: "situsCost", label: "One-time situs service cost ($)" },
  { key: "billableLeads", label: "Distinct billable leads", count: true },
  { key: "leadUnitCost", label: "Price per billable lead ($)" },
];
export function validatePilot(value: unknown): PilotFile {
  const d = value as PilotFile;
  if (
    !d ||
    d.schemaVersion !== 1 ||
    d.kind !== "pilot-scenario" ||
    typeof d.jurisdiction !== "string" ||
    !/^[a-z0-9_-]+$/.test(d.jurisdiction) ||
    typeof d.source !== "string" ||
    !d.source.trim()
  )
    throw Error("Pilot file needs a jurisdiction and an assumption source.");
  if (
    typeof d.asOf !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(d.asOf) ||
    !Number.isFinite(Date.parse(d.asOf)) ||
    new Date(d.asOf).toISOString().slice(0, 10) !== d.asOf
  )
    throw Error("Provide a valid assumption date (YYYY-MM-DD).");
  validatePilotInputs(d.inputs);
  return d;
}
function validatePilotInputs(p: PilotInputs) {
  if (!p || !["nearest", "expected"].includes(p.rounding))
    throw Error("Choose a supported case rounding method.");
  for (const f of pilotFields) {
    const n = p[f.key];
    if (
      typeof n !== "number" ||
      !Number.isFinite(n) ||
      n < 0 ||
      n > Number.MAX_SAFE_INTEGER ||
      (f.count && !Number.isSafeInteger(n)) ||
      (f.percent && n > 100)
    )
      throw Error(`Invalid ${f.label.toLowerCase()}.`);
  }
  if (
    p.countySharePercent !== null &&
    (typeof p.countySharePercent !== "number" ||
      !Number.isFinite(p.countySharePercent) ||
      p.countySharePercent < 0 ||
      p.countySharePercent > 100)
  )
    throw Error("County share must be blank or from 0 to 100.");
  if (p.lookbackYears + p.forwardYears === 0)
    throw Error("Include at least one situs scenario year.");
}
export function pilotScenario(p: PilotInputs) {
  validatePilotInputs(p);
  const cases = (n: number, rate: number) =>
    p.rounding === "nearest" ? Math.round((n * rate) / 100) : (n * rate) / 100;
  const tppCases = cases(p.tppLeads, p.tppHitPercent),
    licenseCases = cases(p.licenseLeads, p.licenseHitPercent),
    situsCases = cases(p.situsFlagged, p.situsHitPercent);
  const tpp = (tppCases * p.tppPerCase * p.collectionPercent) / 100;
  const license = licenseCases * p.licenseFee;
  const situsAnnual = situsCases * p.situsPerLocation;
  const situsLookback = situsAnnual * p.lookbackYears,
    situsForward = situsAnnual * p.forwardYears;
  const situsLocal = situsLookback + situsForward;
  const cost = p.situsCost + p.billableLeads * p.leadUnitCost;
  const tppLicense = tpp + license;
  const combinedLocal = tppLicense + situsLocal;
  const countySitus =
    p.countySharePercent === null
      ? null
      : (situsLocal * p.countySharePercent) / 100;
  const countyTotal = countySitus === null ? null : tppLicense + countySitus;
  const ratio = (v: number | null) =>
    v === null || cost === 0 ? null : v / cost;
  const r = {
    tppCases,
    licenseCases,
    situsCases,
    tpp,
    license,
    situsAnnual,
    situsLookback,
    situsForward,
    situsLocal,
    cost,
    tppLicense,
    combinedLocal,
    countySitus,
    countyTotal,
    tppLicenseMultiple: ratio(tppLicense),
    combinedLocalMultiple: ratio(combinedLocal),
    countyMultiple: ratio(countyTotal),
  };
  if (Object.values(r).some((n) => n !== null && !Number.isFinite(n)))
    throw Error("Scenario exceeds supported numeric range.");
  return r;
}
