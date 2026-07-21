"use client";
import { useEffect } from "react";

// CDN modules loaded at runtime in the browser. webpackIgnore keeps Next/Turbopack
// from trying to bundle these URL imports — they stay native dynamic imports.
// Versions are pinned EXACTLY: mermaid lazy-loads hashed per-diagram chunks, and a
// floating tag (@11) can serve an entry file whose chunk hashes no longer exist on
// the CDN after a mermaid release — every diagram then fails with a fake
// "Syntax error in text". Never un-pin these.
const MARKED = "https://cdn.jsdelivr.net/npm/marked@12.0.2/lib/marked.esm.js";
const MERMAID = "https://cdn.jsdelivr.net/npm/mermaid@11.16.0/dist/mermaid.esm.min.mjs";
const ELK = "https://cdn.jsdelivr.net/npm/@mermaid-js/layout-elk@0.1.7/dist/mermaid-layout-elk.esm.min.mjs";
const PANZOOM = "https://cdn.jsdelivr.net/npm/svg-pan-zoom@3.6.2/+esm";

export default function DocRenderer({ markdown }) {
  useEffect(() => {
    const el = document.getElementById("content");
    // Idempotency guard: React StrictMode invokes effects twice in dev, which would
    // run mermaid a second time over already-rendered SVGs (parsed as diagram source
    // -> "Syntax error"). Marking the container ensures exactly one render pass.
    if (!el || el.dataset.built === "1") return;
    el.dataset.built = "1";
    (async () => {
      const { marked } = await import(/* webpackIgnore: true */ MARKED);
      el.innerHTML = marked.parse(markdown, { gfm: true });

      // rewrite in-markdown links (x.html -> /x, view-x.html -> /view/x); leave
      // absolute, hash, and mailto links alone.
      for (const a of el.querySelectorAll("a[href]")) {
        const href = a.getAttribute("href");
        if (/^(https?:|#|mailto:|\/)/.test(href)) continue;
        let h = href.replace(/^\.\//, "");
        let hash = "";
        const hi = h.indexOf("#");
        if (hi >= 0) { hash = h.slice(hi); h = h.slice(0, hi); }
        h = h.replace(/\.html$/, "");
        if (h.startsWith("view-")) h = "view/" + h.slice(5);
        a.setAttribute("href", (h ? "/" + h : "") + hash);
      }

      // lift ```mermaid blocks out of <pre><code> into interactive cards
      for (const code of [...el.querySelectorAll("pre > code.language-mermaid")]) {
        const box = document.createElement("div");
        box.className = "mermaid-box";
        box.innerHTML =
          '<div class="dg-bar"><button class="dg-btn" data-z="in">＋</button>' +
          '<button class="dg-btn" data-z="out">－</button><button class="dg-btn" data-z="fit">Fit</button>' +
          '<span class="dg-hint">scroll to zoom · drag to pan · double-click to zoom in</span></div>' +
          '<div class="dg-stage"><pre class="mermaid"></pre></div>';
        box.querySelector(".mermaid").textContent = code.textContent;
        code.closest("pre").replaceWith(box);
      }

      // ----- page furniture: heading ids/anchors, right-rail TOC + scrollspy, copy buttons -----
      const tocEl = document.getElementById("toc");
      const heads = [...el.querySelectorAll("h2, h3")];
      const mkslug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
      const seen = {};
      const items = [];
      for (const h of heads) {
        let id = mkslug(h.textContent);
        if (seen[id] != null) id = id + "-" + (++seen[id]); else seen[id] = 0;
        h.id = id;
        const a = document.createElement("a");
        a.className = "hlink"; a.href = "#" + id; a.textContent = "#";
        h.appendChild(a);
        items.push({ id, text: h.textContent.replace(/#$/, ""), lvl: h.tagName === "H3" ? 3 : 2 });
      }
      let obs;
      if (tocEl && items.length > 2) {
        tocEl.innerHTML = items
          .map((i) => '<a href="#' + i.id + '" data-id="' + i.id + '"' + (i.lvl === 3 ? ' class="lvl3"' : "") + ">" + i.text + "</a>")
          .join("");
        const links = [...tocEl.querySelectorAll("a")];
        const mark = (id) => links.forEach((l) => l.classList.toggle("on", l.dataset.id === id));
        obs = new IntersectionObserver((es) => {
          for (const e of es) if (e.isIntersecting) { mark(e.target.id); break; }
        }, { rootMargin: "-60px 0px -75% 0px" });
        heads.forEach((h) => obs.observe(h));
      }
      for (const pre of el.querySelectorAll("pre")) {
        if (pre.querySelector(".copy-btn") || pre.classList.contains("mermaid")) continue;
        const b = document.createElement("button");
        b.className = "copy-btn"; b.textContent = "Copy";
        b.addEventListener("click", async () => {
          try { await navigator.clipboard.writeText(pre.querySelector("code")?.textContent || pre.textContent); b.textContent = "Copied"; }
          catch { b.textContent = "Failed"; }
          setTimeout(() => (b.textContent = "Copy"), 1500);
        });
        pre.appendChild(b);
      }

      // ----- mermaid: ELK layout, house theme, de-lavender repaint, per-diagram pan/zoom -----
      // React stamps circular __reactFiber refs onto DOM nodes, and the ELK layout
      // plugin JSON-serializes a graph that can hold DOM element refs. On a plain
      // page an element stringifies harmlessly to {}; on a React page it throws
      // "Converting circular structure to JSON" and every SUBGRAPH diagram dies
      // with a fake "Syntax error" card. toJSON restores plain-page behavior.
      if (!Element.prototype.toJSON) Element.prototype.toJSON = function () { return {}; };
      const mermaid = (await import(/* webpackIgnore: true */ MERMAID)).default;
      let layout = "dagre";
      try {
        const elk = await import(/* webpackIgnore: true */ ELK);
        mermaid.registerLayoutLoaders(elk.default);
        layout = "elk";
      } catch {}

      mermaid.initialize({
        startOnLoad: false, securityLevel: "loose", layout, theme: "base",
        themeVariables: {
          fontFamily: '"Geist Sans", -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
          fontSize: "14px",
          primaryColor: "#ffffff", primaryBorderColor: "#bdb7b0", primaryTextColor: "#1c1917",
          secondaryColor: "#f6efe3", secondaryBorderColor: "#d3b481",
          tertiaryColor: "#faf9f7", tertiaryBorderColor: "#e5e1dc",
          lineColor: "#8a8580", edgeLabelBackground: "#faf9f7",
          clusterBkg: "#f7f5f2", clusterBorder: "#d9d4ce",
          noteBkgColor: "#fdf3e3", noteBorderColor: "#cf8f45",
          actorBkg: "#ffffff", actorBorder: "#bdb7b0", actorTextColor: "#1c1917", actorLineColor: "#d9d4ce",
          activationBkgColor: "#f3e2e4", activationBorderColor: "#8f1f2b",
          labelBoxBkgColor: "#f6efe3", labelBoxBorderColor: "#d3b481",
          attributeBackgroundColorOdd: "#ffffff", attributeBackgroundColorEven: "#f7f5f2",
          pie1: "#8f1f2b", pie2: "#c9a96a", pie3: "#78716c", pie4: "#b4636d",
          pie5: "#d6cbb8", pie6: "#4c4642", pie7: "#e0b7bc", pie8: "#a89f93",
          xyChart: { plotColorPalette: "#8f1f2b, #c9a96a, #78716c, #b4636d" },
          fillType0: "#f6efe3", fillType1: "#ffffff", fillType2: "#f3e2e4", fillType3: "#f7f5f2",
        },
        flowchart: { useMaxWidth: false, padding: 14, nodeSpacing: 46, rankSpacing: 56, curve: "basis" },
        sequence: { useMaxWidth: false, mirrorActors: false, actorMargin: 64, boxMargin: 8, noteMargin: 8 },
        er: { useMaxWidth: false, minEntityWidth: 110, entityPadding: 16 },
      });
      // Fire the render but do NOT await its promise — in the effect/module context
      // mermaid.run@11 renders the SVGs yet its returned promise can stay pending,
      // which would block everything below. Poll for the rendered SVGs instead.
      mermaid.run({ querySelector: ".mermaid" }).catch((e) => console.warn("mermaid.run:", e));
      const boxes = [...document.querySelectorAll(".mermaid-box")];
      await Promise.all(boxes.map((box) => new Promise((res) => {
        let n = 0;
        const check = () => (box.querySelector(".dg-stage svg") || ++n > 120 ? res() : setTimeout(check, 100));
        check();
      })));

      const LAV = "rgb(236, 236, 255)", PURP = "rgb(147, 112, 219)", LAVLINE = "rgb(51, 51, 51)";
      for (const svg of document.querySelectorAll(".dg-stage svg")) {
        for (const r of svg.querySelectorAll("rect")) {
          const w = parseFloat(r.getAttribute("width") || "0");
          if (!r.getAttribute("rx") && w > 24) { r.setAttribute("rx", "7"); r.setAttribute("ry", "7"); }
        }
        for (const n of svg.querySelectorAll(".node rect, .node polygon, .node circle, .node path, .label-container")) {
          const cs = getComputedStyle(n);
          if (cs.fill === LAV) n.style.fill = "#ffffff";
          if (cs.stroke === PURP) n.style.stroke = "#bdb7b0";
        }
        for (const c of svg.querySelectorAll(".cluster rect")) {
          const cs = getComputedStyle(c);
          if (cs.stroke === PURP || cs.fill === "rgb(255, 255, 222)") c.style.stroke = "#d9d2c9";
        }
        for (const p of svg.querySelectorAll(".edgePath path, .flowchart-link, path.transition")) {
          if (getComputedStyle(p).stroke === LAVLINE) p.style.stroke = "#8a8580";
        }
        for (const m of svg.querySelectorAll("marker path")) {
          if (getComputedStyle(m).fill === LAVLINE) m.style.fill = "#8a8580";
        }
        svg.classList.add("dg-polished");
      }

      const svgPanZoom = (await import(/* webpackIgnore: true */ PANZOOM)).default;
      const whenSized = (n) => new Promise((res) => {
        const check = () => (n.getBoundingClientRect().width > 50 ? res() : setTimeout(check, 150));
        check();
      });
      for (const box of document.querySelectorAll(".mermaid-box")) {
        (async () => {
          const svg = box.querySelector(".dg-stage svg");
          if (!svg) return;
          const vb = (svg.getAttribute("viewBox") || "0 0 800 600").split(/\s+/).map(Number);
          const naturalH = vb[3] || 600;
          const h = Math.min(Math.max(170, naturalH + 34), Math.max(420, window.innerHeight * 0.72));
          svg.style.cssText = "width:100%;max-width:none;height:" + h + "px;display:block";
          svg.removeAttribute("width"); svg.removeAttribute("height");
          await whenSized(svg);
          const pz = svgPanZoom(svg, {
            zoomEnabled: true, panEnabled: true, controlIconsEnabled: false,
            mouseWheelZoomEnabled: true, dblClickZoomEnabled: true, preventMouseEventsDefault: true,
            fit: true, center: true, minZoom: 0.4, maxZoom: 24, zoomScaleSensitivity: 0.25,
          });
          box.querySelector('[data-z="in"]').addEventListener("click", () => pz.zoomIn());
          box.querySelector('[data-z="out"]').addEventListener("click", () => pz.zoomOut());
          box.querySelector('[data-z="fit"]').addEventListener("click", () => { pz.resetZoom(); pz.fit(); pz.center(); });
        })().catch((e) => console.warn("panzoom init failed:", e));
      }
    })();
  }, [markdown]);

  return <div id="content">Rendering…</div>;
}
