"use client";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [label, setLabel] = useState("auto");
  useEffect(() => { setLabel(localStorage.getItem("theme") || "auto"); }, []);

  const cycle = () => {
    const cur = localStorage.getItem("theme");
    const next = cur === "dark" ? "light" : cur === "light" ? null : "dark"; // auto -> dark -> light -> auto
    if (next) localStorage.setItem("theme", next);
    else localStorage.removeItem("theme");
    const eff = next || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = eff;
    setLabel(next || "auto");
  };

  return (
    <button className="theme-btn" onClick={cycle} aria-label="Toggle color theme">
      Theme: <span>{label}</span>
    </button>
  );
}
