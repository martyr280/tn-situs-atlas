export type QueueRecord = {
  id: string;
  legacyId: string;
  name: string;
  source: string;
  address: string;
  flag: string;
  score: number | null;
  seam: number | null;
  lon: number;
  lat: number;
  situs: string;
  complete: boolean;
};
export type CatalogItem = {
  kind: "counties" | "cities";
  slug: string;
  name: string;
  county?: string;
  counties?: string[];
  biz: number;
  rooftops: number;
  cc: number;
  br: number;
  pe: number;
  sst?: number;
  sources: Record<string, string>;
  generated: string | null;
  coverage: {
    queue: number;
    complete: number;
    pointOnly: number;
    boundaryDisplayed: number;
    boundaryTotal: number | null;
  };
};
export type Meta = {
  name: string;
  slug: string;
  kind: string;
  situsNames: Record<string, string>;
  summary: Record<string, unknown>;
  sources: Record<string, string>;
  coverage: CatalogItem["coverage"];
  homes: string[];
};
export type Evidence = Record<string, string | number | boolean | null>;
export type Review = {
  status: string;
  note: string;
  updatedAt: string;
  revision: string;
  snapshot: string;
  history: { status: string; at: string }[];
};
export const statuses = [
  "Open",
  "In review",
  "Confirmed exception",
  "Not an exception",
  "Submitted to DOR",
  "DOR corrected",
];
export const reasons: Record<string, string> = {
  CROSS_COUNTY_POSTAL: "Cross-county postal",
  BOUNDARY_RISK: "Near a boundary",
  POSTAL_CITY_EXPOSURE: "Postal-city exposure",
  CLEAR: "No exposure flag",
  CODED_MISMATCH: "Coded ≠ measured",
};
export const descriptions: Record<string, string> = {
  CROSS_COUNTY_POSTAL:
    "The postal address names another county. This is a reason to verify the registered jurisdiction, not proof of miscoding.",
  BOUNDARY_RISK:
    "This location is close to a jurisdictional seam. Verify placement and boundary precision before drawing a conclusion.",
  POSTAL_CITY_EXPOSURE:
    "The mailing city differs from the polygon jurisdiction. Mailing addresses do not establish tax jurisdiction.",
  CLEAR:
    "No exposure flag is present in this public-data snapshot. This does not establish that the taxpayer registration is correct.",
  CODED_MISMATCH:
    "The session roster code differs from the measured polygon code. An analyst must verify the match and evidence.",
};
export const number = (v: number | null | undefined) =>
  v == null ? "Unavailable" : v.toLocaleString("en-US");
export const title = (s: string) =>
  s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
export const money = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);
export function download(name: string, content: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function reviewKey(id: string, snapshot: string) {
  return `civvix.review.v1.${snapshot}.${id}`;
}
export function saveReview(
  storage: Pick<Storage, "getItem" | "setItem">,
  key: string,
  review: Review,
  expected: string | null,
) {
  const old = storage.getItem(key);
  const current = old ? (JSON.parse(old) as Review) : null;
  if ((current?.revision ?? null) !== expected)
    throw Error(
      "This review changed in another tab. Reload the saved review before saving.",
    );
  storage.setItem(key, JSON.stringify(review));
}
export type FlowRow = {
  jurisdiction: string;
  slug?: string;
  county?: string;
  counties?: string[];
  [key: string]: unknown;
};
export function scenario(
  row: FlowRow,
  tiers: string,
  incoming: number,
  outgoing: number,
  growth: number,
  kind: string,
  verification: Record<string, { verdict: string }>,
) {
  const homes = row.counties || [row.county || row.jurisdiction];
  if (
    kind !== "counties" &&
    !homes.every((c) => verification[c]?.verdict.startsWith("REAL"))
  )
    return null;
  const sum = (prefix: string) =>
    [...tiers].reduce((n, t) => n + Number(row[prefix + t] || 0), 0);
  const received = ((sum("owed_val_") * incoming) / 100) * growth,
    ceded = ((sum("err_val_") * outgoing) / 100) * growth;
  return { received, ceded, net: received - ceded };
}
