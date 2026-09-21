import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Minus,
  Maximize,
  LocateFixed,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useData } from "./data";
import { DataState } from "./App";
import type { QueueRecord } from "./model";
type Geometry = { type: string; coordinates: unknown; geometries?: Geometry[] };
type Feature = { geometry: Geometry; properties: Record<string, string> };
type Collection = { features: Feature[] };
type MapData = {
  situs: Collection;
  neighbors: Collection;
  seams: Collection;
  roads: Collection;
  annexations: Collection;
  band: number[][];
};
export default function MapView({
  base,
  records,
  selected,
  onSelect,
  names,
}: {
  base: string;
  records: QueueRecord[];
  selected: string;
  onSelect: (id: string) => void;
  names: Record<string, string>;
}) {
  const { data, error, retry } = useData<MapData>(base + "/map.json");
  const canvas = useRef<HTMLCanvasElement>(null),
    host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState([600, 450]),
    [view, setView] = useState({ zoom: 1, x: 0, y: 0 }),
    [layers, setLayers] = useState({
      roads: false,
      seams: true,
      points: true,
      annexations: false,
      band: false,
    }),
    [legend, setLegend] = useState(false);
  const drag = useRef<{
    x: number;
    y: number;
    ox: number;
    oy: number;
    move: boolean;
  } | null>(null);
  const project = useRef<(x: number, y: number) => [number, number]>(() => [
    0, 0,
  ]);
  const colors = [
    "#a6c8c0",
    "#d9d8bb",
    "#bbccd9",
    "#d4bad0",
    "#bfd2ad",
    "#d9c6b0",
  ];
  useEffect(() => {
    if (!host.current) return;
    const o = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize([r.width, Math.max(400, r.height)]);
    });
    o.observe(host.current);
    return () => o.disconnect();
  }, [data]);
  useEffect(() => {
    if (!data || !canvas.current) return;
    const c = canvas.current,
      ctx = c.getContext("2d")!;
    const [w, h] = size,
      dpr = devicePixelRatio || 1;
    c.width = w * dpr;
    c.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#f1f5f1";
    ctx.fillRect(0, 0, w, h);
    const points: number[][] = [];
    function scan(a: unknown) {
      if (!Array.isArray(a)) return;
      if (typeof a[0] === "number") points.push(a as number[]);
      else a.forEach(scan);
    }
    data.situs.features.forEach((f) => scan(f.geometry.coordinates));
    if (!points.length) return;
    const lon = points.map((p) => p[0]),
      lat = points.map((p) => p[1]);
    const minX = lon.reduce((a, b) => Math.min(a, b), Infinity),
      maxX = lon.reduce((a, b) => Math.max(a, b), -Infinity),
      minY = lat.reduce((a, b) => Math.min(a, b), Infinity),
      maxY = lat.reduce((a, b) => Math.max(a, b), -Infinity);
    const k = Math.cos((((minY + maxY) / 2) * Math.PI) / 180),
      scale =
        Math.min((w - 45) / ((maxX - minX) * k), (h - 65) / (maxY - minY)) *
        view.zoom;
    const projectFn = (x: number, y: number): [number, number] => [
      (x - (minX + maxX) / 2) * k * scale + w / 2 + view.x,
      -(y - (minY + maxY) / 2) * scale + h / 2 + view.y,
    ];
    project.current = projectFn;
    function geometry(g: Geometry) {
      if (g.type === "GeometryCollection") {
        g.geometries?.forEach(geometry);
        return;
      }
      function line(a: unknown) {
        if (!Array.isArray(a) || !a.length) return;
        if (Array.isArray(a[0]) && typeof a[0][0] === "number") {
          (a as number[][]).forEach((p, i) => {
            const [x, y] = projectFn(p[0], p[1]);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
        } else a.forEach(line);
      }
      line(g.coordinates);
    }
    function collection(
      fc: Collection,
      color: string,
      fill = false,
      width = 0.7,
      dash: number[] = [],
    ) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash);
      for (const f of fc.features) {
        ctx.beginPath();
        geometry(f.geometry);
        if (fill) {
          ctx.fillStyle = color;
          ctx.fill("evenodd");
        } else ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    collection(data.neighbors, "#e4e9e3", true);
    data.situs.features.forEach((f, i) => {
      ctx.beginPath();
      geometry(f.geometry);
      ctx.fillStyle =
        colors[
          Math.max(0, Object.keys(names).indexOf(f.properties.SITUS)) %
            colors.length
        ];
      ctx.fill("evenodd");
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
    if (layers.roads) collection(data.roads, "#8da59f", false, 0.65);
    if (layers.seams) collection(data.seams, "#344b47", false, 1.3, [4, 3]);
    if (layers.annexations)
      collection(data.annexations, "#865aa1", false, 2, [2, 2]);
    if (layers.band) {
      ctx.fillStyle = "#b78541";
      for (const p of data.band) {
        const [x, y] = projectFn(p[0], p[1]);
        ctx.fillRect(x, y, 2, 2);
      }
    }
    if (layers.points)
      for (const r of records) {
        const [x, y] = projectFn(r.lon, r.lat);
        if (x < 0 || y < 0 || x > w || y > h) continue;
        ctx.beginPath();
        ctx.arc(x, y, r.flag === "CLEAR" ? 1.5 : 2.4, 0, Math.PI * 2);
        ctx.fillStyle = r.flag === "CLEAR" ? "#698179" : "#925026";
        ctx.fill();
      }
    const chosen = records.find((r) => r.id === selected);
    if (chosen) {
      const [x, y] = projectFn(chosen.lon, chosen.lat);
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#112c2b";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    // Display-only scale, never used as an evidentiary measurement.
    const miles = (80 / (scale * k)) * 69.17 * k;
    ctx.fillStyle = "#213f36";
    ctx.fillRect(20, h - 27, 80, 2);
    ctx.font = "12px system-ui";
    ctx.fillText("≈ " + miles.toFixed(miles < 1 ? 2 : 1) + " mi", 20, h - 35);
  }, [data, size, view, layers, records, selected]);
  function center() {
    const r = records.find((x) => x.id === selected);
    if (!r) return;
    const [x, y] = project.current(r.lon, r.lat);
    setView((v) => ({
      ...v,
      x: v.x + size[0] / 2 - x,
      y: v.y + size[1] / 2 - y,
    }));
  }
  if (!data) return <DataState error={error} retry={retry} />;
  return (
    <div className="work-map" ref={host}>
      <canvas
        ref={canvas}
        aria-label="Jurisdiction map. Business selection and full evidence are also available in the review list."
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            ox: view.x,
            oy: view.y,
            move: false,
          };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d) {
            const dx = e.clientX - d.x,
              dy = e.clientY - d.y;
            d.move = d.move || Math.abs(dx) + Math.abs(dy) > 5;
            if (d.move) setView((v) => ({ ...v, x: d.ox + dx, y: d.oy + dy }));
          }
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (d && !d.move && layers.points) {
            const rect = e.currentTarget.getBoundingClientRect(),
              x = e.clientX - rect.left,
              y = e.clientY - rect.top;
            let nearest: QueueRecord | undefined,
              best = 100;
            for (const r of records) {
              const [p, q] = project.current(r.lon, r.lat),
                ds = (p - x) ** 2 + (q - y) ** 2;
              if (ds < best) {
                nearest = r;
                best = ds;
              }
            }
            if (nearest) onSelect(nearest.id);
          }
        }}
      />
      <div className="map-layer-controls">
        <details>
          <summary>Map layers</summary>
          {Object.entries(layers).map(([k, v]) => (
            <label key={k}>
              <input
                type="checkbox"
                checked={v}
                onChange={(e) =>
                  setLayers((l) => ({ ...l, [k]: e.target.checked }))
                }
              />
              {k === "band"
                ? "Sampled boundary points"
                : k[0].toUpperCase() + k.slice(1)}
            </label>
          ))}
        </details>
      </div>
      <div className="map-buttons">
        {[
          [
            Plus,
            "Zoom in",
            () => setView((v) => ({ ...v, zoom: Math.min(32, v.zoom * 1.5) })),
          ],
          [
            Minus,
            "Zoom out",
            () => setView((v) => ({ ...v, zoom: Math.max(0.5, v.zoom / 1.5) })),
          ],
          [
            Maximize,
            "Fit jurisdiction",
            () => setView({ zoom: 1, x: 0, y: 0 }),
          ],
          [LocateFixed, "Center selected business", center],
          [
            ChevronLeft,
            "Pan left",
            () => setView((v) => ({ ...v, x: v.x + 80 })),
          ],
          [
            ChevronRight,
            "Pan right",
            () => setView((v) => ({ ...v, x: v.x - 80 })),
          ],
          [ChevronUp, "Pan up", () => setView((v) => ({ ...v, y: v.y + 80 }))],
          [
            ChevronDown,
            "Pan down",
            () => setView((v) => ({ ...v, y: v.y - 80 })),
          ],
        ].map(([Icon, label, fn]) => {
          const I = Icon as typeof Plus;
          return (
            <button
              key={String(label)}
              aria-label={String(label)}
              title={String(label)}
              onClick={fn as () => void}
            >
              <I size={17} />
            </button>
          );
        })}
      </div>
      <div className="map-legend">
        <button onClick={() => setLegend(!legend)} aria-expanded={legend}>
          Legend
        </button>
        {legend && (
          <div>
            {Object.entries(names).map(([code, name], i) => (
              <span key={code}>
                <i style={{ background: colors[i % colors.length] }} />
                {name} · {code}
              </span>
            ))}
            <span>● Brown: exposure · green: no flag</span>
            <span>◉ Outlined: selected business</span>
            <span>Dashed line: jurisdiction seam</span>
          </div>
        )}
      </div>
      <div className="map-disclaimer">
        Simplified display · measurements in evidence
      </div>
    </div>
  );
}
