import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const out = path.join(root, "web/public/data");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const digest = (s) => crypto.createHash("sha256").update(s).digest("hex");
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const index = read("site/data/statewide_index.json"),
  cities = read("site/data/cities_index.json");
const hashes = {},
  versions = [];
function write(file, data) {
  const s = JSON.stringify(data);
  fs.mkdirSync(path.dirname(path.join(out, file)), { recursive: true });
  fs.writeFileSync(path.join(out, file + ".gz"), gzipSync(s, { level: 6 }));
  hashes[file] = { sha256: digest(s), bytes: Buffer.byteLength(s) };
}
const catalog = [];
const codes = new Set();
const routes = [
  ...index.counties.map((c) => ({
    kind: "counties",
    ...c,
    name: c.county,
    dir: c.slug,
  })),
  ...cities.cities.map((c) => ({
    kind: "cities",
    ...c,
    name: c.city,
    dir: "cities/" + c.slug,
  })),
];
for (const item of routes) {
  const file = path.join(root, "site", item.dir, "wbdata.js");
  if (!fs.existsSync(file)) throw Error("Missing jurisdiction " + item.dir);
  const raw = fs.readFileSync(file, "utf8");
  if (!raw.startsWith("window.WB=")) throw Error("Unsupported payload " + file);
  const w = JSON.parse(raw.slice("window.WB=".length).trim().replace(/;$/, ""));
  Object.keys(w.situs_names).forEach((c) => codes.add(c));
  const fields = w.biz_fields;
  const minimal = w.biz_min_fields || [];
  const full = w.biz
    .map((row) => Object.fromEntries(fields.map((k, i) => [k, row[i]])))
    .filter((b) => b.kind === "business");
  const minis = (w.biz_min || []).map((row) => ({
    ...Object.fromEntries(minimal.map((k, i) => [k, row[i]])),
    kind: "business",
    flag: null,
  }));
  const details = {};
  const queue = [];
  const ids = new Set();
  for (const [records, complete] of [
    [full, true],
    [minis, false],
  ])
    for (const b of records) {
      const key = digest(
        JSON.stringify([
          b.source,
          String(b.id).replace(/^[a-z]{3}-/, ""),
          b.business,
          b.lon,
          b.lat,
        ]),
      ).slice(0, 24);
      if (ids.has(key)) continue;
      ids.add(key);
      const q = {
        id: key,
        legacyId: String(b.id),
        name: b.business || "Unnamed business",
        source: b.source,
        address: complete
          ? [b.house_no, b.street, b.unit, b.post_city, b.zip]
              .filter((v) => v != null && v !== "")
              .join(" ")
          : "",
        flag: b.flag || "CLEAR",
        score: b.score ?? null,
        seam: b.seam_ft ?? null,
        lon: b.lon,
        lat: b.lat,
        situs: b.dor_situs,
        complete,
      };
      queue.push(q);
      if (complete) details[key] = b;
    }
  const prefix = item.kind + "/" + item.slug;
  // Shard details by hash so opening one record never requires the full evidence universe.
  const shards = {};
  for (const [id, b] of Object.entries(details)) {
    const k = id.slice(0, 1);
    (shards[k] ??= {})[id] = b;
  }
  for (const [shard, records] of Object.entries(shards))
    write(prefix + "/evidence/" + shard + ".json", records);
  write(prefix + "/queue.json", queue);
  write(prefix + "/map.json", {
    situs: w.wilson_situs,
    neighbors: w.neighbors,
    seams: w.seams,
    roads: w.roads,
    annexations: w.annexations,
    band: w.band_pts,
  });
  const summary = w.summary || {},
    sources = summary.sources || {};
  if (summary.generated_utc) versions.push(summary.generated_utc);
  const coverage = {
    queue: queue.length,
    complete: queue.filter((b) => b.complete).length,
    pointOnly: queue.filter((b) => !b.complete).length,
    boundaryDisplayed: (w.band_pts || []).length,
    boundaryTotal: w.band_total ?? null,
  };
  write(prefix + "/meta.json", {
    name: item.name,
    slug: item.slug,
    kind: item.kind,
    situsNames: w.situs_names,
    summary,
    sources,
    coverage,
    homes: w.homes || item.counties || [item.name],
  });
  catalog.push({
    ...item,
    dir: undefined,
    coverage,
    generated: summary.generated_utc || null,
    sources,
  });
}
write("catalog.json", catalog);
write("statewide.json", index);
write("cities.json", cities);
write("flows.json", read("site/data/flows_index.json"));
write("county-paths.json", read("configs/tn_county_paths.json"));
write("codes.json", [...codes].sort());
const snapshot = digest(JSON.stringify(hashes)).slice(0, 16);
// Source dates remain separate from frontend/export timestamps.
write("manifest.json", {
  schemaVersion: 1,
  snapshotId: snapshot,
  sourceGeneratedFrom: versions.sort()[0] || null,
  sourceGeneratedTo: versions.at(-1) || null,
  countyCount: index.counties.length,
  cityCount: cities.cities.length,
  totals: index.totals,
  assets: hashes,
});
const versionDir = path.join(out, "snapshots", snapshot);
fs.mkdirSync(versionDir, { recursive: true });
for (const name of fs.readdirSync(out)) {
  if (name !== "snapshots")
    fs.renameSync(path.join(out, name), path.join(versionDir, name));
}
fs.writeFileSync(
  path.join(out, "release.json"),
  JSON.stringify({
    snapshotId: snapshot,
    schemaVersion: 1,
    countyCount: index.counties.length,
    cityCount: cities.cities.length,
    totals: index.totals,
    sourceGeneratedFrom: versions[0],
    sourceGeneratedTo: versions.at(-1),
  }),
);
console.log(
  `Validated export: ${index.counties.length} counties, ${cities.cities.length} cities; snapshot ${snapshot}; ${Object.keys(hashes).length} assets`,
);
