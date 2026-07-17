# What the team still needs — by role

The gap analysis: everything an **SDE, frontend engineer, DevOps engineer, and ML engineer** would need to *develop, maintain, and deploy* MapleOne that doesn't exist yet — plus what already does, so nobody rebuilds it. Priorities: **P0** = before Maple Enterprise touches the system · **P1** = first month of operation · **P2** = when scale/second customer demands. This page complements [team-tasks.md](team-tasks.html) (who does what now); this is the standing infrastructure of *how we work*.

## Already in place (don't rebuild)

Turborepo monorepo with per-module apps · CI (lint + vitest) with SSH deploys · JWT auth/RBAC libraries proven in three repos · Flipt flags · tenantDb multi-tenancy · this docs site (generated, diagram-validated) · regression plan pattern (quotations R-suites) · Playwright config (exists, not in CI) · deployment runbook + learning path.

---

## SDE — backend / product engineering

**To develop**
| Need | Why | Priority |
|---|---|---|
| One-command bootstrap (`scripts/dev-setup.sh`: Postgres, DBs, seed, env) | Today setup knowledge lives in READMEs + this chat history; a new hire should be productive in an hour | P0 |
| Deterministic **seed fixtures** (demo tenant, clients, quotes, shoots) | Everyone tests against the same rich data; screenshots/demos reproducible | P0 |
| **API contract docs** (OpenAPI per module, generated or hand-kept) | Modules integrate over REST; contracts currently live in route source only | P1 |
| **Boundary enforcement** (ESLint rule: no `apps/*` importing `apps/*`) | The invariant holds today by discipline only — one lazy import breaks the architecture silently | P1 |
| Pre-commit hooks (typecheck + lint staged) | CI catches late; hooks catch in seconds | P2 |

**To maintain**
| Need | Why | Priority |
|---|---|---|
| **Error tracking** (Sentry or GlitchTip self-hosted) in every app | Today a prod exception is invisible until a user complains; the AI-parse route especially | P0 |
| **Migration discipline**: `prisma migrate` replaces `db push` everywhere | `db push` can't be replayed, diffed, or rolled back; blocks confident schema evolution | P1 |
| Integration tests for the money paths (quote→PDF, login, share links) run in CI against a real Postgres | Unit tests (23 in quotations) don't cover route+DB behavior; the mass-assignment class of bug is invisible to them | P1 |
| **Dependency vulnerability scanning** (Dependabot, or an `npm audit` gate in CI) | One workspace lockfile feeds all 19 apps — a single vulnerable transitive dependency ships everywhere at once, and today nothing watches it | P1 |
| A **CHANGELOG discipline** per module (or conventional commits + auto-notes) | "What changed since the client last looked" is a sales and support question | P2 |

**To deploy**: covered by [deployment-runbook.md](deployment-runbook.html) — SDE-side blockers are the Dockerfiles (D1) and `/api/health` (D2).

## Frontend engineer

**To develop**
| Need | Why | Priority |
|---|---|---|
| **Component workbench** for `@maple/ui` (Storybook, or a lightweight preview app) | The design system is real but invisible — no place to see/develop components in isolation; doubly needed once published as a package | P1 |
| **Design tokens doc** (colors, type scale, spacing, radii as the single reference) | Today tokens live in `theme.css`; a reference page prevents ad-hoc hex values creeping in | P1 |
| Browser/device support matrix (explicit, tested) | Kirti Nagar dealers run old Android Chrome; nobody has stated what we support | P1 |
| Shared **icon + asset pipeline** (one icon set, optimized exports) | Prevents each module accumulating its own icons | P2 |

**To maintain**
| Need | Why | Priority |
|---|---|---|
| **Visual regression tests** (Playwright screenshots on key pages, or Chromatic once Storybook exists) | A theme-token change touches every module; today only eyeballs catch breakage | P1 |
| **Accessibility pass + CI check** (axe on key flows) | Login, builder, review screens; also a sales point for enterprise | P2 |
| **Web analytics** (self-hosted PostHog/Umami) on the marketing site + apps | "Which modules do users actually open" should drive the roadmap; currently zero telemetry | P1 |
| Performance budget on client-facing pages (galleries, share links, PDFs) | These pages ARE the customer's brand experience; CloudFront helps only if payloads are sane | P2 |

