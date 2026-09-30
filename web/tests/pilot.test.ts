import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pilotScenario,
  validatePilot,
  type PilotInputs,
} from "../src/pilot.ts";
const inputs: PilotInputs = {
  tppLeads: 1000,
  licenseLeads: 200,
  tppPerCase: 100,
  collectionPercent: 80,
  licenseFee: 20,
  situsFlagged: 51,
  situsPerLocation: 1000,
  lookbackYears: 1,
  forwardYears: 2,
  situsCost: 1000,
  leadUnitCost: 5,
  billableLeads: 1000,
  tppHitPercent: 10,
  licenseHitPercent: 50,
  situsHitPercent: 10,
  countySharePercent: null,
  rounding: "nearest",
};
test("pilot keeps stream rates, recipients and time horizons separate", () => {
  const r = pilotScenario(inputs);
  assert.equal(r.tpp, 8000);
  assert.equal(r.license, 2000);
  assert.equal(r.situsCases, 5);
  assert.equal(r.situsLookback, 5000);
  assert.equal(r.situsForward, 10000);
  assert.equal(r.cost, 6000);
  assert.equal(r.combinedLocal, 25000);
  assert.equal(r.countyTotal, null);
  assert.equal(r.countyMultiple, null);
  const c = pilotScenario({ ...inputs, countySharePercent: 40 });
  assert.equal(c.countySitus, 6000);
  assert.equal(c.countyTotal, 16000);
});
test("fractional expected cases differ from whole-case rounding and zero is preserved", () => {
  const r = pilotScenario({
    ...inputs,
    rounding: "expected",
    countySharePercent: 0,
  });
  assert.equal(r.situsCases, 5.1);
  assert.equal(r.countySitus, 0);
  assert.equal(r.countyTotal, r.tppLicense);
  const z = pilotScenario({ ...inputs, situsCost: 0, leadUnitCost: 0 });
  assert.equal(z.combinedLocalMultiple, null);
});
test("fees are not multiplied by situs years and overlap does not double bill leads", () => {
  const r = pilotScenario({ ...inputs, licenseLeads: 1000, forwardYears: 10 });
  assert.equal(r.license, 10000);
  assert.equal(r.cost, 6000);
});
test("pilot rejects invalid dates, missing fields, percentages and jurisdiction metadata", () => {
  const file = {
    schemaVersion: 1,
    kind: "pilot-scenario",
    jurisdiction: "shelby",
    asOf: "2026-09-30",
    source: "Synthetic",
    inputs,
  };
  validatePilot(file);
  for (const asOf of ["2026-02-30", "2026-13-01", ""])
    assert.throws(() => validatePilot({ ...file, asOf }));
  for (const overrides of [
    { tppLeads: 1.2 },
    { tppHitPercent: 101 },
    { countySharePercent: undefined },
    { countySharePercent: -1 },
    { licenseFee: NaN },
    { lookbackYears: 0, forwardYears: 0 },
  ])
    assert.throws(() =>
      pilotScenario({ ...inputs, ...overrides } as PilotInputs),
    );
  assert.throws(() => validatePilot({ ...file, source: "" }));
});
