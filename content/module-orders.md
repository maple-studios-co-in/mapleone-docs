# Orders — engineering bible

Kanban board for won projects — the step between an accepted quotation and the invoice in the money chain.
**Status: suite app `apps/orders`, subdomain `orders.maplefurnishers.com`, dev port `:3005`, container from `maple-suite:latest` with `APP=orders` (docker-compose.yml lines 55–60).**

## For managers — plain-language guide

Orders is the whiteboard between "the client said yes" and "the bill goes out". When a quotation is won — say a ₹12.5 lakh 3BHK interiors job in Vasant Vihar — someone adds a card here, and that card moves left to right across four columns as the wardrobes and sofas move through the workshop, onto the truck, and into the client's home. The number at the top of the board always tells you how much client money is riding on unfinished work. Two things it does *not* do yet, so nobody is surprised: it doesn't pull the won quote in automatically (someone retypes the title and value), and it doesn't raise the invoice when the job finishes (someone retypes that too).

| Feature | What it means in your day | Who uses it |
| --- | --- | --- |
| Four-column kanban board | Every running job is a card in one of four columns — one glance tells you the wardrobe order is still in the workshop while the sofa set is out for delivery | Owner, sales, workshop supervisor |
| Back/advance buttons on each card | When polishing finishes and the truck is loaded, one click moves the job from "production" to "delivery" — no retyping, everyone sees it | Whoever tracks the floor day-to-day |
| Inline create form (title, value ₹, delivery date) | The morning a quote is won, add "3BHK Vasant Vihar — ₹12,50,000 — deliver 1 Sept" and it's on everyone's board | Sales (the `admin` and `sales` roles hold access) |
| Active project value header | The rupee total of every job not yet installed — how much promised work is still open, plus a count of running jobs | Owner, at a glance each morning |
| Delete with confirmation | A job that fell through is removed after an "are you sure" prompt | Admin, sales |

