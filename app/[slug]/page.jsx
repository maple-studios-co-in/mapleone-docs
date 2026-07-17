import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { notFound } from "next/navigation";
import DocRenderer from "../DocRenderer.jsx";
import { KNOWN, LOGOS, prevNextFor } from "../../lib/site.mjs";

const CONTENT = join(process.cwd(), "content");

export function generateStaticParams() {
  return readdirSync(CONTENT)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""))
    .filter((slug) => KNOWN.has(slug))
    .map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const raw = safeRead(slug);
  const title = raw ? (raw.match(/^# (.+)$/m) || [, slug])[1] : slug;
  return { title: `${title} · MapleOne Architecture` };
}

function safeRead(slug) {
  try { return readFileSync(join(CONTENT, slug + ".md"), "utf8"); } catch { return null; }
}

export default async function DocPage({ params }) {
  const { slug } = await params;
  if (!KNOWN.has(slug)) notFound();
  const markdown = safeRead(slug);
  if (markdown == null) notFound();

  const logos = LOGOS[slug];
  const { prev, next } = prevNextFor(slug);

  return (
    <>
      <main id="main">
        {logos && (
          <div className="logo-row">
            {logos.map(([src, name]) => (
              <span className="logo-chip" key={name}>
                <img src={src} alt={name} loading="lazy" />
                <span>{name}</span>
              </span>
            ))}
          </div>
        )}
        <DocRenderer markdown={markdown} />
        <div className="pn">
          {prev ? (
            <a className="pn-a" href={"/" + prev[0]}><span>← Previous</span><b>{prev[1]}</b></a>
          ) : <span />}
          {next ? (
            <a className="pn-a pn-r" href={"/" + next[0]}><span>Next →</span><b>{next[1]}</b></a>
          ) : <span />}
        </div>
      </main>
      <aside className="toc">
        <div className="toc-t">On this page</div>
        <div id="toc" />
      </aside>
    </>
  );
}
