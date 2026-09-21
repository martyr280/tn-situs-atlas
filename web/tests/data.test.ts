import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import type { CatalogItem, QueueRecord } from "../src/model.ts";
const root = path.resolve(import.meta.dirname, "../..");
const release = JSON.parse(
  fs.readFileSync(path.join(root, "web/public/data/release.json"), "utf8"),
);
const base = path.join(root, "web/public/data/snapshots", release.snapshotId);
const data = (file: string) =>
  JSON.parse(
    gunzipSync(fs.readFileSync(path.join(base, file + ".gz"))).toString(),
  );
test("all 95 counties and 345 cities have consistent queue and evidence coverage", () => {
  const catalog = data("catalog.json") as CatalogItem[];
  assert.equal(catalog.filter((c) => c.kind === "counties").length, 95);
  assert.equal(catalog.filter((c) => c.kind === "cities").length, 345);
  for (const c of catalog) {
    const prefix = c.kind + "/" + c.slug;
    const q = data(prefix + "/queue.json") as QueueRecord[];
    assert.equal(q.length, c.coverage.queue, prefix);
    assert.equal(
      q.filter((x) => x.complete).length,
      c.coverage.complete,
      prefix,
    );
    assert.equal(new Set(q.map((x) => x.id)).size, q.length, prefix);
    const legacyFile = path.join(
      root,
      "site",
      c.kind === "cities" ? "cities/" + c.slug : c.slug,
      "wbdata.js",
    );
    const raw = fs.readFileSync(legacyFile, "utf8");
    const old = JSON.parse(
      raw.slice("window.WB=".length).trim().replace(/;$/, ""),
    );
    const kindIndex = old.biz_fields.indexOf("kind");
    assert.equal(
      q.length,
      old.biz.filter((r: unknown[]) => r[kindIndex] === "business").length +
        (old.biz_min || []).length,
      prefix + " no record loss",
    );
  }
});
test("statewide source totals preserved exactly", () => {
  assert.deepEqual(
    data("statewide.json"),
    JSON.parse(
      fs.readFileSync(
        path.join(root, "site/data/statewide_index.json"),
        "utf8",
      ),
    ),
  );
});
test("representative counties and multi-county city retain all original evidence fields", () => {
  for (const prefix of [
    "counties/wilson",
    "counties/davidson",
    "counties/lake",
    "counties/obion",
    "cities/ardmore",
  ]) {
    const q = data(prefix + "/queue.json") as QueueRecord[];
    const sample = q.find((x) => x.complete);
    if (!sample) continue;
    const detail = data(prefix + "/evidence/" + sample.id[0] + ".json")[
      sample.id
    ];
    const legacyPath = prefix.replace(/^counties\//, "");
    const source = fs.readFileSync(
      path.join(root, "site", legacyPath, "wbdata.js"),
      "utf8",
    );
    const original = JSON.parse(
      source.slice("window.WB=".length).trim().replace(/;$/, ""),
    );
    const idColumn = original.biz_fields.indexOf("id");
    const originalRow = original.biz.find(
      (row: unknown[]) => String(row[idColumn]) === sample.legacyId,
    );
    assert.ok(originalRow, prefix + " source record exists");
    assert.deepEqual(
      detail,
      Object.fromEntries(
        original.biz_fields.map((field: string, i: number) => [
          field,
          originalRow[i],
        ]),
      ),
    );
    assert.equal(detail.business, sample.name);
    assert.equal(detail.score, sample.score);
    assert.equal(detail.seam_ft, sample.seam);
    assert.equal(detail.dor_situs, sample.situs);
  }
});
test("manifest verifies representative asset hashes", () => {
  const manifest = data("manifest.json");
  for (const file of [
    "catalog.json",
    "flows.json",
    "counties/wilson/queue.json",
    "counties/davidson/map.json",
    "cities/ardmore/meta.json",
  ]) {
    const bytes = gunzipSync(fs.readFileSync(path.join(base, file + ".gz")));
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      manifest.assets[file].sha256,
    );
  }
});
