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
const { render, screen, fireEvent, waitFor, cleanup, configure } =
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