## DevOps engineer

Beyond the runbook stages (which are the P0s), the standing infrastructure:

| Need | Why | Priority |
|---|---|---|
| **Environment matrix** doc: every env var × module × environment | Scattered `.env`s are how prod breaks at 9pm; pairs with `render-env.sh` | P0 |
| **Log aggregation** (CloudWatch Logs groups per service, retention set) | `docker logs` on a box doesn't survive container replacement | P0 |
| **Alert escalation path**: who gets paged, in what order, via what channel | An alarm nobody owns is decoration | P0 |
| **Backup restore automation** (scripted quarterly drill, not a wiki page) | The drill only happens if it's a script + calendar invite | P1 |
| **Staging environment** that mirrors prod topology (can be a cheaper box) | `develop` branch auto-deploys somewhere clients never see; CI's Playwright suite runs here | P1 |
| **IaC** (Terraform/OpenTofu) once resources stabilize | Click-ops is fine for Phase 2; the moment there are two customer stacks, drift begins | P2 |
| **Cost dashboard** (AWS budgets + the AI spend log in one view) | The "own models yet?" decision and white-label pricing both need real numbers | P1 |
| Status page (even a manual one) for white-label customers | "Is it down for everyone?" answered without support tickets | P2 |
| Access management: named IAM users, least-privilege deploy role, offboarding checklist | The first contractor makes this urgent retroactively | P1 |

## ML engineer

The AI layer's standing needs — the fine-tuning loop in [ai-layer.md](ai-layer.html) requires this scaffolding to be real:

| Need | Why | Priority |
|---|---|---|
| **Correction capture pipeline** (review-screen edits → gateway → versioned dataset on S3) | The training data only exists if captured from day one; retrofitting loses months | P0 (design), P1 (build) |
| **Eval harness + golden sets** (real catalogs with verified answers; scored runs; report vs incumbent) | Without evals, every prompt/model change is a vibe; quotations' regression catalogs are the seed | P1 |
| **Prompt/schema versioning** (prompts in git, version stamped into every AiRequest log row) | "Which prompt produced this bad parse" must be answerable | P1 |
| **Spend & quality monitoring** (per-tenant ₹, refusal rate, fallback rate, parse-confidence distribution over time) | Cost drift and quality drift are both invisible today; the gateway log is the substrate | P1 |
| **Experiment tracking** (MLflow/W&B — free tiers fine) when fine-tuning starts | LoRA runs without tracked configs/metrics are unreproducible | P2 |
| **Model registry + rollout rules** (the `ModelVersion.routable` gate in [er-platform.md](er-platform.html): only eval-winners route; instant rollback) | Prevents "the new model felt better" deployments | P2 |
| **PII/data hygiene policy** for training data (client names/rates in catalogs — decide: mask, hash, or contract-cover) | Enterprise clients will ask; DPDP applies | P1 |
| GPU access strategy (rented spot for experiments; no purchases until the spend log justifies) | Keeps Step C honest | P2 |

## The shared list (everyone's problem)

1. **A staging environment** — appears in three columns above; it's the single highest-leverage missing piece after the runbook itself.
2. **Error tracking** — same; every role debugs blind today.
3. **The B1–B10 security fixes** ([team-tasks.md](team-tasks.html) carries the canonical registry) — nothing above matters if the front door is open.
4. **Conventions doc** (branch naming exists in GIT-WORKFLOW.md; add: PR review rules, definition-of-done, who merges) — cheap to write now, expensive to retrofit culture later.

*Rule of thumb for all of it: adopt the boring, self-hostable, free-tier version first (GlitchTip before Sentry SaaS, Umami before Amplitude, MLflow before W&B enterprise). Upgrade when a limit hurts, not before.*
