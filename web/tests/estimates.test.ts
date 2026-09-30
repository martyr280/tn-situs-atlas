import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { estimate, validateSnapshot } from "../src/estimates.ts";
const baseline = JSON.parse(
  fs.readFileSync(
    new URL("./fixtures/estimates.json", import.meta.url),
    "utf8",
  ),
);
test("Screening gap, full precision scenario, missing counts and zero are distinct", () => {
  const r = estimate(1000, 400, {
    confirmation: 100,
    amount: 368.008,
    collection: 97.28,
  })!;
  assert.equal(r.screeningGap, 600);
  assert.ok(Math.abs(r.annualRevenue - 600 * 368.008 * 0.9728) < 0.000001);
  assert.equal(
    estimate(100, undefined, { confirmation: 10, amount: 15, collection: 100 }),
    null,
  );
  assert.equal(
    estimate(100, 0, { confirmation: 10, amount: 15, collection: 100 })!
      .annualRevenue,
    150,
  );
  assert.equal(
    estimate(10, 20, { confirmation: 100, amount: 15, collection: 100 })!
      .annualRevenue,
    0,
  );
  for (const confirmation of [-1, 101, NaN, Infinity])
    assert.throws(() =>
      estimate(100, 5, { confirmation, amount: 15, collection: 100 }),
    );
});
test("provenance, duplicate periods, cities and bad counts are rejected", () => {
  assert.equal(validateSnapshot(baseline).records[0].tppFiled?.value, 400);
  for (const change of [
    (r: any) => {
      r.population.value = -1;
    },
    (r: any) => {
      r.population.value = 1.5;
    },
    (r: any) => {
      r.population.source = "";
    },
    (r: any) => {
      r.month = "2026-13";
    },
    (r: any) => {
      r.kind = "cities";
    },
    (r: any) => {
      r.licensed = null;
    },
  ]) {
    const d = structuredClone(baseline);
    change(d.records[0]);
    assert.throws(() => validateSnapshot(d));
  }
  assert.throws(() =>
    validateSnapshot({
      ...baseline,
      records: [...baseline.records, ...baseline.records],
    }),
  );
});
test("Python monthly import retains history and rejects conflicting replacement without changing output", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "civvix-estimates-"));
  try {
    const input = path.join(dir, "input.json"),
      output = path.join(dir, "monthly.json");
    const script = new URL("../../fetch/estimate_refresh.py", import.meta.url)
      .pathname;
    const run = (...extra: string[]) =>
      spawnSync(
        "python3",
        [script, "--input", input, "--output", output, ...extra],
        { encoding: "utf8" },
      );
    fs.writeFileSync(input, JSON.stringify(baseline));
    assert.equal(run().status, 0);
    const next = structuredClone(baseline);
    next.records[0].month = "2026-09";
    fs.writeFileSync(input, JSON.stringify(next));
    assert.equal(run().status, 0);
    const before = fs.readFileSync(output, "utf8");
    assert.equal(JSON.parse(before).records.length, 2);
    next.records[0].population.value = 1100;
    fs.writeFileSync(input, JSON.stringify(next));
    assert.equal(run().status, 1);
    assert.equal(fs.readFileSync(output, "utf8"), before);
    assert.equal(run("--replace", "--check").status, 0);
    assert.equal(fs.readFileSync(output, "utf8"), before);
    assert.equal(run("--replace").status, 0);
    validateSnapshot(JSON.parse(fs.readFileSync(output, "utf8")));
    next.records[0].licensed = { value: -1 };
    fs.writeFileSync(input, JSON.stringify(next));
    assert.equal(run("--replace").status, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("recovery methodology uses latest returns, weighted newest three years and one capture multiplier", async () => {
  const { tppOpportunity } = await import("../src/estimates.ts");
  const benchmarks = [
    {
      tax_year: 2022,
      returns_received: 9999,
      total_tpp_collected: 999999,
      source_note: "Synthetic excluded old year",
    },
    {
      tax_year: 2023,
      returns_received: 100,
      total_tpp_collected: 10000,
      source_note: "Synthetic",
    },
    {
      tax_year: 2024,
      returns_received: 200,
      total_tpp_collected: 40000,
      source_note: "Synthetic",
    },
    {
      tax_year: 2025,
      returns_received: 300,
      total_tpp_collected: 90000,
      source_note: "Synthetic",
    },
  ];
  const result = tppOpportunity(1000, benchmarks)!;
  assert.equal(result.latestReturns, 300);
  assert.equal(result.averageAnnualReturns, 200);
  assert.equal(result.screeningGap, 700);
  assert.equal(result.averageReturnValue, 140000 / 600);
  assert.equal(result.annualRecovery, 700 * (140000 / 600) * 0.25);
  assert.equal(tppOpportunity(1000, [], 25), null);
  assert.equal(tppOpportunity(0, benchmarks, 25)!.annualRecovery, 0);
  assert.equal(
    tppOpportunity(1000, [
      {
        tax_year: 2025,
        returns_received: 0,
        total_tpp_collected: 0,
        source_note: "Synthetic",
      },
    ])!.annualRecovery,
    null,
  );
  const data = structuredClone(baseline);
  data.records[0].tppBenchmarks = benchmarks;
  validateSnapshot(data);
  data.records[0].tppBenchmarks.push(benchmarks[0]);
  assert.throws(() => validateSnapshot(data));
});
