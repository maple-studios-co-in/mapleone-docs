# Testing strategy — the master plan

The single page the per-module "Testing — how we verify this module" sections hang off. Modules own their cases; this page owns the shape of the whole thing: what layers exist, what runs where, the one canonical registry of named regression cases, and the rules that keep coverage honest. Companion pages: [team-tasks.md](team-tasks.html) (the B1–B11 blockers registry), [engineering-needs.md](engineering-needs.html) (the P0/P1 scaffolding this plan assumes), [cicd-pipeline.md](cicd-pipeline.html) (what CI does today), [ai-layer.md](ai-layer.html) (the eval harness this page treats as a test suite).

## 1 Current reality — verified numbers, not aspirations

Counted from the repos on disk (not from memory, not from older docs):

| Repo / area | Automated tests | Detail |
|---|---|---|
| maple-quotations (standalone) | **23 unit** | `tests/unit/totals.test.ts` (15) + `tests/unit/share.test.ts` (8), vitest, `test:coverage` wired. **Zero** integration, **zero** E2E. `docs/TESTING.md` and `docs/REGRESSION.md` §0 still say 15 — stale, fix on next touch. |
| maple-quotations manual | **R1–R9** | `docs/REGRESSION.md`, ~45–60 min full pass. The only regression practice that exists anywhere today, and the pattern §2.4 generalizes. |
| maple-suite `packages/core` | **10 unit** | `session.test.ts` (2) + `rbac.test.ts` (6) + `utils.test.ts` (1, `money()` only) + `ui/button.test.tsx` (1). All green under root `npm test`. |
| maple-suite `apps/*` (19 apps) | **0** | No test file under any app — verified by `find apps -name "*.test.*"`. The root `vitest.config.ts` already globs `apps/**/*.test.{ts,tsx}`, so the harness is waiting; only files are missing. |
| maple-suite E2E | **1 spec, 2 tests** | `e2e/login.spec.ts` (SSO smokes). Playwright configured, **not in CI** ([cicd-pipeline.md](cicd-pipeline.html) is explicit: CI has no live stack). |
| maple-photoshoot | **0 runnable** | No `test` script, no vitest dependency. Four vendored core test files (~10 cases) sit dead in the tree; copying quotations' vitest setup revives them for free. |

So: 33 running unit tests suite-wide, one two-test E2E smoke, one manual regression plan, and **zero automated coverage of any route+DB behavior** — which is exactly the layer where the B1–B11 blocker class lives (mass-assignment, unscoped upserts, missing guards are all invisible to unit tests, as [engineering-needs.md](engineering-needs.html) already notes).

## 2 The pyramid for this codebase

```mermaid
flowchart TD
    MAN["Manual regression sets<br/>quotations R1-R9 pattern generalized<br/>release-gate pass, quarterly full pass"]
    E2E["E2E - Playwright against the compose stack<br/>8 money-path journeys<br/>nightly on stage, release branches"]
    INT["Integration - route handlers + real Postgres<br/>the REG registry lives here<br/>runs on every PR via a service container"]
    UNIT["Unit - pure lib functions, vitest<br/>root config already globs packages and apps<br/>runs everywhere, seconds"]
    UNIT --> INT
    INT --> E2E
    E2E -.-> MAN
```

### 2.1 Unit — pure functions only

Vitest, colocated `*.test.ts`, picked up by the existing root config with zero wiring. The rule that keeps this layer honest: **if it needs a DB, a request object, or the filesystem, it is not a unit test** — extract the pure part first (the pattern module pages already prescribe: orders' coercion table, payments' rollup function, leads' phone normalizer, photoshoot's whitelist loop). Highest-value targets already named on module pages: `computeTotals` / `computeInvoiceTotals` (with the ₹540 packing-tax divergence fixture pinned in both), the share codec, `safeNext`, `rangeFileResponse`, `guideToHtml`, `hrBody()` snapshots, web's block-registry parity check.

### 2.2 Integration — route + real Postgres, and how we host the DB

Route handlers invoked directly (Next.js route functions are plain async functions taking a `Request`), sessions minted with `signSession` and a throwaway secret, against a **dedicated scratch Postgres** — one database per CI job, one schema per vitest worker, `prisma db push` to create (fast, disposable, no migration replay needed for tests).

