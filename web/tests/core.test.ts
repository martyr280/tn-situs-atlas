import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCSV, matchRoster, normalAddress } from "../src/matching.ts";
import {
  saveReview,
  scenario,
  type QueueRecord,
  type Review,
} from "../src/model.ts";
const r: QueueRecord = {
  id: "record",
  legacyId: "1",
  name: "Example LLC",
  source: "fixture",
  address: "123 MAIN ST LEBANON 37087",
  flag: "CLEAR",
  score: 90,
  seam: 120,
  lon: -86,
  lat: 36,
  situs: "9501",
  complete: true,
};
const codes = ["9500", "9501", "0101"];
test("CSV handles quotes, embedded commas, multiline fields and CRLF", () => {
  assert.deepEqual(
    parseCSV('name,address,situs\r\n"Example, Inc","123 MAIN\nST",0101'),
    [
      ["name", "address", "situs"],
      ["Example, Inc", "123 MAIN\nST", "0101"],
    ],
  );
  assert.throws(() => parseCSV('a,b\n"unfinished,foo'));
});
test("unique name and full address required, leading zeros retained", () => {
  const results = matchRoster(
    [
      ["Example LLC", "123 Main Street Lebanon 37087", "0101"],
      ["Example LLC", "987 OTHER RD", "9501"],
      ["Other", "123 MAIN ST", "9501"],
    ],
    [0, 1, 2],
    [r],
    codes,
  );
  assert.equal(results[0].state, "matched");
  assert.equal(results[0].code, "0101");
  assert.equal(results[0].mismatch, true);
  assert.equal(results[1].state, "ambiguous");
  assert.equal(results[2].state, "unmatched");
});
test("same name and house number on different street is not a match", () =>
  assert.equal(
    matchRoster(
      [["Example", "123 OAK ST LEBANON 37087", "9500"]],
      [0, 1, 2],
      [r],
      codes,
    )[0].state,
    "ambiguous",
  ));
test("duplicate and conflicting rows are held and all input rows accounted for", () => {
  const results = matchRoster(
    [
      ["Example", "123 MAIN ST LEBANON 37087", "9500"],
      ["Example", "123 MAIN ST LEBANON 37087", "9501"],
      ["", "bad", "12345"],
      ["Other", "555 OAK ST", "0101"],
    ],
    [0, 1, 2],
    [r],
    codes,
  );
  assert.deepEqual(
    results.map((x) => x.state),
    ["ambiguous", "ambiguous", "invalid", "unmatched"],
  );
  assert.equal(results.filter((x) => x.id).length, 0);
});
test("point-only records cannot auto-match", () =>
  assert.equal(
    matchRoster(
      [["Example", r.address, "9501"]],
      [0, 1, 2],
      [{ ...r, complete: false }],
      codes,
    )[0].state,
    "ambiguous",
  ));
test("invalid and repeated mapping rejected; invalid codes never truncated", () => {
  assert.throws(() => matchRoster([], [0, 0, 2], [r], codes));
  assert.equal(
    matchRoster([["Example", r.address, "9501.0"]], [0, 1, 2], [r], codes)[0]
      .state,
    "invalid",
  );
});
test("save failure propagates and stale revisions are rejected", () => {
  const v: Review = {
    status: "In review",
    note: "Test",
    updatedAt: "now",
    revision: "new",
    snapshot: "test",
    history: [],
  };
  assert.throws(
    () =>
      saveReview(
        {
          getItem: () => null,
          setItem: () => {
            throw Error("quota");
          },
        },
        "key",
        v,
        null,
      ),
    /quota/,
  );
  assert.throws(
    () =>
      saveReview(
        {
          getItem: () => JSON.stringify({ ...v, revision: "other" }),
          setItem: () => {},
        },
        "key",
        v,
        "old",
      ),
    /another tab/,
  );
});
test("scenario preserves separate rates, selected tiers and verification gate", () => {
  const row = {
    jurisdiction: "TEST",
    owed_val_A: 1000,
    owed_val_B: 3000,
    err_val_A: 500,
    err_val_B: 1000,
  };
  assert.deepEqual(scenario(row, "AB", 10, 20, 1.5, "counties", {}), {
    received: 600,
    ceded: 450,
    net: 150,
  });
  assert.equal(scenario(row, "A", 10, 10, 1, "cities", {}), null);
  assert.equal(
    scenario(
      { ...row, counties: ["TEST", "OTHER"] },
      "A",
      10,
      10,
      1,
      "cities",
      { TEST: { verdict: "REAL" }, OTHER: { verdict: "MIXED" } },
    ),
    null,
  );
  assert.equal(
    scenario(row, "A", 10, 10, 1, "cities", { TEST: { verdict: "REAL" } })?.net,
    50,
  );
});
test("large synthetic roster preserves counts", () => {
  const rows = Array.from({ length: 20000 }, (_, i) => [
    "Other " + i,
    "123 OAK ST",
    "0101",
  ]);
  assert.equal(
    matchRoster(rows, [0, 1, 2], [r], codes).filter(
      (r) => r.state === "unmatched",
    ).length,
    20000,
  );
});
