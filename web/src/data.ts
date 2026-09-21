import { useEffect, useState } from "react";
let releasePromise: Promise<{ snapshotId: string }> | null = null;
function release() {
  if (!releasePromise)
    releasePromise = fetch("/data/release.json", { cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw Error("Release unavailable");
        return r.json();
      })
      .catch((e) => {
        releasePromise = null;
        throw e;
      });
  return releasePromise;
}
export async function readData<T>(
  url: string,
  signal?: AbortSignal,
): Promise<T> {
  const snapshot = await release();
  if (url === "/data/release.json") return snapshot as T;
  const path =
    url.replace("/data/", `/data/snapshots/${snapshot.snapshotId}/`) + ".gz";
  const r = await fetch(path, { signal });
  if (!r.ok) throw Error(`Data unavailable (${r.status}).`);
  if (!r.body) throw Error("Empty dataset");
  const stream = r.body.pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).json();
}
export function useData<T>(url: string | null) {
  const [state, set] = useState<{
    url: string | null;
    data: T | null;
    error: string;
  }>({ url: null, data: null, error: "" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!url) return;
    const abort = new AbortController();
    set({ url, data: null, error: "" });
    readData<T>(url, abort.signal)
      .then((data) => {
        if (!abort.signal.aborted) set({ url, data, error: "" });
      })
      .catch((e) => {
        if (e.name !== "AbortError" && !abort.signal.aborted)
          set({
            url,
            data: null,
            error:
              "This dataset could not be loaded. Please retry using a current browser.",
          });
      });
    return () => abort.abort();
  }, [url, retry]);
  return {
    data: state.url === url ? state.data : null,
    error: state.url === url ? state.error : "",
    retry: () => setRetry((n) => n + 1),
  };
}
