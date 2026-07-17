// Build-time asset prep: copy diagram SVGs into public/ and generate the
// client-side search index from the markdown corpus. Runs before dev & build.
import { readFileSync, writeFileSync, readdirSync, copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { KNOWN } from "../lib/site.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = join(ROOT, "content");
const PUBLIC = join(ROOT, "public");
mkdirSync(PUBLIC, { recursive: true });

// SVG diagrams the pages fetch at runtime
for (const f of readdirSync(CONTENT).filter((f) => f.endsWith(".svg"))) {
  copyFileSync(join(CONTENT, f), join(PUBLIC, f));
}

// search index — one entry per known doc page
const index = [];
for (const f of readdirSync(CONTENT).filter((f) => f.endsWith(".md"))) {
  const slug = f.replace(/\.md$/, "");
  if (!KNOWN.has(slug)) continue;
  const raw = readFileSync(join(CONTENT, f), "utf8");
  const title = (raw.match(/^# (.+)$/m) || [, slug])[1];
  const text = raw
    .replace(/```[\s\S]*?```/g, " ").replace(/<[^>]+>/g, " ")
    .replace(/[#*_`>|]/g, " ").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ").trim().slice(0, 6000);
  index.push({ slug, title, text });
}
writeFileSync(join(PUBLIC, "search-index.json"), JSON.stringify(index));
console.log(`prepare: ${index.length} search entries, SVGs copied to public/`);
