import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
const root = path.resolve(import.meta.dirname, "../..");
const dom = new JSDOM(
  '<!doctype html><html lang="en"><head><title>Civvix QA</title></head><body></body></html>',
  { url: "https://atlas.test/" },
);
for (const k of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLInputElement",
  "Element",
  "Node",
  "MutationObserver",
  "localStorage",
  "getComputedStyle",
])
  Object.defineProperty(globalThis, k, {
    value:
      k === "getComputedStyle"
        ? dom.window.getComputedStyle.bind(dom.window)
        : (dom.window as unknown as Record<string, unknown>)[k],
    configurable: true,
    writable: true,
  });
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  value: true,
  writable: true,
});
const requests: string[] = [];
globalThis.fetch = async (input: RequestInfo | URL) => {
  const url = String(input);
  requests.push(url);
  const file = path.join(root, "web/public", url);
  if (!file.startsWith(path.join(root, "web/public") + "/"))
    return new Response("", { status: 404 });
  try {
    return new Response(fs.readFileSync(file), { status: 200 });
  } catch {
    return new Response("", { status: 404 });
  }
};
const React = await import("react");
const { render, screen, fireEvent, waitFor, cleanup, configure, act } =
  await import("@testing-library/react");
const { createMemoryRouter, RouterProvider } = await import("react-router-dom");
const App = (await import("../src/App.tsx")).default;
const { parseCSV, matchRoster } = await import("../src/matching.ts");
class TestWorker {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  stopped = false;
  postMessage(d: any) {
    queueMicrotask(() => {
      if (this.stopped) return;
      try {
        this.onmessage?.({
          data:
            d.mode === "parse"
              ? { rows: parseCSV(d.text) }
              : { results: matchRoster(d.rows, d.mapping, d.records, d.codes) },
        });
      } catch (e) {
        this.onmessage?.({ data: { error: (e as Error).message } });
      }
    });
  }
  terminate() {
    this.stopped = true;
  }
}
Object.defineProperty(globalThis, "Worker", {
  value: TestWorker,
  writable: true,
});
configure({ asyncUtilTimeout: 10000 });
afterEach(() => {
  cleanup();
  localStorage.clear();
});
function mount(url: string) {
  const router = createMemoryRouter(
    [{ path: "*", element: React.createElement(App) }],
    { initialEntries: [url] },
  );
  render(React.createElement(RouterProvider, { router }));
  return router;
}
function snapshot(name: string) {
  const folder = path.join(root, "qa-screenshots");
  fs.mkdirSync(folder, { recursive: true });
  const css = fs.readFileSync(path.join(root, "web/src/styles.css"), "utf8");
  const html =
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Civvix visual QA</title><style>' +
    css +
    "</style></head><body>" +
    document.body.innerHTML +
    "</body></html>";
  fs.writeFileSync(path.join(folder, name + ".html"), html);
}
test("overview, directory search, comparison and scenario controls render and operate", async () => {
  const router = mount("/");
  await screen.findByRole(
    "heading",
    { name: "Clarity starts with the right location." },
    { timeout: 10000 },
  );
  await waitFor(() =>
    assert.equal(document.querySelectorAll(".state-map path").length, 95),
  );
  snapshot("overview");
  fireEvent.click(screen.getByRole("link", { name: "Counties", exact: true }));
  await screen.findByRole("heading", {
    name: "Every county. A clearer picture.",
  });
  fireEvent.change(screen.getByRole("textbox", { name: "Search counties" }), {
    target: { value: "Wilson" },
  });
  assert.ok(screen.getByRole("link", { name: "Wilson", exact: true }));
  assert.equal(document.querySelectorAll("tbody tr").length, 1);
  fireEvent.click(screen.getByRole("checkbox", { name: "Compare Wilson" }));
  assert.ok(screen.getByRole("heading", { name: "Compare jurisdictions" }));
  fireEvent.click(
    screen.getByRole("link", { name: "Revenue scenarios", exact: true }),
  );
  await screen.findByRole("heading", {
    name: "Revenue moves in both directions.",
  });
  await screen.findByText("Potential incoming / year");
  const before = document.querySelector(
    ".stats .stat-card strong",
  )!.textContent;
  fireEvent.change(
    screen.getByRole("spinbutton", {
      name: "Incoming correction rate percent",
    }),
    { target: { value: "20" } },
  );
  await waitFor(() =>
    assert.notEqual(
      document.querySelector(".stats .stat-card strong")!.textContent,
      before,
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Reset assumptions" }));
  assert.equal(
    (
      screen.getByRole("spinbutton", {
        name: "Incoming correction rate percent",
      }) as HTMLInputElement
    ).value,
    "10",
  );
  cleanup();
  router.dispose();
});
test("Wilson review: select evidence, save locally, guard unsaved navigation, reload and next record", async () => {
  const router = mount("/counties/wilson/review");
  await screen.findByRole(
    "heading",
    { name: "Wilson County" },
    { timeout: 15000 },
  );
  await waitFor(() => assert.ok(document.querySelector(".record-row")));
  fireEvent.click(document.querySelector(".record-row")!);
  await screen.findByRole("heading", { name: "Jurisdiction comparison" });
  await waitFor(() =>
    assert.ok(screen.getByRole("button", { name: "Export packet" })),
  );
  const first = document.querySelector(".evidence-name")!.textContent;
  fireEvent.change(screen.getByRole("combobox", { name: "Review status" }), {
    target: { value: "In review" },
  });
  fireEvent.change(
    screen.getByRole("textbox", { name: "Evidence and review notes" }),
    { target: { value: "QA synthetic review: sources inspected." } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Save review" }));
  await screen.findByText("Saved on this device.");
  snapshot("wilson-evidence");
  assert.equal(localStorage.length, 1);
  fireEvent.change(
    screen.getByRole("textbox", { name: "Evidence and review notes" }),
    { target: { value: "Unsaved QA note" } },
  );
  dom.window.confirm = () => false;
  fireEvent.click(screen.getByRole("button", { name: "Next business" }));
  await waitFor(() =>
    assert.equal(document.querySelector(".evidence-name")!.textContent, first),
  );
  fireEvent.click(screen.getByRole("button", { name: "Reload saved" }));
  await waitFor(() =>
    assert.equal(
      (
        screen.getByRole("textbox", {
          name: "Evidence and review notes",
        }) as HTMLTextAreaElement
      ).value,
      "QA synthetic review: sources inspected.",
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Next business" }));
  await waitFor(() =>
    assert.notEqual(
      document.querySelector(".evidence-name")!.textContent,
      first,
    ),
  );
  cleanup();
  router.dispose();
});
test("direct evidence link restores the saved status and notes after remount", async () => {
  let router = mount("/counties/wilson/review");
  await screen.findByRole("heading", { name: "Wilson County" });
  fireEvent.click(document.querySelector(".record-row")!);
  await screen.findByRole("heading", { name: "Jurisdiction comparison" });
  fireEvent.change(screen.getByRole("combobox", { name: "Review status" }), {
    target: { value: "In review" },
  });
  fireEvent.change(
    screen.getByRole("textbox", { name: "Evidence and review notes" }),
    { target: { value: "Previously saved QA evidence." } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Save review" }));
  await screen.findByText("Saved on this device.");
  const direct = router.state.location.pathname + router.state.location.search;
  cleanup();
  router.dispose();
  router = mount(direct);
  await screen.findByRole("heading", { name: "Jurisdiction comparison" });
  assert.equal(
    (
      screen.getByRole("combobox", {
        name: "Review status",
      }) as HTMLSelectElement
    ).value,
    "In review",
  );
  assert.equal(
    (
      screen.getByRole("textbox", {
        name: "Evidence and review notes",
      }) as HTMLTextAreaElement
    ).value,
    "Previously saved QA evidence.",
  );
  cleanup();
  router.dispose();
});
test("roster workflow parses, maps, validates, applies and clears without roster persistence or network submission", async () => {
  const router = mount("/counties/wilson/review");
  await screen.findByRole(
    "heading",
    { name: "Wilson County" },
    { timeout: 15000 },
  );
  fireEvent.click(screen.getByRole("button", { name: "Compare a roster" }));
  await screen.findByRole("heading", {
    name: "Bring the roster to the evidence.",
  });
  await waitFor(() =>
    assert.ok(
      !screen
        .getByRole("button", { name: /Read CSV/ })
        .hasAttribute("data-error"),
    ),
  );
  const text =
    "business_name,physical_address,situs\nASH VALLEY MUSIC INC,722 BENDERS FERRY RD MT JULIET 37122,9501";
  fireEvent.change(screen.getByRole("textbox", { name: "Paste roster CSV" }), {
    target: { value: text },
  });
  await waitFor(() =>
    assert.equal(
      (screen.getByRole("button", { name: /Read CSV/ }) as HTMLButtonElement)
        .disabled,
      false,
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: /Read CSV/ }));
  await screen.findByRole("heading", { name: "Confirm the column mapping" });
  fireEvent.click(screen.getByRole("button", { name: /Validate & match/ }));
  await screen.findByRole("heading", { name: "Review the results" });
  await screen.findByRole("button", { name: /Apply 1 verified matches/ });
  fireEvent.click(
    screen.getByRole("button", { name: /Apply 1 verified matches/ }),
  );
  await screen.findByText("Roster applied to this session");
  assert.equal(document.querySelectorAll(".record-row").length, 1);
  assert.equal(localStorage.length, 0);
  assert.ok(!JSON.stringify({ ...localStorage }).includes("ASH VALLEY"));
  assert.ok(requests.every((r) => r.startsWith("/data/")));
  fireEvent.click(screen.getByRole("button", { name: "Compare a roster" }));
  await screen.findByRole("button", { name: "Clear imported data" });
  fireEvent.click(screen.getByRole("button", { name: "Clear imported data" }));
  assert.ok(
    !screen.queryByText("A roster is already applied to this session."),
  );
  cleanup();
  router.dispose();
});
test("structural accessibility check on overview and sparse county", async () => {
  const axe = (await import("axe-core")).default;
  for (const url of ["/", "/counties/lake"]) {
    const router = mount(url);
    await screen.findByRole("heading", { level: 1 }, { timeout: 15000 });
    await waitFor(() => assert.ok(!screen.queryByText("Loading the atlas…")));
    if (url !== "/") await screen.findByText(/No dated inputs published/);
    const result = await axe.run(document.body, {
      rules: { "color-contrast": { enabled: false } },
    });
    assert.deepEqual(
      result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
      })),
      [],
    );
    cleanup();
    router.dispose();
  }
});

test("jurisdiction estimates require explicit assumptions and do not substitute TPP for licenses", async () => {
  const Estimates = (await import("../src/Estimates.tsx")).default;
  const catalog = JSON.parse(
    fs.readFileSync(path.join(root, "site/data/statewide_index.json"), "utf8"),
  );
  const item = {
    ...catalog.counties.find((r: any) => r.slug === "shelby"),
    kind: "counties",
    name: "SHELBY",
  };
  render(React.createElement(Estimates, { item }));
  await screen.findByText(/No dated inputs published/);
  const fixture = fs.readFileSync(
    path.join(root, "web/tests/fixtures/estimates.json"),
    "utf8",
  );
  await act(async () =>
    fireEvent.change(screen.getByLabelText("Load monthly inputs (JSON)"), {
      target: { files: [{ size: fixture.length, text: async () => fixture }] },
    }),
  );
  await screen.findByText("600");
  assert.ok(screen.getByText(/TPP schedules cannot substitute/));
  const button = screen.getByRole("button", {
    name: "Export tangible personal property scenario",
  }) as HTMLButtonElement;
  assert.equal(button.disabled, true);
  fireEvent.change(
    screen.getByLabelText("Tangible personal property annual amount"),
    { target: { value: "368.008" } },
  );
  fireEvent.change(
    screen.getByLabelText("Tangible personal property eligible share"),
    { target: { value: "100" } },
  );
  fireEvent.change(
    screen.getByLabelText("Tangible personal property collection rate"),
    { target: { value: "97.28" } },
  );
  assert.ok(screen.getByText("$214,799"));
  assert.equal(button.disabled, false);
  fireEvent.change(
    screen.getByLabelText("Tangible personal property eligible share"),
    { target: { value: "101" } },
  );
  assert.equal(button.disabled, true);
  cleanup();
  render(
    React.createElement(Estimates, {
      item: { ...item, kind: "cities", slug: "ardmore", name: "ARDMORE" },
    }),
  );
  await screen.findByText(/No dated inputs published/);
  assert.equal(
    screen.queryByRole("region", {
      name: "Tangible personal property scenario",
    }),
    null,
  );
});

test("recovery benchmark import calculates TPP with capture rate and restores the empty published state", async () => {
  const Estimates = (await import("../src/Estimates.tsx")).default;
  render(
    React.createElement(Estimates, {
      item: { kind: "counties", slug: "shelby", name: "SHELBY" } as any,
    }),
  );
  await screen.findByText(/No dated inputs published/);
  const snapshot = JSON.parse(
    fs.readFileSync(
      path.join(root, "web/tests/fixtures/estimates.json"),
      "utf8",
    ),
  );
  delete snapshot.records[0].tppFiled;
  snapshot.records[0].tppBenchmarks = [
    {
      tax_year: 2024,
      returns_received: 100,
      total_tpp_collected: 10000,
      source_note: "Synthetic",
    },
    {
      tax_year: 2025,
      returns_received: 300,
      total_tpp_collected: 90000,
      source_note: "Synthetic",
    },
  ];
  const text = JSON.stringify(snapshot);
  await act(async () =>
    fireEvent.change(screen.getByLabelText("Load monthly inputs (JSON)"), {
      target: { files: [{ size: text.length, text: async () => text }] },
    }),
  );
  await screen.findByText("$43,750");
  assert.equal(
    screen.queryByLabelText("Tangible personal property collection rate"),
    null,
  );
  fireEvent.change(screen.getByLabelText("TPP capture rate"), {
    target: { value: "50" },
  });
  assert.ok(screen.getByText("$87,500"));
  const axe = (await import("axe-core")).default;
  const violations = await axe.run(document.body, {
    rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
  });
  assert.deepEqual(
    violations.violations.map((v) => v.id),
    [],
  );
  await act(async () =>
    fireEvent.change(screen.getByLabelText("Load monthly inputs (JSON)"), {
      target: { files: [{ size: 2, text: async () => "{}" }] },
    }),
  );
  assert.ok(screen.getByRole("alert"));
  assert.ok(screen.getByText("$87,500"));
  fireEvent.click(
    screen.getByRole("button", { name: "Restore published inputs" }),
  );
  assert.ok(screen.getByText(/No dated inputs published/));
});

test("pilot import shows recipient allocation, independent confirmation and clear state", async () => {
  const PilotPlanner = (await import("../src/PilotPlanner.tsx")).default;
  render(
    React.createElement(PilotPlanner, {
      item: { kind: "counties", slug: "shelby", name: "SHELBY" } as any,
    }),
  );
  fireEvent.click(screen.getByText("Pilot stress test & cost comparison"));
  const inputs = {
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
  const text = JSON.stringify({
    schemaVersion: 1,
    kind: "pilot-scenario",
    jurisdiction: "shelby",
    asOf: "2026-09-30",
    source: "Synthetic QA",
    inputs,
  });
  await act(async () =>
    fireEvent.change(screen.getByLabelText("Load pilot scenario (JSON)"), {
      target: { files: [{ size: text.length, text: async () => text }] },
    }),
  );
  assert.ok(screen.getByText("$25,000"));
  assert.ok(screen.getByText("Withheld · county share needed"));
  fireEvent.change(
    screen.getByLabelText("County share of situs recovery (%)"),
    { target: { value: "40" } },
  );
  assert.ok(screen.getByText("$16,000"));
  fireEvent.change(screen.getByLabelText("License confirmation rate (%)"), {
    target: { value: "0" },
  });
  assert.ok(screen.getByText("$14,000"));
  fireEvent.change(screen.getByLabelText("TPP confirmation rate (%)"), {
    target: { value: "101" },
  });
  assert.equal(
    (
      screen.getByRole("button", {
        name: "Export pilot scenario",
      }) as HTMLButtonElement
    ).disabled,
    true,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Clear pilot assumptions" }),
  );
  assert.equal(
    (screen.getByLabelText("Assumption source") as HTMLInputElement).value,
    "",
  );
});
