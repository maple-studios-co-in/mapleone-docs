import { NAV, FLAT, STACK_LOGOS } from "../lib/site.mjs";

const moduleCount = NAV.find((g) => g.group === "Modules").pages.length;
const pageCount = FLAT.length;

export default function Home() {
  return (
    <main id="main">
      <h1>MapleOne engineering bible</h1>
      <p>
        Documentation generated from the code itself: Prisma schemas, route handlers, the
        Caddyfile, docker-compose, and the core packages. Every module has an implementer
        walkthrough, a manager guide, a test plan, an AI pipeline, and designed enhancements.
        Diagrams are live Mermaid with zoom and pan; the markdown in <code>content/*.md</code> is
        the source of truth and renders on GitHub too.
      </p>

      <div className="hero-stats">
        <div className="stat"><b>{pageCount}</b><span>pages</span></div>
        <div className="stat"><b>{moduleCount}</b><span>module bibles</span></div>
        <div className="stat"><b>120+</b><span>live diagrams</span></div>
        <div className="stat"><b>B1–B11</b><span>blocker registry</span></div>
      </div>

      <p>
        New here? Read the <a href="/er-suite">ER diagram</a>, then <a href="/seq-sso-login">SSO
        login</a> and <a href="/cross-module">the cross-module map</a>, then your module&apos;s page.
        Managers: every module page opens with a plain-language guide. Deploying? Start at the{" "}
        <a href="/deployment-runbook">runbook</a> with the <a href="/learning-path">learning path</a> beside it.
      </p>

      <div className="logo-row" style={{ marginTop: 18 }}>
        {STACK_LOGOS.map(([src, name]) => (
          <span className="logo-chip" key={name}>
            <img src={src} alt={name} loading="lazy" />
            <span>{name}</span>
          </span>
        ))}
      </div>

      <div className="group-grid">
        {NAV.map(({ group, pages }) => (
          <div className="gcard" key={group}>
            <h3>{group}</h3>
            {pages.map(([slug, title]) => (
              <a key={slug} href={"/" + slug}>{title}</a>
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}
