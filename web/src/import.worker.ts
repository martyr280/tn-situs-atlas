import { matchRoster, parseCSV } from "./matching";
self.onmessage = (event) => {
  try {
    const { mode, text, rows, mapping, records, codes } = event.data;
    self.postMessage(
      mode === "parse"
        ? { rows: parseCSV(text) }
        : { results: matchRoster(rows, mapping, records, codes) },
    );
  } catch (e) {
    self.postMessage({
      error: e instanceof Error ? e.message : "Unable to process CSV.",
    });
  }
};
