"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { NAV, DIAGRAMS } from "../lib/site.mjs";

export default function Sidebar() {
  const pathname = usePathname() || "/";
  const active = decodeURIComponent(pathname).replace(/^\/|\/$/g, ""); // "" for home
  const [q, setQ] = useState("");
  const [hits, setHits] = useState([]);
  const [sel, setSel] = useState(-1);
  const idxRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    const onSlash = (e) => {
      if (e.key === "/" && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || "")) {
        e.preventDefault();
        document.getElementById("q")?.focus();
      }
    };
    document.addEventListener("keydown", onSlash);
    return () => document.removeEventListener("keydown", onSlash);
  }, []);

  const runSearch = async (term) => {
    setQ(term);
    setSel(-1);
    const t = term.trim().toLowerCase();
    if (t.length < 2) { setHits([]); return; }
    if (!idxRef.current) idxRef.current = await (await fetch("/search-index.json")).json();
    const out = idxRef.current
      .map((p) => {
        let score = 0;
        if (p.title.toLowerCase().includes(t)) score += 5;
        if (p.text.toLowerCase().includes(t)) score += 1;
        return { ...p, score };
      })
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    setHits(out);
  };

  const onKey = (e) => {
    if (e.key === "Escape") { setHits([]); e.currentTarget.blur(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, hits.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter" && sel >= 0 && hits[sel]) location.href = "/" + hits[sel].slug;
  };

  const snippet = (h, term) => {
    const t = term.trim().toLowerCase();
    const at = h.text.toLowerCase().indexOf(t);
    if (at < 0) return h.text.slice(0, 90);
    return (
      <>
        {h.text.slice(Math.max(0, at - 34), at)}
        <mark>{h.text.substr(at, t.length)}</mark>
        {h.text.substr(at + t.length, 56)}
      </>
    );
  };

  return (
    <nav className="side">
      <div className="search">
        <input
          id="q"
          type="search"
          placeholder="Search docs…  ( / )"
          autoComplete="off"
          value={q}
          onChange={(e) => runSearch(e.target.value)}
          onKeyDown={onKey}
        />
        {hits.length > 0 && (
          <div id="qres" ref={boxRef}>
            {hits.map((h, i) => (
              <a key={h.slug} href={"/" + h.slug} className={i === sel ? "sel" : ""}>
                <span className="qt">{h.title}</span>
                <span className="qs">{snippet(h, q)}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="nav-group">Overview</div>
      <a href="/" className={active === "" ? "active" : ""}>Start here</a>

      {NAV.map(({ group, pages }) => (
        <div key={group}>
          <div className="nav-group">{group}</div>
          {pages.map(([slug, title]) => (
            <a key={slug} href={"/" + slug} className={active === slug ? "active" : ""}>{title}</a>
          ))}
        </div>
      ))}

      <div className="nav-group">Diagrams — zoomable</div>
      {DIAGRAMS.map(([slug, title]) => (
        <a key={slug} href={"/view/" + slug} className={active === "view/" + slug ? "active" : ""}>{title}</a>
      ))}
    </nav>
  );
}
