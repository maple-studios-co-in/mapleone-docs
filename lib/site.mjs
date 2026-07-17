// Single source of truth for navigation, diagram viewers, per-page tool logos.
// Imported by server components and the prepare script.

export const NAV = [
  { group: "Data model", pages: [["er-suite", "Suite ER diagram"]] },
  { group: "Flows", pages: [
    ["seq-sso-login", "SSO login"],
    ["seq-whitelabel-request", "White-label request"],
    ["seq-ai-catalog-parse", "AI catalog parse"],
  ]},
  { group: "Platform", pages: [
    ["deps-graph", "Dependency graph"],
    ["cross-module", "Cross-module map"],
    ["ai-layer", "AI layer (current)"],
    ["cicd-pipeline", "CI/CD pipeline"],
    ["event-catalog", "Event catalog"],
  ]},
  { group: "Fold-in & access", pages: [
    ["foldin-map", "Fold-in migration map"],
    ["rbac-matrix", "RBAC matrix"],
  ]},
  { group: "Modules", pages: [
    ["module-quotations", "Quotations"],
    ["module-photoshoot", "Photoshoot"],
    ["module-leads", "Leads"],
    ["module-crm", "CRM / Clients"],
    ["module-tasks", "Tasks"],
    ["module-orders", "Orders"],
    ["module-challans", "Challans"],
    ["module-invoices", "Invoices"],
    ["module-payments", "Payments"],
    ["module-catalog", "Catalog"],
    ["module-inventory", "Inventory"],
    ["module-purchase-orders", "Purchase orders"],
    ["module-finance", "Finance"],
    ["module-expenses", "Expenses"],
    ["module-hr", "HR"],
    ["module-users", "Team & access"],
    ["module-docs", "Docs"],
    ["module-admin", "Admin (identity home)"],
    ["module-web", "Web (marketing)"],
  ]},
  { group: "Infrastructure", pages: [
    ["team-tasks", "Team task board"],
    ["engineering-needs", "Engineering needs (by role)"],
    ["platform-architecture", "Platform architecture"],
    ["aws-deployment", "AWS deployment plan"],
    ["deployment-runbook", "Deployment runbook (team)"],
    ["testing-strategy", "Testing strategy (master)"],
    ["learning-path", "Learning path — AWS & AI"],
    ["er-platform", "Platform & AI ER (proposed)"],
  ]},
  { group: "Business", pages: [
    ["sales-faq", "Sales — buyer questions"],
    ["investor-brief", "Investor brief"],
  ]},
  { group: "Infra deep-dives", pages: [
    ["infra-events", "Events & messaging"],
    ["infra-caching", "Caching & Redis"],
    ["infra-containers", "Docker & Kubernetes"],
    ["infra-observability", "Observability"],
    ["infra-aws-services", "AWS services (SageMaker & Bedrock)"],
  ]},
  { group: "Reference", pages: [["style-preview", "Diagram style sample"]] },
];

export const DIAGRAMS = [
  ["platform-architecture", "Platform architecture (zoom)"],
  ["aws-architecture", "AWS deployment (zoom)"],
  ["dev-architecture", "Developer architecture (zoom)"],
  ["suite-overview", "Suite overview (zoom)"],
];

const DEV = (n, v = "original") => `https://cdn.jsdelivr.net/gh/devicons/devicon/icons/${n}/${n}-${v}.svg`;
const SI = (n) => `https://cdn.simpleicons.org/${n}`;

export const LOGOS = {
  "infra-aws-services": [[DEV("amazonwebservices", "plain-wordmark"), "AWS"], [SI("anthropic"), "Anthropic"], [SI("openai"), "OpenAI"]],
  "infra-events": [[DEV("apachekafka"), "Kafka"], [DEV("postgresql"), "Postgres"], [DEV("redis"), "Redis"]],
  "infra-caching": [[DEV("redis"), "Redis"], [DEV("postgresql"), "Postgres"]],
  "infra-containers": [[DEV("docker"), "Docker"], [DEV("kubernetes"), "Kubernetes"], [DEV("amazonwebservices", "plain-wordmark"), "AWS"]],
  "infra-observability": [[DEV("grafana"), "Grafana"], [DEV("prometheus"), "Prometheus"], [SI("sentry"), "Sentry"]],
  "module-payments": [[SI("razorpay"), "Razorpay"]],
  "ai-layer": [[SI("anthropic"), "Anthropic"], [SI("openai"), "OpenAI"]],
  "aws-deployment": [[DEV("amazonwebservices", "plain-wordmark"), "AWS"]],
  "deployment-runbook": [[DEV("amazonwebservices", "plain-wordmark"), "AWS"], [DEV("docker"), "Docker"], [SI("githubactions"), "GitHub Actions"]],
  "cicd-pipeline": [[SI("githubactions"), "GitHub Actions"], [DEV("docker"), "Docker"]],
  "learning-path": [[DEV("amazonwebservices", "plain-wordmark"), "AWS"], [DEV("docker"), "Docker"], [SI("anthropic"), "Anthropic"]],
};

export const STACK_LOGOS = [
  [DEV("nextjs"), "Next.js"], [DEV("react"), "React"], [DEV("prisma"), "Prisma"],
  [DEV("postgresql"), "Postgres"], [DEV("docker"), "Docker"], [DEV("amazonwebservices", "plain-wordmark"), "AWS"],
  [SI("anthropic"), "Anthropic"], [DEV("redis"), "Redis"], [DEV("apachekafka"), "Kafka"],
  [SI("razorpay"), "Razorpay"], [DEV("grafana"), "Grafana"], [SI("githubactions"), "Actions"],
];

export const FLAT = NAV.flatMap((g) => g.pages.map(([s, t]) => [s, t, g.group]));
export const KNOWN = new Set(FLAT.map(([s]) => s));

export function prevNextFor(slug) {
  const i = FLAT.findIndex(([s]) => s === slug);
  if (i < 0) return { prev: null, next: null };
  return { prev: FLAT[i - 1] || null, next: FLAT[i + 1] || null };
}
