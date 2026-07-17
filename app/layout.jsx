import "./globals.css";
import Sidebar from "./Sidebar.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

export const metadata = {
  title: "MapleOne · Architecture",
  description: "MapleOne engineering bible — modules, infra, AI pipelines, deployment.",
};

// Runs before paint so the theme never flashes. Stored choice wins over system.
const THEME_SCRIPT = `(()=>{try{const t=localStorage.getItem("theme");
document.documentElement.dataset.theme=(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))?"dark":(t||"light");}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <header>
          <span className="brand"><a href="/">MapleOne · Architecture</a></span>
          <span className="sub">MapleOne engineering documentation</span>
          <ThemeToggle />
        </header>
        <div className="wrap">
          <Sidebar />
          {children}
        </div>
        <footer>
          Maple Studios · internal · source of truth: <code>content/*.md</code> — edit the
          markdown, push, and Vercel redeploys.
        </footer>
      </body>
    </html>
  );
}
