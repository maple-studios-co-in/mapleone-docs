"use client";
import { useEffect } from "react";

const PANZOOM = "https://cdn.jsdelivr.net/npm/svg-pan-zoom@3.6.2/+esm";

export default function Viewer({ slug, title }) {
  useEffect(() => {
    let pz;
    (async () => {
      const svgPanZoom = (await import(/* webpackIgnore: true */ PANZOOM)).default;
      const stage = document.getElementById("stage");
      if (!stage) return;
      stage.innerHTML = await (await fetch("/" + slug + ".svg")).text();
      const svg = stage.querySelector("svg");
      if (!svg) return;
      svg.removeAttribute("width"); svg.removeAttribute("height");
      svg.style.cssText = "width:100%;height:100%;max-width:none;display:block";
      await new Promise((res) => {
        const check = () => (svg.getBoundingClientRect().width > 50 ? res() : setTimeout(check, 150));
        check();
      });
      pz = svgPanZoom(svg, {
        zoomEnabled: true, panEnabled: true, controlIconsEnabled: false,
        mouseWheelZoomEnabled: true, dblClickZoomEnabled: true, preventMouseEventsDefault: true,
        fit: true, center: true, minZoom: 0.3, maxZoom: 30, zoomScaleSensitivity: 0.3,
      });
      document.getElementById("zin").onclick = () => pz.zoomIn();
      document.getElementById("zout").onclick = () => pz.zoomOut();
      document.getElementById("zfit").onclick = () => { pz.resetZoom(); pz.fit(); pz.center(); };
    })();
    return () => { try { pz?.destroy(); } catch {} };
  }, [slug]);

  return (
    <main id="main">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, flex: 1, fontSize: 23 }}>{title}</h1>
        <button className="zbtn" id="zin">＋</button>
        <button className="zbtn" id="zout">－</button>
        <button className="zbtn" id="zfit">Fit</button>
        <a className="zbtn" href={"/" + slug + ".svg"} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>Open raw SVG</a>
        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>scroll = zoom · drag = pan</span>
      </div>
      <div
        id="stage"
        style={{
          height: "calc(100vh - 230px)", minHeight: 420, border: "1px solid var(--border)",
          borderRadius: 10, background: "var(--diagram-paper)", overflow: "hidden",
          cursor: "grab", boxShadow: "var(--shadow-sm)",
        }}
      />
    </main>
  );
}
