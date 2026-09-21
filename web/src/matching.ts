import type { QueueRecord } from "./model";
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (!quoted && cell.length)
        throw Error("Unexpected quote in CSV field.");
      else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw Error("Unclosed quoted field in CSV.");
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}
export const normalName = (v: string) =>
  v
    .toUpperCase()
    .replace(/\b(LLC|INC|CORP|LTD|PLLC|THE)\b/g, " ")
    .replace(/[^A-Z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const aliases: Record<string, string> = {
  ROAD: "RD",
  STREET: "ST",
  AVENUE: "AVE",
  DRIVE: "DR",
  LANE: "LN",
  COURT: "CT",
  BOULEVARD: "BLVD",
  HIGHWAY: "HWY",
  NORTH: "N",
  SOUTH: "S",
  EAST: "E",
  WEST: "W",
  MOUNT: "MT",
};
export const normalAddress = (v: string) =>
  v
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => aliases[t] || t)
    .join(" ");
export type MatchResult = {
  row: number;
  name: string;
  address: string;
  code: string;
  state: "matched" | "ambiguous" | "unmatched" | "invalid";
  reason: string;
  id?: string;
  mismatch?: boolean;
};
export function matchRoster(
  rows: string[][],
  mapping: number[],
  records: QueueRecord[],
  codes: string[],
): MatchResult[] {
  if (
    mapping.length !== 3 ||
    mapping.some((n) => n < 0) ||
    new Set(mapping).size !== 3
  )
    throw Error("Map three different columns before matching.");
  const valid = new Set(codes),
    index = new Map<string, QueueRecord[]>();
  for (const r of records) {
    const name = normalName(r.name);
    index.set(name, [...(index.get(name) || []), r]);
  }
  const result = rows.map((r, i): MatchResult => {
    const name = r[mapping[0]]?.trim() || "",
      address = r[mapping[1]]?.trim() || "",
      code = r[mapping[2]]?.trim() || "";
    const base = { row: i + 2, name, address, code };
    if (!name || !address || !/^\d{4}$/.test(code) || !valid.has(code))
      return {
        ...base,
        state: "invalid",
        reason: "Name, address and a valid four-digit situs code are required.",
      };
    const candidates = index.get(normalName(name)) || [];
    // Full normalized physical address is required. Incomplete or shortened addresses are held for review.
    const hits = candidates.filter(
      (c) => c.complete && normalAddress(c.address) === normalAddress(address),
    );
    if (hits.length === 1)
      return {
        ...base,
        state: "matched",
        id: hits[0].id,
        mismatch: code !== hits[0].situs,
        reason: "Unique normalized business name and full address agree.",
      };
    if (candidates.length)
      return {
        ...base,
        state: "ambiguous",
        reason:
          "Name found, but a unique full physical address could not be verified.",
      };
    return {
      ...base,
      state: "unmatched",
      reason: "No business name match in this snapshot.",
    };
  });
  const seen = new Map<string, MatchResult[]>();
  for (const r of result)
    if (r.id) seen.set(r.id, [...(seen.get(r.id) || []), r]);
  for (const group of seen.values())
    if (group.length > 1)
      for (const r of group) {
        r.state = "ambiguous";
        r.reason =
          "Duplicate or conflicting roster rows for one business; resolve before applying.";
        delete r.id;
        delete r.mismatch;
      }
  return result;
}
