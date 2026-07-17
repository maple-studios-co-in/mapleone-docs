# Team task board — AI infra · DevOps/lead · Fullstack

Three lanes, sequenced as **Now (this week–two) → Next → Later**. Every task links to the doc that specifies it. Blockers carry the shared B-numbering — **this registry is the canonical list** ([deployment-runbook.html](deployment-runbook.html) Stage 5 tracks the B1–B3 subset inline) — and **nothing goes in front of an external user until every B is closed.** Suggested cadence: Monday 30-min sync on this board; a task isn't "done" until its doc's Status section is updated.

## Blockers registry (consolidated from all reviews)

| # | Blocker | Where documented |
|---|---|---|
| B1 | Roles API privilege escalation — any `tool:users` user can mint a `*` role | [rbac-matrix.html](rbac-matrix.html) · [module-users.html](module-users.html) |
| B2 | Flags gate pages only — disabled module's APIs stay reachable | [cross-module.html](cross-module.html) §5 |
| B3 | Seeded passwords in prod; require env-provided admin password | [deployment-runbook.html](deployment-runbook.html) Stage 5 |
| B4 | **Mass-assignment**: leads/crm/orders/payments/challans PATCH pass raw body to Prisma — `tenantId` settable cross-tenant | module pages; fix pattern already exists in the tasks app |
| B5 | Branding API writable by any signed-in role — needs `manage_roles` guard | [module-admin.html](module-admin.html) |
| B6 | Photoshoot public media routes ignore `published`; login unrate-limited; import fetches unvalidated URLs | [module-photoshoot.html](module-photoshoot.html) |
| B7 | Tasks app leaks tenant user list under `tool:tasks` gate | [module-tasks.html](module-tasks.html) |
| B8 | **Unscoped `upsert` on globally-unique `number`** in suite quotations + invoices POSTs — cross-tenant overwrite + NULL-tenantId inserts (`tenantDb()` doesn't hook upsert) | [cross-module.html](cross-module.html) §2.4 |
| B9 | Unknown Host falls back to the **first tenant row with write access** (branding writable) + `AUTH_SECRET`/`SSO_DOMAIN` have silent dev fallbacks with no prod assertion | [module-admin.html](module-admin.html) |
| B10 | Timestamp/random document numbering **silently overwrites rows on collision** (invoice 1-in-900/day via upsert; PO number-space cycles ~16.7 min; challan same pattern) — also GST Rule 46(b) non-compliant | [module-invoices.html](module-invoices.html) |
| B11 | `permsForRole`'s `tenantId ?? undefined` drops the tenant filter for null-tenant users — matches the first same-named role from **any** tenant; latent cross-tenant grant once tenant #2 exists | [rbac-matrix.html](rbac-matrix.html) gap 7 |

---

## Lane 1 — AI Infra engineer

**Now**
1. **maple-ai gateway v1** — extract quotations' `runVisionRequest`, settings encryption, and schema conventions into a service: `POST /v1/parse-catalog`, `/v1/locate-photos`, per-tenant spend log + budgets. Spec: [ai-layer.html](ai-layer.html) + [er-platform.html](er-platform.html) (AiRequest/AiBudget/ModelRoute tables). Own DB `maple_ai`.
2. **Point quotations at the gateway** behind an env flag (`AI_GATEWAY_URL` set → proxy; unset → current direct path) so rollback is instant.

**Next**
3. **Corrections capture** — review-screen edits POST to the gateway (`Correction` table): the fine-tuning dataset starts accruing from day one. [aws-deployment.html §5](aws-deployment.html).
4. **Eval harness v1** — turn the quotations regression catalogs (known answers) into a scripted eval that scores any model/prompt config; report vs incumbent. This is the gate for every future model change.
5. **Daily spend report** — cron posting yesterday's ₹ per tenant/module (runbook Stage 4 monitoring hook).

**Later**
6. Photoshoot generation route (`/v1/generate`) — revive the orphaned internal01 wizard against the gateway, not Supabase ([module-photoshoot.html](module-photoshoot.html)).
7. Bedrock spike (Step B) when a client asks for residency; own-model spike (Step C) only when the spend log crosses GPU rent. Learning: AI track in [learning-path.html](learning-path.html).

## Lane 2 — DevOps + lead dev

**Now**
1. **Runbook Stages 0–2**: IAM/MFA, Route 53, security groups, budget alarm; ECR repos + GitHub OIDC role; CI pushes tagged images. Gates in [deployment-runbook.html](deployment-runbook.html).
2. **Package publishing (step ①)** — `@maple/ui` + `@maple/core` to GitHub Packages, versioned; modules pin. Kills vendored drift ([platform-architecture.html](platform-architecture.html)). *Lead-dev half of this lane.*

**Next**
3. **Stage 3**: RDS (per-module DBs + least-priv users), S3 + CloudFront, Secrets Manager layout, `render-env.sh`.
4. **Stage 4**: the box — compose from ECR, Caddy, deploy-on-merge, CloudWatch + UptimeRobot, nightly pg_dump.
5. **Restore drill** — do it, time it, write it down (Stage 6 gate; quarterly thereafter).
6. *Lead dev:* review gates for B-fixes; own the **fold-in plan** execution order from [foldin-map.html](foldin-map.html) (Product model decision first).

**Later**
7. Entitlements→Flipt sync design (sell a module = flip a flag) · Fargate migration when customer #3 arrives · stage environment parity.

## Lane 3 — Fullstack dev

**Now — the B-fixes (in this order)**
1. **B4 mass-assignment** — whitelist PATCH fields in leads/crm/orders/payments/challans (copy the tasks app's existing pattern). Highest severity: cross-tenant write.
2. **B1 roles escalation** + **B5 branding guard** — `can(manage_roles)` on roles + branding mutations.
3. **B2 API tool-gating** — enforce `canAccessTool` in API routes (shared helper), not just layouts. **B7** rides along (move user-list behind `tool:users` or scope it).
4. **B6 photoshoot public gates** — `published` check on public media routes; port quotations' login rate limiter; validate import URLs (http/https, deny private ranges).
5. **B3 seeds** — env-required admin password in prod seeds, all three repos.

**Next — the contract & chain**
6. **D1 Dockerfiles** for quotations + photoshoot (mirror the suite's) → CI images (unblocks DevOps Stage 2 for both).
7. **D2 `/api/health`** in every app + compose healthchecks.
8. **Money-chain links** ([cross-module.html](cross-module.html) §4): order form sends `quotationId`; add `Invoice.orderId` (+ relation + backfill migration); wire challan form's client (+ add `orderId`); Lead→convert endpoint + button; CRM `_count` adds payments/challans; fix invoice-delete orphaning its Payment.
9. **D3 S3 storage driver** behind the existing lib boundaries (quotations `assets.ts`, core `storage.ts`).

**Later**
10. Module small-fixes from the pages: challans date coercion, PO number collision, hr persistence decision, web richtext block renderer, docs-app public/private decision.
11. Fold-in execution with the lead dev: quotations first, behind its flag, per [foldin-map.html](foldin-map.html).

---

*Dependencies to watch: Lane 3's D1 unblocks Lane 2's Stage 2 (standalone images) · Lane 1's gateway wants Lane 2's Secrets Manager (Stage 3) for keys, but can start local · the fold-in (both lanes) should wait until B-fixes and package publishing are done, or it inherits the debt.*