The four stages in plain words: **accepted** — the client said yes, work hasn't started; **production** — carpenters and polishers are on it; **delivery** — it's on the truck or being installed at the site; **installed** — physically complete (and the moment to raise the invoice, though today the board won't remind you).

The full journey of the money, from the client's yes to cash in the bank — orders is the second stop:

```mermaid
journey
    title A won quote becomes money in the bank
    section Quotations
      Client accepts the quote: 5: Sales
    section Orders
      Card created on the board: 4: Sales
      Workshop builds the furniture: 3: Workshop
      Delivered and installed at site: 4: Delivery team
    section Invoices
      Invoice typed up and saved: 3: Accounts
    section Payments
      Due amount appears automatically: 5: Accounts
      Client pays and it is marked paid: 5: Accounts
```

Signs it's working:

- The board matches the workshop floor — when a supervisor asks "what's in production right now", the middle column is the answer.
- The active project value moves — it falls when jobs reach installed and rises when quotes are won; a frozen number means cards aren't being maintained.
- No job the team is actually building is missing from the board — cards appear the day quotes are won, not at month-end cleanup.

---

## Part A — for implementers

### A1 · What the module is today

Orders is the smallest money-chain app in the suite: one client page, two API route files, ~150 lines of first-party code. It renders a four-column kanban of the production pipeline — `accepted | production | delivery | installed` — with per-card back/advance buttons that PATCH `stage`, an inline create form (title required, value ₹, delivery date), and a header showing active project value (sum of `value` across all non-`installed` orders) plus total count.

What it deliberately is *not*:

- **Not a document generator.** No PDF, no export — nothing document-shaped is produced from an order (contrast with quotations, invoices, challans).
- **Not connected.** The schema gives `Order` nullable FKs to both `Client` and `Quotation`, and `Order` is the *only* money-chain model that FKs to `Quotation` — but the create form never sends either FK, so every order born in this UI is an orphan. There is no `orderId` on `Invoice` or `DeliveryChallan`; downstream links from an order exist only in people's heads today.
- **Not evented.** The suite schema has no `OutboxEvent`; nothing writes events anywhere ([event-catalog.md](event-catalog.html)). Both handoffs — quote→order and order→invoice — are manual re-entry.

The module's honest job description: a shared whiteboard with a database behind it. Part B designs what it should become.

### A2 · File-by-file

| File | Lines | What it does |
| --- | --- | --- |
| `apps/orders/app/page.tsx` | 100 | The whole UI. `"use client"`; kanban columns from a `STAGES` const, create form, move/remove handlers, pipeline-value header. |
| `apps/orders/app/api/orders/route.ts` | 27 | GET (list, `updatedAt` desc, includes `client.name`) and POST (create, auto `code`). |
| `apps/orders/app/api/orders/[id]/route.ts` | 17 | PATCH (scoped guard, then raw-body update) and DELETE (scoped guard, then delete). |
| `apps/orders/app/api/auth/logout/route.ts` | ~6 | Clears the `mt_session` cookie. Unauthenticated by design (middleware matcher excludes `api/auth`). |
| `apps/orders/app/layout.tsx` | 30 | Server layout: `getSession()` redirect, `getBrand()`, `isEnabled("tool.orders")` kill switch, wraps children in `SuiteShell`. |
| `apps/orders/middleware.ts` | 23 | `TOOL = "orders"`. Verifies `mt_session` JWT (`verifySession`), redirects to `LOGIN_URL` with `?next=`, then `canAccessTool(user.perms, "orders", user.role)`. |
| `packages/db/prisma/schema.prisma` (`model Order`, lines 94–109) | 16 | The owned model — see A3. |
| `packages/core/src/lib/tenant-db.ts` | 28 | `tenantDb()` — Prisma `$extends` that filters `findMany/findFirst/count/updateMany/deleteMany` by `tenantId` and stamps it on `create`. Note the operations it does **not** hook: `update`, `delete`, `upsert` — hence the "scoped findFirst guard first" pattern in `[id]/route.ts`. |

Shared UI comes from `@maple/core`: `PageHeader`, `Card`, `Input`, `Button`, `money()` (`Intl.NumberFormat en-IN`, INR, zero fraction digits).

#### Lifecycle: create

1. User fills the inline form — state is `{ title, value, deliveryDate }` only (`page.tsx` line 21). Submit is a no-op if `title` is blank.
2. `POST /api/orders` with that JSON. The handler (`route.ts` lines 16–27):
   - `code = b.code || "MO-" + Date.now().toString().slice(-6)` — last six digits of the epoch-millis timestamp. Collision odds are low but real (two creates in the same millisecond, or ~11.5 days apart landing on the same six digits); `code` is `@unique`, so a collision throws an unhandled Prisma P2002 → 500 with no friendly message.
   - `clientId: b.clientId || null, quotationId: b.quotationId || null` — **the API accepts both FKs, the UI sends neither.** This is the single most consequential line in the module: the schema is ready for a linked money chain, the form is not.
   - `stage` defaults `"accepted"`, `value` is `Number(b.value)` or 0, `deliveryDate` parsed or null.
3. `tenantDb()`'s `create` hook stamps `tenantId` from the session. Response is the raw row; the page re-fetches the whole list.

The full request path, including everything that runs before the handler:

```mermaid
sequenceDiagram
    participant B as Browser (page.tsx)
    participant M as middleware.ts
    participant H as POST /api/orders
    participant T as tenantDb()
    participant P as Postgres
    B->>M: POST with mt_session cookie
    M->>M: verifySession(token) via AUTH_SECRET
    M->>M: canAccessTool(perms, "orders", role)
    M->>H: NextResponse.next()
    H->>H: code = b.code or MO-timestamp
    H->>T: order.create(data without tenantId)
    T->>T: create hook stamps tenantId from session
    T->>P: INSERT Order
    P-->>B: full row as JSON
    B->>B: load() refetches the whole list
```

Two details worth internalizing from this trace:

- **Authorization happens entirely in the middleware.** The handler trusts that anything reaching it is a tool-authorized user; it never re-checks. This is consistent suite-wide, and it is why the missing `act:*` checks (below) matter — the middleware only knows tools, not actions.
- **Tenancy happens entirely in `tenantDb()`.** The handler never mentions `tenantId`. This is elegant until you use an operation the extension doesn't hook (`update`, `delete`, `upsert`) — then tenancy silently evaporates, which is exactly why `[id]/route.ts` does the guard-then-write dance, and exactly the bug the invoices module hit with `upsert` ([module-invoices.md](module-invoices.html) A2).

#### Lifecycle: edit / stage moves

There is no edit form. The only mutations the UI performs are:

- **Stage move** — `move()` PATCHes `{ stage: "<adjacent stage>" }`. The UI enforces adjacency (back/advance one column), the API enforces nothing — any string is a legal `stage` at the DB level (no enum, no CHECK).
- **Delete** — `confirm()` dialog, then DELETE.

The PATCH handler is a **mass-assignment pass-through**: after a scoped `findFirst` guard proves the row is in-tenant, it coerces `value` and `deliveryDate` if present and then `update({ where: { id }, data: b })` with the raw body. Any `Order` column — including `tenantId`, `code`, `clientId`, `quotationId` — is settable by any user who can access the tool. Ironically this is also the only way today to link an order to a quotation: a hand-crafted `PATCH { "quotationId": "..." }`. The guard-then-update pair is also a small TOCTOU window (guard passes, row is moved/deleted, update targets by bare `id`) — harmless single-tenant, worth closing when writes get concurrent.

Neither PATCH nor DELETE checks an action permission — `can(perms, "delete")` exists in `packages/core/src/lib/rbac.ts` and is never called here. The middleware tool gate is the only barrier.

#### Lifecycle: read

`GET /api/orders` returns every order for the tenant, newest-updated first, with `client: { name }` joined. No pagination, no stage filter — the kanban filters client-side. The handler catches all errors as a 503 `"Database not reachable"` which the page renders as an amber banner; loading and per-column empty states are handled in the page.

### A3 · Data model and API

Owned model: `Order`. `tenantId` is nullable and app-enforced via `tenantDb()`; both FKs are nullable, so orders with no client and no quotation are legal at the DB level (orphans possible — and, per A2, the norm).

```mermaid
erDiagram
    ORDER {
        string id PK
        string tenantId "nullable, app-enforced"
        string code UK "auto MO-xxxxxx"
        string title
        string clientId FK "nullable, UI never sends"
        string quotationId FK "nullable, UI never sends"
        string stage "accepted, production, delivery, installed"
        float value "default 0, manual, never derived from quote"
        datetime deliveryDate "nullable"
        string notes "nullable"
        datetime createdAt
        datetime updatedAt
    }
    CLIENT ||--o{ ORDER : "clientId"
    QUOTATION ||--o{ ORDER : "quotationId"
```

`stage` and `value` are the two live columns; `notes` is writable only via raw PATCH (no UI). `value` is a manual float, never derived from the source quotation's `total`.

#### API surface with JSON shapes

| Route | Body → Response | Auth that actually exists |
| --- | --- | --- |
| GET `/api/orders` | — → `[{ id, tenantId, code, title, clientId, quotationId, stage, value, deliveryDate, notes, createdAt, updatedAt, client: { name } \| null }]` | Middleware: `mt_session` JWT + `canAccessTool(perms, "orders", role)` |
| POST `/api/orders` | `{ title, value?, deliveryDate?, code?, clientId?, quotationId?, stage?, notes? }` → full `Order` row | Middleware tool gate only — no `can()` in handler |
| PATCH `/api/orders/[id]` | `{ ...any Order columns }` → updated row, or `404 { error: "Not found in tenant" }` | Middleware tool gate only; **mass assignment** |
| DELETE `/api/orders/[id]` | — → `{ ok: true }` or 404 | Middleware tool gate only — **no `act:delete` check** |
| POST `/api/auth/logout` | — → clears cookie | None (matcher excludes `api/auth`) |

Concrete shapes — create and stage move as the wire sees them:

```json
// POST /api/orders   (what the UI actually sends — note the absent FKs)
{ "title": "3BHK Vasant Vihar", "value": "1250000", "deliveryDate": "2026-09-01" }

// 200 response
{
  "id": "cmcy41…", "tenantId": "ten_maple", "code": "MO-104217",
  "title": "3BHK Vasant Vihar", "clientId": null, "quotationId": null,
  "stage": "accepted", "value": 1250000, "deliveryDate": "2026-09-01T00:00:00.000Z",
  "notes": null, "createdAt": "…", "updatedAt": "…"
}
```

```json
// PATCH /api/orders/cmcy41…   (kanban advance — and everything else PATCH will accept)
{ "stage": "production" }
// equally accepted today, nothing rejects it:
{ "stage": "production", "tenantId": "someone-else", "code": "MO-000001", "value": 0 }
```

Error contract: GET catches everything as `503 { error }`; POST/PATCH let Prisma errors escape as unhandled 500s (duplicate `code`, bad FK id, malformed date). PATCH/DELETE return `404 { error: "Not found in tenant" }` for both "doesn't exist" and "exists in another tenant" — deliberately indistinguishable.

### A4 · Config reference

| Variable | Used by | Effect (dev default in `apps/orders/.env.local`) |
| --- | --- | --- |
| `DATABASE_URL` | `@maple/db` Prisma client | `postgresql://postgres:maple@localhost:5544/mapletools` |
| `AUTH_SECRET` | `verifySession` / session mint | JWT HMAC secret (`dev-secret` locally — rotate in prod) |
| `COOKIE_DOMAIN` / `SSO_DOMAIN` | session cookie | `.maplefurnishers.com` — one cookie across all subdomains |
| `LOGIN_URL` | middleware + layout redirect | `https://admin.maplefurnishers.com/login` (falls back to this literal when unset) |
| `FLIPT_URL` / `FLIPT_NAMESPACE` | `isEnabled("tool.orders")` | Unset ⇒ fail-open, tool always on; 30 s in-process cache |
| `APP=orders` | container entrypoint | Selects this app inside the shared `maple-suite:latest` image |

Runbook: `npm run -w @maple/app-orders dev -- -p 3005` (port per `PORTS.local.txt`; `scripts/dev.sh` starts the whole suite). Seed (`packages/db/prisma/seed.mjs`) creates **no demo orders**; it grants `tool:orders` to `admin` (`*`) and `sales`, demo logins `maple@123`. No tests exist under `apps/orders`; no `/api/health` endpoint (cross-cutting gap).

### A5 · Recipes

#### Recipe 1 — add a column to the order card (schema → API → UI)

Example: an `assignee` free-text column.

1. **Schema** — `packages/db/prisma/schema.prisma`, inside `model Order`:
   ```prisma
   assignee String?
   ```
   Then `npx prisma migrate dev --name order-assignee` from `packages/db` (generates `ALTER TABLE "Order" ADD COLUMN "assignee" TEXT`), and `npx prisma generate`.
2. **API** — POST needs one line in the `data` block of `app/api/orders/route.ts`: `assignee: b.assignee || null`. PATCH needs **nothing** — the raw pass-through already accepts it (this is the mass-assignment gotcha working *for* you; if you adopt the field whitelist from B5, add `"assignee"` there instead).
3. **UI** — `app/page.tsx`: extend the `Order` type (line 9), add an `<Input placeholder="Assignee" …>` to the form grid (bump `sm:grid-cols-4` to 5), include it in the `form` state and reset, and render it on the card near the client name.
4. Restart the dev server (Prisma client is regenerated); existing rows read `null`.

#### Recipe 2 — enforce legal stage transitions in the API

Today the API accepts any `stage` string. To make the kanban's adjacency rule real, in `[id]/route.ts` before the update:

```ts
const STAGES = ["accepted", "production", "delivery", "installed"];
if (b.stage !== undefined && !STAGES.includes(b.stage))
  return NextResponse.json({ error: "invalid stage" }, { status: 400 });
```

Full adjacency enforcement (only ±1 from the current row's stage) needs the guard `findFirst` result you already fetched — compare indexes before updating. This is the 20-line precursor to the lifecycle v2 state machine in B3.

#### Recipe 3 — surface the linked quotation on the card

Once orders start carrying `quotationId` (B1), the card should show it. Three touches:

1. **API** — in `GET /api/orders`, extend the include:
   ```ts
   include: { client: { select: { name: true } }, quotation: { select: { number: true, total: true } } }
   ```
2. **UI type** — `page.tsx` line 9: add `quotation: { number: string; total: number } | null` to the `Order` type.
3. **Card** — under the client name, render `o.quotation && <a href={quotationsUrl(o.quotation.number)}>…</a>` and, when both exist, a drift badge if `o.value !== o.quotation.total` (the snapshot-vs-source rule from B1 made visible). `quotationsUrl` belongs in `@maple/core/lib/nav.ts` next to `adminUrl`.

#### Recipe 4 — whitelist PATCH fields (close the mass assignment)

The minimal safe rewrite of `[id]/route.ts` PATCH, preserving current behaviour for legitimate callers:

```ts
const ALLOWED = ["title", "stage", "value", "deliveryDate", "notes", "clientId", "quotationId"] as const;
const b = await req.json();
const data: Record<string, unknown> = {};
for (const k of ALLOWED) if (k in b) data[k] = b[k];
if (data.value !== undefined) data.value = data.value === "" ? 0 : Number(data.value);
if (data.deliveryDate !== undefined) data.deliveryDate = data.deliveryDate ? new Date(data.deliveryDate as string) : null;
```

`tenantId` and `code` fall out of the writable set; the kanban, which only ever sends `stage`, never notices.

## Testing — how we verify this module

**Honest current state: zero automated tests.** There is no test file anywhere under `apps/orders` (verify: `find apps/orders -name "*.test.*"` returns nothing). The repo-root vitest config already includes `apps/**/*.test.{ts,tsx}` — the harness is waiting, unused. The only Playwright spec suite-wide is `e2e/login.spec.ts` (two SSO smoke tests, run against a live local stack via `npm run e2e`). The A5 curl loop is the de facto regression suite; `money()` in `packages/core/src/lib/utils.test.ts` is the only unit test this module even indirectly benefits from.

The state machine the tests must pin — what the UI enforces today (the API, remember, accepts any string; that gap between diagram and reality *is* the test surface):

```mermaid
stateDiagram-v2
    [*] --> accepted : create form
    accepted --> production : advance
    production --> delivery : advance
    delivery --> installed : advance
    production --> accepted : back
    delivery --> production : back
    installed --> delivery : back
    installed --> [*] : leaves pipeline value
```

**Unit targets** (pure logic, no DB — write these first):

- `code` generation (`MO-` + last-6-of-`Date.now()`): pin the format, then a collision case — two calls in the same millisecond produce the same code — documenting why B4 replaces it with a counter.
- PATCH coercion rules as a table test: `value: ""` → `0`; `value: "1250000"` → number; `deliveryDate: ""` → `null`; `deliveryDate: "not-a-date"` → Invalid Date reaching Prisma (pin today's unhandled 500 so the eventual fix shows up green).
- Once B3.1's transition map lands in `@maple/core/lib/order-lifecycle.ts`, it becomes the module's first properly unit-testable brain: assert every legal and illegal transition straight from the `TRANSITIONS` map.

**Integration targets** (route handlers against a scratch Postgres seeded with two tenants). The known bugs become *named regression cases* so they can't quietly regress after being fixed:

| Named case | Asserts | Today |
| --- | --- | --- |
| `REG-mass-assignment-rejection` | PATCH `{ tenantId: "other" }` or `{ code: "MO-000001" }` is rejected and the row unchanged | **Red** — the pass-through accepts both (A2); goes green with A5 Recipe 4 |
| `REG-number-collision-overwrite` | Two creates landing on the same `code` → friendly 409, not an unhandled P2002 500 | **Red** — unhandled 500 today |
| Tenant isolation | Tenant B's session gets 404 on GET/PATCH/DELETE of tenant A's order | Green — scoped-guard pattern |
| Stage validation | PATCH `{ stage: "garbage" }` → 400 once A5 Recipe 2 lands | **Red** — any string accepted |

(The sibling named cases — `REG-upsert-tenant-guard`, `REG-auto-payment-orphaning`, `REG-challan-date-throw` — live in the invoices/payments/challans suites but exercise the same shared `tenantDb()` machinery this module trusts.)

**E2E user stories** (Playwright, same live-stack setup as `e2e/login.spec.ts`):

1. A sales user logs in, creates "3BHK Vasant Vihar" at ₹12,50,000, sees the card appear in **accepted** and the pipeline header grow by exactly that amount.
2. The card is advanced accepted → production → delivery → installed; the pipeline value drops when it lands in installed; a fresh reload shows the same board (persistence, not local state).
3. A user without `tool:orders` is redirected at the door (page) and 401/403'd at the API.
4. Delete: cancelling the confirm dialog leaves the card; accepting removes it and the header recalculates.

**Definition of done:** unit + integration suites run under plain `npm test` with no live stack; all four named regression cases exist in the tree (currently-failing ones marked expected-fail with a reason, never silently absent); E2E stories 1–2 pass against `scripts/dev.sh`; CI blocks on the vitest suites.

---

## Part B — for architects

### B1 · Cross-module: designing the missing chain links

The money chain is `Lead → Quotation → Order → Invoice → Payment` (see [cross-module.md](cross-module.html)). Orders sits mid-chain with a real upstream FK that nothing populates and no downstream FK at all. Three specs follow — all buildable today against the shared Postgres, all evented later without rework.

#### Spec 1 — populate `Order.quotationId`: the "convert to order" flow

Two complementary halves; ship both.

**(a) Order-side: pickers on the create form.** The POST already accepts `clientId`/`quotationId` — this is purely UI. Add two `<Select>`s to the form fed by `GET /api/clients?status=active` and `GET /api/quotations?status=accepted` (the quotations list endpoint exists in the quotations app; since all apps share the DB, orders can expose a thin proxy route or the form can fetch cross-subdomain with the shared cookie). Choosing a quotation pre-fills `title` from its data, `value` from its `total`, and locks `clientId` to the quote's client.

**(b) Quotation-side: a convert endpoint.** The better ergonomics — the user is *in* the quotation when it's won. In `apps/quotations`:

```
POST /api/quotations/[id]/convert
→ 201 { order: { id, code, title, clientId, quotationId, stage: "accepted", value } }
→ 409 { error: "already converted", orderId } when an Order with this quotationId exists
```

Handler logic, transactional end to end:

```ts
// apps/quotations/app/api/quotations/[id]/convert/route.ts
export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const db = await tenantDb();
  const q = await db.quotation.findFirst({ where: { id } });          // tenant-scoped
  if (!q) return NextResponse.json({ error: "Not found in tenant" }, { status: 404 });
  if (q.status !== "accepted")
    return NextResponse.json({ error: "Quotation is not accepted" }, { status: 422 });
  const existing = await db.order.findFirst({ where: { quotationId: id } });
  if (existing)
    return NextResponse.json({ error: "already converted", orderId: existing.id }, { status: 409 });
  const order = await prisma.$transaction(async (tx) => {
    const o = await tx.order.create({ data: {
      tenantId: q.tenantId,                       // raw client: stamp explicitly
      code: await nextOrderCode(tx, q.tenantId),  // counter, not timestamp — see B4
      title: titleFromQuoteData(q.data), value: q.total,
      clientId: q.clientId, quotationId: q.id,
      notes: `Converted from ${q.number} at ₹${q.total}`,
    }});
    await tx.outboxEvent.create({ data: eventRow("order.created", o) }); // once outbox exists
    return o;
  });
  return NextResponse.json({ order }, { status: 201 });
}
```

The guard `status === "accepted"` forces finally building the accept transition — quotation `status` is free text today with no transition endpoint. Note the transaction uses the **raw** `prisma` client (interactive transactions don't compose with the `tenantDb()` extension), so `tenantId` must be stamped explicitly — copy it from the loaded quotation, never from the request. The UI is one "Convert to order" button on accepted quotes that deep-links to `orders.maplefurnishers.com` on success (shared SSO cookie makes this seamless). Sequence traced in [cross-module.md](cross-module.html).

**Consistency rule:** `value` is *copied*, not referenced. If the quotation is edited after conversion, the order keeps its snapshot — correct behaviour for a contract, but the convert endpoint should stamp `notes` with `Converted from <number> at <total>` so drift is diagnosable. A quotation with an order against it should refuse edits or warn (guard in the quotations PATCH: `order.count({ where: { quotationId } }) > 0`).

#### Spec 2 — downstream link: `Invoice.orderId`

The column, relation, backfill SQL, and invoice-side flows live in the invoices bible ([module-invoices.md](module-invoices.html), B1 Spec 1) — the order-side requirements are: the orders card gains an "Invoices (n)" count via `include: { invoices: true }` once the relation exists, and stage `installed` should *suggest* (not force) raising an invoice for any order with `invoices.length === 0`.

#### Spec 3 — event schemas

No `OutboxEvent` exists in the suite schema yet ([event-catalog.md](event-catalog.html)); the envelope below matches the proposed catalog. Producer writes the event row in the same transaction as the domain write; a poller publishes.

```json
{
  "id": "evt_01J9…",
  "type": "order.created",
  "version": 1,
  "tenantId": "ten_maple",
  "occurredAt": "2026-07-17T10:42:00Z",
  "payload": {
    "orderId": "ord_…", "code": "MO-104217",
    "quotationId": "quo_… | null", "clientId": "cli_… | null",
    "title": "3BHK Vasant Vihar", "value": 1250000,
    "stage": "accepted", "deliveryDate": "2026-09-01"
  }
}
```

```json
{
  "type": "order.fulfilled",
  "version": 1,
  "tenantId": "ten_maple",
  "occurredAt": "…",
  "payload": {
    "orderId": "ord_…", "code": "MO-104217",
    "clientId": "cli_… | null", "value": 1250000,
    "fulfilledAt": "2026-09-03T14:00:00Z",
    "previousStage": "delivery",
    "challanIds": [], "invoiceIds": []
  }
}
```

`order.fulfilled` fires on the transition into `installed` (or `delivered` in lifecycle v2). Consumers: **crm** (client timeline), **invoices** (prompt to raise final invoice), **inventory** (release reserved stock, once reservation exists), **finance** (pipeline reporting). Additionally emit `order.stage_changed` (`{ orderId, from, to, at, by }`) for every move — cheap, and it makes the kanban auditable retroactively.

**Failure modes to design for:** (1) convert succeeds, event insert fails → prevented by same-transaction outbox; (2) publisher retries → consumers must be idempotent on `id`; (3) order deleted after `order.created` consumed → emit `order.deleted` and let consumers tombstone; (4) stage moved backwards after `order.fulfilled` → emit a compensating `order.reopened`, never retract.

### B2 · Infra — bootstrap vs enterprise

| Concern | Bootstrap (today → ~50 users/tenant) | Enterprise (multi-tenant SaaS) |
| --- | --- | --- |
| Eventing | Postgres outbox table + `setInterval` poller in one app (or pg LISTEN/NOTIFY). Zero new infra; at-least-once; ordering per tenant via `ORDER BY id` polling. | Kafka. Topic `suite.orders.events`, **partition key `tenantId`** — guarantees per-tenant ordering, which is what consumers actually need (a tenant's `order.created` before its `order.fulfilled`). 6–12 partitions; consumers as consumer groups per module. Debezium on the outbox table beats app-level publishing. |
| DB | The shared Postgres (docker-compose `postgres`, one instance). Order rows are tiny; a tenant doing 200 orders/month is 2.4 k rows/yr — a single index on `(tenantId, stage)` covers the kanban forever. | Same schema, add composite indexes `(tenantId, updatedAt)` and `(tenantId, stage)`; consider row-level security as defence-in-depth for the nullable `tenantId` (backfill NULLs first). |
| Runtime | One VM, docker-compose, all apps from `maple-suite:latest` with `APP=<name>` — restart-on-failure is the HA story. | K8s: one Deployment per app; orders is stateless so 2 replicas + HPA on CPU is plenty. Profiles: `requests: 100m/256Mi`, `limits: 500m/512Mi` — this app idles. |
| Honest take | The outbox poller is not a lesser version — it is the correct choice until at least two consumers exist and cross-repo deployment splits happen. Kafka before then is pure ops overhead. | Adopt Kafka only when modules split repos/DBs; the partition-by-tenant decision is the one to lock in early because it shapes consumer idempotency. |

Enterprise-track topic layout, if and when the split happens:

| Topic | Key | Producers | Consumers | Retention |
| --- | --- | --- | --- | --- |
| `suite.orders.events` | `tenantId` | orders, quotations (convert) | invoices, crm, inventory, finance | 30 d, compacted never (events, not state) |
| `suite.orders.state` | `orderId` | orders (CDC via Debezium) | search/reporting projections | compacted |
| `suite.dlq.orders` | original key | consumer error handlers | ops alerting | 14 d |

K8s profile for the orders Deployment (it is the lightest app in the suite — no PDF, no file IO):

```yaml
resources:
  requests: { cpu: 100m, memory: 256Mi }
  limits:   { cpu: 500m, memory: 512Mi }
replicas: 2            # HPA target 70 percent CPU, max 4
readinessProbe: { httpGet: { path: /api/health, port: 3000 } }   # endpoint must be built first
```

### B3 · Designed enhancements

#### B3.1 Order lifecycle v2 — a real state machine

Replace the four free-text stages with an enforced machine including the two states the business actually has but the board hides: draft (quote converted but not confirmed/advance not received) and cancellation.

```mermaid
stateDiagram-v2
    [*] --> draft : convert or create
    draft --> confirmed : advance received
    confirmed --> in_production : work starts
    in_production --> ready : QC passed
    ready --> delivered : installed at site
    draft --> cancelled : client backed out
    confirmed --> cancelled : refund advance
    in_production --> confirmed : rework
    ready --> in_production : QC failed
    delivered --> [*]
    cancelled --> [*]
```

Implementation: keep `stage String` (migrating enum values is painful in Prisma/Postgres), add a transition map in `@maple/core/lib/order-lifecycle.ts`:

```ts
export const TRANSITIONS: Record<string, string[]> = {
  draft:         ["confirmed", "cancelled"],
  confirmed:     ["in_production", "cancelled"],
  in_production: ["ready", "confirmed"],          // back = rework
  ready:         ["delivered", "in_production"],  // back = QC failed
  delivered:     [],
  cancelled:     [],
};
export const REQUIRES_NOTE = new Set(["cancelled", "confirmed<-in_production", "in_production<-ready"]);
```

and validate in PATCH: `if (!TRANSITIONS[current]?.includes(next)) 409 { error, allowed: TRANSITIONS[current] }`. Each accepted transition appends to a new `OrderEvent` table (`{ id, tenantId, orderId, from, to, at, byUserId, note }`) in the same transaction — that table *is* the audit log and the source for `order.stage_changed`. Events fired per transition: `order.confirmed` (advance received — payments cares), `order.fulfilled` on `→ delivered`, `order.cancelled` with the mandatory note.

Migration maps old values: `accepted→confirmed`, `production→in_production`, `delivery→ready` (approximation — flag for manual review), `installed→delivered`:

```sql
UPDATE "Order" SET "stage" = CASE "stage"
  WHEN 'accepted' THEN 'confirmed'   WHEN 'production' THEN 'in_production'
  WHEN 'delivery' THEN 'ready'       WHEN 'installed'  THEN 'delivered'
  ELSE "stage" END;
```

UI: five columns, `cancelled` behind a filter toggle, transition buttons rendered *from the map* so UI and API can never disagree, and a required note dialog on `cancelled` and both backward moves. The pipeline-value header changes meaning: sum over `confirmed + in_production + ready` (drafts are not yet money, delivered/cancelled are done).

#### B3.2 Production tracking — per-item status

An order for a 3BHK is 15 line items in different states; one `stage` for the whole card is why the team keeps a parallel WhatsApp thread. Add:

```prisma
model OrderItem {
  id        String    @id @default(cuid())
  tenantId  String?
  orderId   String
  order     Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)
  title     String
  qty       Float     @default(1)
  status    String    @default("pending") // pending | cutting | assembly | polish | qc | done
  station   String?   // which karigar or bench
  updatedAt DateTime  @updatedAt
}
```

Items are seeded from the quotation's rooms/items at convert time (the quote `data` JSON already itemizes rooms and items — the convert handler flattens `data.rooms[].items[]` into `OrderItem` rows, `title` from `description`, dropping zero-quantity lines). Order-level derived rule: `in_production → ready` auto-suggests when `every(item.status === "done")` — suggest, never auto-transition, because the floor updates item statuses in bursts.

API additions, all under the existing orders app:

| Route | Body → Response |
| --- | --- |
| GET `/api/orders/[id]/items` | — → `[{ id, title, qty, status, station, updatedAt }]` |
| PATCH `/api/orders/[id]/items/[itemId]` | `{ status?, station? }` → updated item (status validated against the six-value list) |
| POST `/api/orders/[id]/items` | `{ title, qty? }` → created item (site-added extras happen) |

UI: card expands to an item checklist with a per-item status chip cycling on tap; a `/floor` view filters items by `station` across all orders — that per-station list is the factory-floor screen and the actual replacement for the WhatsApp thread. Add `OrderItem` to the `SCOPED` set in `tenant-db.ts` — forgetting that is the classic bug here (the set is a hand-maintained list, nothing derives it from the schema).

#### B3.3 Delivery scheduling

`deliveryDate` is a promise, not a plan. Additions to `Order`:

```prisma
scheduledAt     DateTime?   // the plan
deliverySlot    String?     // am | pm
deliveryAddress String?     // defaults from client.address at schedule time
crew            String?     // free text until a Crew model earns its keep
```

Plus a `/schedule` week-calendar page: columns Mon–Sat, rows am/pm, cards are `ready` orders grouped by `scheduledAt`, drag-to-reschedule PATCHes `scheduledAt`/`deliverySlot`. Scheduling flow: an order entering `ready` with no `scheduledAt` surfaces in an "unscheduled" tray on that page. The challans module ([module-challans.md](module-challans.html)) is the natural consumer: creating a challan from an order (once `DeliveryChallan.orderId` exists) copies the scheduled slot and address. Conflict rule: warn when more than N orders share a slot and crew — a count query, not a solver; resist the temptation to build routing optimization for one truck. Event: `order.delivery_scheduled` (`{ orderId, scheduledAt, slot, crew }`) so crm can notify the client.

### B4 · Scaling

Data volume will never be the problem (thousands of rows/tenant/year); the scaling axes are **tenants** and **write contention**:

- The full-table GET (no pagination) is fine to ~2 k orders; past that, paginate by `updatedAt` cursor and filter `stage` server-side — the kanban only needs non-`installed` plus a lazy archive.
- `code` generation via timestamp-slice must move to a per-tenant counter (same mechanism as invoice numbering, [module-invoices.md](module-invoices.html) B2) before multi-user creates are frequent.
- The kanban is refresh-on-mutation (`load()` after every PATCH); with two concurrent users, moves appear stale until the other refreshes. SWR-style polling (10 s) is proportionate; websockets are not.
- `OrderEvent` (B3.1) is append-only and unbounded — partition or archive after 24 months.

## AI — use case & pipeline

*Same contract as every AI section in these bibles ([ai-layer.md](ai-layer.html)): module owns retrieval and the review surface, the maple-ai gateway owns keys, models and spend; every call logs an `AiRequest`, every human fix a `Correction` ([er-platform.md](er-platform.html)).*

### Use case 1 — delivery-date risk flag (heuristics first, honestly)

**For managers.** A card turns amber or red when the delivery promise is at risk — still in production with five days left, fourteen items open, two other jobs booked into the same delivery slot. The badge always says *why*, and the supervisor can dismiss it when the floor knows better. v1 is deliberately not AI at all: it's arithmetic over data the board already has, which means it's free, instant, and explainable in one line.

The v1 engine is a pure function — `order-risk.ts` in `@maple/core`, unit-tested like `order-lifecycle.ts`. Inputs: days to `deliveryDate` vs current `stage` (the B3.1 machine), open `OrderItem` count (B3.2), and orders sharing the delivery slot (B3.3's count query). The human loop still exists from day one — it's what makes a model possible later:

```mermaid
flowchart LR
    O[order + items + stage + slot load] --> H[order-risk.ts pure rules]
    H --> BADGE[risk badge on card with reason]
    BADGE --> HR{{HUMAN REVIEW - supervisor confirms or dismisses}}
    HR --> OVR[(override log - the future training labels)]
    OVR -.->|only past the not-before bar| ML[tabular model via Dataset then TrainingRun then EvalRun]
```

| Concern | Decision |
| --- | --- |
| v1 engine | rules in `@maple/core/lib/order-risk.ts` — zero model calls, ₹0, every flag carries its reason |
| Review surface | supervisor confirms or dismisses the flag on the card — one tap |
| Override log | `{ orderId, flag, verdict, at, byUserId }` rows; these **are** the labels — without them "train a model later" is a fantasy |
| Model "not before" | ≥12 months of B3.1 `OrderEvent` history and ≥200 delivered orders with promised-vs-actual dates — the training signal doesn't exist until lifecycle v2 has run that long |
| When triggered | a small *tabular* model (not an LLM — this is structured prediction) through the `Dataset → TrainingRun → EvalRun` loop, routable only on an eval win over the rules baseline ([er-platform.md](er-platform.html)) |

### Use case 2 — order-notes summarization for the production floor

**For managers.** By mid-job an order carries the convert note, the quotation's room-by-room line items, and weeks of accumulated notes. The workshop supervisor doesn't need the archive — they need five lines: what we're building, which materials and finishes were called out, site constraints, and what changed since conversion. A "Production brief" button produces exactly that, the supervisor tweaks it, and the tweaked version is what the floor sees — one more nail in the parallel-WhatsApp-thread coffin that B3.2 exists to close.

```mermaid
flowchart LR
    BTN[Production brief action] --> API[module assembles notes items quote data]
    API --> GW[gateway POST /v1/summarize-order]
    GW --> AN[haiku-4.5 structured output]
    AN --> GW
    GW --> LOG[(AiRequest - order-brief)]
    GW --> CARD[brief on card - generated stamp]
    CARD --> HR{{HUMAN REVIEW - supervisor edits first}}
    HR -->|edits| CORR[(Correction row)]
    HR --> FLOOR[floor view and print]
```

| Concern | Decision |
| --- | --- |
| Endpoint | gateway `POST /v1/summarize-order`, from a "Production brief" action on the card |
| Retrieval | order row + `notes` + `OrderItem` rows + the linked quotation's `data.rooms[].items[]` — assembled module-side through `tenantDb()`; the gateway never queries the suite DB |
| `json_schema` | `{ building: string[] (max 6), materials: string[], siteConstraints: string[], changedSinceConvert: string[], confidence: "high"\|"low" }` — `additionalProperties: false` |
| Model | `haiku-4.5` — this is compression, not reasoning |
| ₹/call | ≈₹0.15–0.30 (~2k tokens in) against the ₹8–10 fable-5 catalog-page anchor ([ai-layer.md](ai-layer.html)); regenerate only when notes or items change, so an order's whole lifetime costs well under ₹1 |
| Spend log | `AiRequest { module: "orders", useCase: "order-brief", promptVersion: "order-brief-v1" }` |
| Review surface | brief renders on card expansion with a "generated" stamp; the supervisor edits before it reaches the `/floor` view or print — the *edited* version is what ships to the floor |
| Correction capture | supervisor edits → `Correction { aiRequestId, modelOutput, humanFixed }` |
| Failure mode | gateway error → the card shows the raw notes exactly as today; the brief is a lens, never the data |

**Rollout & honest gates.**

- **Not before** B1's convert flow populates `quotationId` — without quote items the model's input is one manually typed title, and summarizing one line is theater.
- Full value arrives with `OrderItem` (B3.2); a v1 on quote `data` + notes alone is still shippable.
- Success test is B3.2's own bar: the supervisor's WhatsApp thread goes quiet. If briefs are generated but the thread stays busy, the missing information isn't in the system — fix capture, not the prompt.

### B5 · Status — done and left

**Done ✓**
- Tenant-scoped CRUD with scoped-guard update/delete; auto order codes (`MO-` + timestamp slice).
- Four-stage kanban with advance/back, pipeline-value header, delete confirmation.
- SSO middleware, `tool.orders` feature-flag kill switch, DB-down/loading/empty states.

**Left ◻**
- Quote→order handoff is manual re-entry — no `OutboxEvent` integration ([event-catalog.md](event-catalog.html)); convert endpoint spec in B1, sequence in [cross-module.md](cross-module.html).
- UI never sets `clientId`/`quotationId` even though POST accepts both — add client/quote pickers (B1 Spec 1a).
- Action-level permission checks missing (DELETE lacks `act:delete`; PATCH mass assignment — whitelist fields, close the TOCTOU guard).
- Stage is free text at the API — adopt the transition map (A5 Recipe 2 → B3.1).
- No downstream link: `Invoice` and `DeliveryChallan` have no `orderId` — spec owned by [module-invoices.md](module-invoices.html) B1.
- No `/api/health` endpoint (cross-cutting gap); no tests under `apps/orders`; unhandled P2002 on duplicate `code`.

**Decisions taken**
- Keep `stage` as `String` + app-level transition map rather than a Prisma enum (migration ergonomics).
- Outbox-on-Postgres before Kafka; partition-by-`tenantId` locked in as the eventual Kafka key.
- Quotation `value` is snapshotted at convert, never live-referenced.