**Decision: a dedicated test DB (compose locally, a GitHub Actions service container in CI) — not testcontainers.** Justification:

- The team already lives in docker compose (`scripts/dev.sh`, the deploy box); a `postgres-test` service in the existing compose file is zero new concepts.
- testcontainers-node needs a Docker socket wherever tests run — fine on laptops, an extra docker-in-docker headache on the single deploy box and inside CI containers; the service-container pattern is GitHub-native and free.
- `prisma db push` against an empty database takes ~2 s; per-worker schemas (`?schema=w${VITEST_WORKER_ID}`) give parallel isolation without container-per-suite startup cost.
- Revisit when customer #3 forces the Fargate migration ([team-tasks.md](team-tasks.html) Lane 2 Later) — testcontainers earns its keep when environments multiply.

### 2.3 E2E — Playwright, the money paths only

Against the running compose stack (locally via `scripts/dev.sh` + Caddy hostnames; nightly against stage once it exists — [engineering-needs.md](engineering-needs.html) P1). Eight journeys, chosen because each one crosses a seam no lower layer can reach:

1. **SSO roundtrip** — no cookie → admin login `?next=` → back on the tool URL (extends the existing `login.spec.ts`).
2. **Quote a 3BHK** — build, GST split, save, reload, grand total identical (quotations story 1).
3. **Share-link roundtrip** — Devanagari client name, fresh incognito context, photos stripped (quotations story 2).
4. **Invoice → auto-payment hop** — save an invoice in one app, find the due row in payments (the suite's only cross-app money handoff).
5. **Order pipeline** — create, advance through all four stages, reload, board persists.
6. **Catalog publish** — upload fixture PDF, publish, open `/c/{token}` in a session-less context, flip pages, download.
7. **Photoshoot publish** — upload mp4 fixture, publish, video plays and seeks (Range) in a fresh context.
8. **Admin-down fallback** — stop the admin container, load the marketing site, `DEFAULT_SITE` renders within budget (web's one browser test worth having).

### 2.4 Manual regression sets — the R-pattern generalized

Quotations' `docs/REGRESSION.md` (R1–R9, numbered checks, expected results, ~1 h) is the template. Each suite module gets an R-page **only for what automation can't see**: visual/print quality (PDF layout, letter formatting), clipboard flows, popup-blocker fallbacks, and the AI-cost-bearing paths (R6-style, run sparingly). Everything else in the module testing sections belongs to the automated layers — a manual step that merely re-checks an automated assertion is deleted. Cadence: the relevant module's R-pass before any release that touches it; full pass quarterly (same calendar slot as the restore drill, [deployment-runbook.md](deployment-runbook.html) Stage 6).

## 3 The REG-* registry — one canonical list

Every **named regression case** from the module testing sections, in one table. This is the list CI reports against: each case exists in the tree as a test (red ones as `test.fails`/expected-fail **with the reason string naming the fix that flips it**), and a case leaving this table is a reviewed decision, never a quiet deletion.

**Naming convention going forward: `REG-<module>-<slug>`.** The table keeps each page's current name (qualified with the module where pages reused the same string) so the crosswalk to the module sections stays greppable; new cases use the convention from day one.

Status: **red** = failing-by-design until its fix lands · **green** = passing, pinned · **future** = written alongside the feature that creates the behavior.

| Case (as named on its page) | Module | Pins | Layer | Status |
|---|---|---|---|---|
| Login matrix | admin | route error contract, cookie attrs | integration | green |
| Branding guard gap | admin | **B5** | integration | red |
| Site CMS guard | admin | CMS gate, slug dup, cascade | integration | green |
| `currentTenant()` first-row fallback | admin | **B9** (host half) | integration | red |
| Public site feed degradation | admin | availability contract | integration | green |
| `richtext` renderer gap | admin | richtext drop (pairs with web `richtext-disappears`) | integration | red |
| Logo size cap | admin | 1.5 MB cap | integration | green |
| Reorder non-atomicity | admin | A2 lifecycle caveat | integration | green |
| `lookbook-replace-atomicity` | catalog | wipe-before-validate brick | integration | red |
| `catalog-publish-gate` | catalog | unpublished binaries reachable | integration | red |
| `catalog-token-privacy` | catalog | public meta shape | integration | green |
| `catalog-cross-tenant-404` | catalog | tenant scoping | integration | green |
| `catalog-delete-cleans-disk` | catalog | row + directory removal | integration | green |
| `REG-challan-date-throw` | challans | date PATCH 500 | integration | red |
| `REG-mass-assignment-rejection` (challans) | challans | **B4** | integration | red |
| `REG-number-collision-overwrite` (challan variant) | challans | **B10** | integration | red |
| `clientId`-dropped-on-POST | challans | create omits the link | integration | red |
| Tenant isolation (challans) | challans | tenant scoping | integration | green |
| Status free-for-all | challans | transition validation | integration | red |
| `crm-mass-assignment` | crm | **B4** | integration | red |
| `crm-count-completeness` | crm | 4-of-6 `_count` gap | integration | red |
| `crm-delete-with-records` | crm | FK-restrict 500 | integration | red |
| `crm-cross-tenant-404` | crm | tenant scoping | integration | green |
| `client-merge-covers-all-relations` | crm | future merge (DMMF reflection) | integration | future |
| PATCH gate | docs | content-injection gate | integration | green |
| Tenant isolation on the manual upsert | docs | compound-key upsert — the spot `tenantDb()` misses | integration | green |
| Fallback correctness | docs | seed/row/404 chain | integration | green |
| Image cap + mime echo | docs | 3 MB cap | integration | green |
| Read-path availability | docs | DB-down → 200 null | integration | green |
| `img src` laundering | docs | pin-until-sanitizer, then flip | integration | green |
| `ist-month-bucket` | expenses | browser-TZ month math | unit→integration | red |
| `free-string-category` | expenses | enum pass-through | integration | red |
| `finance-double-count` | expenses | same case as finance's `finance-expenses-double-count` | integration | red |
| `tenant-isolation` (expenses) | expenses | tenant scoping — never proven | integration | green |
| `approval-state-machine` | expenses | B3.2 transitions + outbox once | integration | future |
| `outbox-atomicity` | expenses | transactional event write | integration | future |
| `finance-expenses-double-count` | finance | duplicate of expenses' case — merge names | integration | red |
| `income-coercion-case` | finance | `"Income"` → expense surprise | unit | green |
| `tenant-isolation` (finance) | finance | tenant scoping — never proven | integration | green |
| `delete-no-confirm` | finance | hard delete, no guard | integration | red |
| `consumer-idempotency` | finance | duplicate event → one journal entry | integration | future |
| `preview-brand-divergence` | hr | hard-coded brand in preview | integration | red |
| `pdf-font-offline` | hr | cdnjs-at-render dependency | integration | red |
| `letters-not-persisted` | hr | zero `HrDocument` writers | integration | red |
| `vault-tenant-isolation` | hr | B3.4 vault — written first | integration | future |
| `payroll-immutability` | hr | B3.3 finalised runs | integration | future |
| `leave-writes-attendance` | hr | B3.2 exactly-once upsert | integration | future |
| `inventory-lost-update` | inventory | concurrent adjust overwrite | integration | red |
| `inventory-mass-assignment` | inventory | B4-class (same fix pattern) | integration | red |
| `inventory-empty-string-qty` | inventory | `""` → Prisma 500 | integration | red |
| `inventory-cross-tenant-404` | inventory | tenant scoping | integration | green |
| `movement-replay-idempotent` | inventory | B3.1 ledger | integration | future |
| `REG-upsert-tenant-guard` | invoices | **B8** (invoices half) | integration | red |
| `REG-number-collision-overwrite` | invoices | **B10** — silent overwrite | integration | red |
| `REG-auto-payment-orphaning` | invoices | `SetNull` orphan (owned here, asserted in payments too) | integration | red |
| `REG-mass-assignment-rejection` (invoices POST variant) | invoices | client-supplied `status` trusted | integration | red |
| Auto-payment idempotency | invoices | re-save duplicates + drift | integration | red |
| `leads-mass-assignment` | leads | **B4** | integration | red |
| `leads-cross-tenant-404` | leads | tenant scoping | integration | green |
| `leads-post-ignores-clientid` | leads | POST drops `clientId` | integration | green |
| `lead-convert-idempotent` | leads | B1 convert + dedupe | integration | future |
| `REG-mass-assignment-rejection` (orders) | orders | **B4** | integration | red |
| `REG-number-collision-overwrite` (orders) | orders | **B10**-class (`MO-` code) | integration | red |
| Tenant isolation (orders) | orders | tenant scoping | integration | green |
| Stage validation | orders | any-string stage accepted | integration | red |
| `REG-mass-assignment-rejection` (payments) | payments | **B4** | integration | red |
| `REG-auto-payment-orphaning` (payments view) | payments | same case as invoices' — one test, two pages cite it | integration | red |
| `REG-status-rollup` | payments | B1.1 rollup contract | integration | red |
| Seeded-due drift | payments | `findFirst` silent skip | integration | red |
| Tenant isolation (payments) | payments | tenant scoping | integration | green |
| Delete hygiene | payments | `act:delete` absent — pinned | integration | green |
| Cross-tenant IDOR stays closed | photoshoot | tenant scoping | integration | green |
| Published gate on media routes | photoshoot | **B6** | integration | red |
| Import URL SSRF guard | photoshoot | **B6** | integration | red |
| `act:publish` / `act:delete` enforcement | photoshoot | RBAC batch | integration | red |
| Login rate limit | photoshoot | **B6** (quotations parity) | integration | red |
| Status value whitelist | photoshoot | any-string status — pinned | integration | green |
| Range playback | photoshoot | 206 / `Content-Range` | integration | green |
| Upload tail | photoshoot | row flip + file on disk | integration | green |
| `po-number-collision-500` | purchase-orders | **B10** (~16.7 min cycle) | integration | red |
| `status-free-string` | purchase-orders | enum pass-through | integration | red |
| `patch-mass-assignment` | purchase-orders | B4-class | integration | red |
| `received-reversal` | purchase-orders | unordered transitions | integration | red |
| `tenant-isolation` (purchase-orders) | purchase-orders | tenant scoping — never proven | integration | green |
| `delete-is-hard` | purchase-orders | current design pinned | integration | green |
| Server-recomputed total | quotations | client total ignored | integration | green |
| Cross-client quote overwrite | quotations | fixed critical — regression | integration | green |
| Terms persistence | quotations | fixed critical — regression | integration | green |
| Tenant-scoped delete guard | quotations | tenant scoping | integration | green |
| Bulk import cap + dedupe | quotations | 200-item cap, backfill | integration | green |
| Settings admin gate | quotations | 403 + key masking | integration | green |
| Login rate limit | quotations | 429 on 9th failure | integration | green |
| Asset size cap | quotations | 413 at 4 MB + 1 | integration | green |
| `tasks-whitelist-holds` | tasks | **B4 reference pattern** — the one that already passes | integration | green |
| `tasks-empty-title-500` | tasks | `\|\| null` title bug | integration | red |
| `tasks-assignee-validated` | tasks | FK 500 on garbage id | integration | red |
| `tasks-users-minimal-shape` | tasks | **B7** (shape half — see gap G4) | integration | green |
| `tasks-cross-tenant-404` | tasks | tenant scoping | integration | green |
| Roles escalation | users | **B1** — pre-pilot blocker | integration | red |
| `manage_users` guard | users | unguarded user create | integration | red |
| Escalation ceiling | users | `newPerms ⊆ actorPerms` | integration | red |
| Dangling-role delete | users | 409 + `?reassignTo=` | integration | red |
| Unknown role name | users | silent lockout | integration | red |
| Last-admin guard | users | both blind spots pinned | integration | green |
| No hash leakage | users | `passwordHash` never in response | integration | green |
| Tenant isolation (users) | users | tenant scoping | integration | green |
| `richtext-disappears` | web | registry gap (pairs with admin's renderer-gap case) | integration | red |
| `fallback-order-drift` | web | `DEFAULT_SITE` vs seed drift | unit | red |
| `cms-slow-fallback` | web | 2.5 s budget trade-off pinned | integration | green |
| `unknown-type-null` | web | unregistered type renders null | integration | green |
| `preview-token` | web | B1 preview flow | integration | future |

### 3.1 Blockers with no case yet — create these

The crosswalk against [team-tasks.md](team-tasks.html) B1–B11 leaves four registry entries to be **created** (they exist in no module testing section today):

| New case | Pins | Home | What it asserts |
|---|---|---|---|
| `REG-suite-api-tool-gate` | **B2** | cross-module / shared helper | with a module's flag off, its API routes return 403/404 — not just its pages (parameterized over every app once the shared `canAccessTool` helper lands) |
| `REG-seed-prod-password` | **B3** | all three repos' seed scripts | seed run with `NODE_ENV=production` and no admin-password env **aborts**; with it, the seeded hash matches |
| `REG-quotations-upsert-tenant-guard` | **B8** (suite-quotations half) | suite `apps/quotations` | same contract as invoices' `REG-upsert-tenant-guard` — the suite's quotations POST has the identical unscoped upsert and no case names it |
| `REG-permsforrole-tenant-filter` | **B11** | core / users | two tenants, same role name: a null-tenant user's login must not match tenant B's role (`tenantId ?? undefined` drops the filter — needs a real two-tenant DB, a mocked-prisma unit cannot catch it) |

Also: **B9's second half** (no prod assertion on `AUTH_SECRET`/`SSO_DOMAIN` dev fallbacks) needs a boot-time assertion test alongside `REG-seed-prod-password`, and **B7's fix half** (user list reachable under `tool:tasks`) needs a red case beside `tasks-users-minimal-shape`, which only pins the response shape.

## 4 CI wiring — what runs where

| Trigger | Runs | Gate |
|---|---|---|
| Every PR | lint + build (turbo) → **unit** (`npm test`, no DB, fails fast) → **integration** (vitest, Postgres service container) | merge blocked on all three; expected-fail reds pass, **unexplained** reds block |
| Push to `main` / `develop` | same as PR + image build/push (ECR, per [deployment-runbook.md](deployment-runbook.html) Stage 2) → deploy-on-merge | deploy blocked on tests |
| Nightly | **E2E** (Playwright, the 8 journeys of §2.3) against stage · **AI eval harness** scheduled run ([ai-layer.md](ai-layer.html), §7) | failures page the lane owner (§8), don't block merges |
| Release branch / tag | E2E + the touched modules' manual R-pass | release checklist item |

The PR job, concretely (extends the existing `ci.yml` from [cicd-pipeline.md](cicd-pipeline.html)):

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: maple_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    env:
      DATABASE_URL: postgresql://postgres:test@localhost:5432/maple_test
      AUTH_SECRET: throwaway-ci-secret
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx prisma generate --schema packages/db/prisma/schema.prisma
      - run: npx turbo run lint build
      - run: npm test                     # unit — no DB, seconds
      - run: npm run db:push:test         # prisma db push into the service container
      - run: npm run test:integration     # vitest -c vitest.integration.config.ts
```

`vitest.integration.config.ts` globs `apps/**/*.itest.{ts,tsx}` (distinct suffix keeps the layers separable), sets `maxWorkers` modest, and points each worker at its own schema. Photoshoot and quotations repos get the same job shape once their D1 Dockerfiles land ([team-tasks.md](team-tasks.html) Lane 3).

## 5 Test data strategy

- **Seed fixtures are the shared corpus.** The deterministic demo-tenant seed ([engineering-needs.md](engineering-needs.html) SDE P0 — clients, quotes, shoots) is the same data local dev, integration tests, stage, and screenshots all use. One source of truth in `packages/db` (and each standalone repo's `prisma/seed`), versioned with the schema.
- **Factory helpers over ad-hoc inserts.** A small `@maple/test-kit` (or `tests/factories.ts` per repo): `makeTenant()`, `makeSession(tenant, perms)` (wraps `signSession` with the throwaway secret), `makeClient()`, `makeInvoice()` — defaults sensible, overrides explicit. Route tests read as scenarios, not setup walls.
- **Two tenants, always.** The base integration fixture seeds tenant A *and* tenant B unconditionally — never a single-tenant world. Every mutating-route test gets its cross-tenant 404 assertion mechanically (the `*-cross-tenant-404` / tenant-isolation rows above), which is what makes the **B4 / B8 / B11 class structurally caught** rather than individually remembered: mass-assignment of `tenantId`, unscoped upserts, and dropped tenant filters all *only* manifest when a second tenant exists to collide with.
- **Binary fixtures stay tiny and committed:** the 2-page PDF (catalog), the small mp4 (photoshoot), the receipt image (expenses B3.1) — kilobytes, in-tree, so integration suites never fetch anything.
- **AI fixtures are golden sets, not seeds** — §7; they live with the eval harness, versioned on S3, never inlined into route tests.

## 6 Coverage policy that isn't theater

No coverage-percentage gate, ever — a % target buys assertion-free test files. Instead, three rules the Definition of Done blocks on:

1. **Every B-fix lands with its REG case in the same PR**, flipping red→green — the flip *is* the acceptance test, and the case stays in the suite forever after (the registry row moves to green, never disappears).
2. **Every new or touched route lands with its integration case**: tenant scoping (against the two-tenant fixture) + its error contract. Every new pure function lands with its unit file. Reviewers reject PRs missing them; there is no post-hoc "test debt" backlog.
3. **Expected-fail is a contract, not a shrug.** A red case carries a reason string naming the fix that flips it (`expected-fail: A5 recipe 1, whitelist PATCH fields`). The only number reported on the CI dashboard is **unexplained reds** — and it must be zero.

The `test:coverage` script stays (it's useful for *finding* untested branches); it just never gates.

## 7 AI testing specifics

The eval harness ([ai-layer.md](ai-layer.html), [team-tasks.md](team-tasks.html) Lane 1 item 4) **is the test suite for prompts and models** — same discipline, different substrate:

- **Golden sets** = real catalogs with verified answers, seeded from quotations' regression catalogs. Versioned datasets on S3 ([engineering-needs.md](engineering-needs.html) ML P0/P1); a golden set changes only by an additive, reviewed diff — silently editing expected answers is the AI equivalent of deleting a red test.
- **Scored runs against the incumbent.** Every prompt or model change runs the harness and reports vs the current config; [er-platform.md](er-platform.html)'s `EvalRun` rows are the record, and `ModelVersion.routable` flips only on an eval win — the AI layer's merge gate.
- **Attribution requires versioning:** prompts in git, `promptVersion` stamped into every `AiRequest` row, so a regression is attributable to prompt vs model.
- **Refusal and fallback paths are test cases, not incidents:** the harness includes inputs that *should* refuse (garbage PDFs, over-budget tenants) and asserts the fallback contract (structured error, no partial parse committed, spend logged). The review-screen "flagged fields are never auto-submitted" rule (expenses B3.1) gets a fixture-image case in the module suite.
- **Cadence:** scheduled nightly (cheap config, small set) + full set on any PR to the gateway or a prompt file. Spend per run is logged like any tenant's.

## 8 Ownership and cadence — by [team-tasks.md](team-tasks.html) lane

| Lane | Owns | Cadence |
|---|---|---|
| **Fullstack dev** | The REG registry rows for B-fixes (rule 6.1 applies to every "Now" item), module unit/integration suites, keeping expected-fail reasons current | Per PR; Monday sync reviews any unexplained red |
| **DevOps + lead dev** | CI wiring (§4), the Postgres service container, stage environment (which unblocks nightly E2E), Playwright nightly job, review gates for B-fixes | CI now; nightly E2E when stage lands; lead dev signs off every registry-row status change |
| **AI infra engineer** | Eval harness + golden sets (§7), scheduled eval runs, refusal/fallback cases, spend-per-run reporting | Harness v1 in "Next"; nightly schedule thereafter; full run per gateway PR |
| **Everyone** | The quarterly full manual R-pass (§2.4), same calendar slot as the restore drill | Quarterly |

The Monday 30-minute sync already reviews the task board; add one standing agenda line: *unexplained reds and registry changes since last week*. That single question is the whole test-health review — everything else is enforced by CI and the DoD.
