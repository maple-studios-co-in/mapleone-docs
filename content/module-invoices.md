# Invoices — engineering bible

GST tax-invoice builder with live preview and client-side PDF download — the point in the money chain where an order becomes a receivable.
**Status: suite app `apps/invoices`, subdomain `invoices.maplefurnishers.com`, dev port `:3007`, container from `maple-suite:latest` with `APP=invoices` (docker-compose.yml lines 69–74).**

## For managers — plain-language guide

This is where a delivered job becomes a bill. The wardrobe went in yesterday; today accounts opens the invoice app, types the line items (yes, retypes — it doesn't pull them from the quote or order yet), watches the GST math compute itself live, downloads a PDF to WhatsApp the client, and hits Save. The save does one genuinely magical thing — the amount due appears in the Payments app automatically, so the follow-up desk never misses a bill. Two honest caveats: the app remembers only the invoice you're working on (there's no list of past invoices on screen — they're in the database, not the page), and a paid invoice still *says* unpaid, because nothing connects payment records back to the invoice's status yet.

| Feature | What it means in your day | Who uses it |
| --- | --- | --- |
| Editor with live preview | You type on the left, the finished invoice takes shape on the right — what you see is what the client gets | Accounts (the `admin`, `sales` and `accounts` roles hold access) |
| Auto invoice number | Every new invoice gets a date-stamped number like MF-INV-20260717-412 without anyone maintaining a register | Accounts |
| Invoice/due dates and billed-to block | Client name, phone, GSTIN and address on the bill; the due date drives the payment follow-up | Accounts |
| Line items with HSN codes | "3-seater sofa, HSN 9401, ₹1,00,000" — line by line, the way a GST invoice must read | Accounts |
| Per-item and overall discounts (flat or %) | Knock ₹5,000 off the sofa, or 5% off the whole bill — both shown transparently | Accounts, with sales pushing for it |
| Packing % and loading ₹ charges | The real-world extras of moving furniture, added as separate lines | Accounts |
| GST controls (rate, included/excluded, CGST+SGST split) | 18% on top or baked into the quoted price; split into the two halves Delhi clients expect | Accounts |
| Bank/UPI details and notes | The "pay us here" block and the "goods once sold…" fine print, printed on every bill | Accounts |
| Download PDF | A print-ready A4 with the Maple logo, generated in your browser in a second | Accounts, forwarded by sales |
| Save | Stores the invoice and automatically raises the due amount in Payments — the one automatic handoff in the whole chain | Accounts |
| Draft autosave | Close the laptop mid-invoice; it's still there tomorrow, on that same computer | Accounts |

Invoice status in plain words: **unpaid** — money not yet received; **partial** — designed to mean some money received; **paid** — designed to mean fully settled. Plain truth: today every invoice reads unpaid forever, even after the client pays — the Payments app knows, the invoice doesn't. Treat the Payments screen, not this one, as the truth about who owes what until the rollup ships.

Signs it's working:

- Every delivered job has an invoice with a number, and saving it made a matching due row appear in Payments without anyone typing it there.
- The PDF the client receives matches the preview on screen — same totals, same GST split.
- Nobody is keeping a parallel invoice register in Excel "because the app forgets" — the drafts and numbers here are trusted.

---

## Part A — for implementers

### A1 · What the module is today

A single-page invoice editor (`app/page.tsx`, ~170 lines) with a live HTML preview beside it and two output paths: **Download PDF** (rendered entirely in the browser via `@react-pdf/renderer` 4.5.1) and **Save** (upsert to Postgres by invoice `number`, which also auto-seeds the payments module). The editor covers the full Indian tax-invoice shape: number (auto `MF-INV-<yyyymmdd>-<3 digits>` via `genInvoiceNumber`), invoice/due dates, billed-to block (name/phone/GSTIN/address), line items with HSN codes, per-item and overall discounts (flat/percent), packing %, loading ₹, GST % with included/excluded mode and CGST+SGST split, bank/UPI payment details, and notes.

Defining characteristics, all verified in code:

- **The editor is localStorage-first, not DB-first.** Draft state auto-saves to `mapleInvoice.last.v1` on every keystroke; on mount the page loads *that*, never the database. There is no invoice list, no "open saved invoice" — `GET /api/invoices` exists and the UI never calls it.
- **Save is the only automated hop in the whole money chain.** `POST /api/invoices` upserts the invoice, links/creates the `Client` via `findOrCreateClient`, and creates a due `Payment` row for the grand total if the invoice has none.
- **The invoice has no upstream anchor.** `Invoice` has `clientId` (nullable) and **no `orderId`** — verified against `schema.prisma` lines 63–75; the model carries no order or quotation reference of any kind. Line items are retyped from whatever document preceded them.
- **`status` is write-once in practice.** The UI always sends `"unpaid"`; nothing anywhere transitions it to `partial`/`paid` when payments are recorded.

### A2 · File-by-file

| File | Lines | What it does |
| --- | --- | --- |
| `apps/invoices/app/page.tsx` | 172 | Editor + preview + download/save handlers. All state is one `InvoiceData` object. |
| `apps/invoices/app/invoice-pdf.tsx` | 136 | `@react-pdf/renderer` A4 document. Registers Roboto (4 weights) **from cdnjs at render time**; hard-codes company identity; maroon `#702119` theme. |
| `apps/invoices/app/api/invoices/route.ts` | 34 | GET (list, `createdAt` desc, `client.name` joined) and POST (upsert by `number` + client link + auto-payment). |
| `apps/invoices/app/api/invoices/[id]/route.ts` | 10 | DELETE only — scoped `findFirst` guard, then delete. No PATCH exists. |
| `apps/invoices/app/api/brand/route.ts` | 5 | Returns `getBrand()` — tenant name/logo/color for the PDF logo fetch. |
| `apps/invoices/middleware.ts` | 23 | `TOOL = "invoices"`; same JWT + `canAccessTool` gate as every suite app. |
| `packages/core/src/lib/invoice.ts` | 105 | The shared types (`InvoiceData`, `InvoiceItem`, `InvoiceTotals`), `genInvoiceNumber`, `emptyInvoice` defaults, and `computeInvoiceTotals` — the money math. |
| `packages/core/src/lib/clientLink.ts` | 21 | `findOrCreateClient` — case-insensitive name match within tenant; backfills phone/address/gstin onto an existing client only where blank. |
| `packages/core/src/lib/brand.ts` | 43 | `getBrand()` — Tenant row by request host, 60 s cache, MapleOne fallback. |
| `packages/core/src/lib/pdf-render.ts` | 29 | **Not used by this module.** Rasterizes catalog PDFs to webp via `pdf-to-img` + `sharp` — serves the catalog app. Listed here because its name invites the wrong assumption. |
| `packages/core/src/lib/watermark.ts` | 41 | **Not used by this module.** ffmpeg/sharp logo overlays for photoshoot media. Same caveat. |

#### Lifecycle: create → save → auto-payment

1. `emptyInvoice()` seeds the state: today's date, one blank item, GST 18% excluded with CGST/SGST split on, account name "Maple Furnishers", the "Goods once sold…" note, and `number = genInvoiceNumber()`.
2. Every edit recomputes `computeInvoiceTotals(data)` in a `useMemo` and mirrors into the preview pane.
3. **Save** (`onSave`, page.tsx lines 46–54): blocks only on a blank client name, then POSTs `{ number, total: totals.grandTotal, dueDate, status: "unpaid", data, client: { name, phone, address, gstin } }`. Note `status` is hard-coded `"unpaid"` at the call site — every re-save of a paid invoice silently resets it.
4. The handler (`api/invoices/route.ts`):
   - `findOrCreateClient(b.client)` — matches by case-insensitive name in-tenant, creates if new, returns `null` for blank names.
   - `invoice.upsert({ where: { number } … })` — create or overwrite the full row including the whole `data` JSON.
   - `payment.findFirst({ where: { invoiceId } })` → if none and `total > 0`, `payment.create({ invoiceId, clientId, label: "Invoice <number>", amount: total, dueDate, status: "due" })`. This is the invoices→payments handoff — the only automated hop in the whole chain.
5. Any thrown error becomes a blanket `503 { error: "Could not save." }`.

```mermaid
sequenceDiagram
    participant B as Browser (editor)
    participant A as POST /api/invoices
    participant C as findOrCreateClient
    participant P as Postgres (tenantDb)
    B->>B: computeInvoiceTotals(data)
    B->>A: number, total, dueDate, status unpaid, data, client
    A->>C: match client by name or create
    C-->>A: clientId (null if no name)
    A->>P: invoice.upsert(where number)
    A->>P: payment.findFirst(invoiceId)
    alt no payment yet and total above zero
        A->>P: payment.create(due, amount = total)
    end
    A-->>B: invoice row
```

**Verified gotcha — the upsert escapes tenancy.** `tenantDb()` (`packages/core/src/lib/tenant-db.ts` lines 19–24) hooks exactly six operations: `findMany`, `findFirst`, `count`, `updateMany`, `deleteMany`, `create`. **`upsert` is not one of them.** Consequences, straight from the code: the create branch never gets `tenantId` stamped (new invoices are written with `tenantId = NULL`), and the update branch matches on the *globally* unique `number` with no tenant filter — a second tenant saving a colliding number would overwrite the first tenant's invoice. NULL-tenant rows are then invisible to the tenant-filtered `GET /api/invoices` and un-deletable through the scoped-guard DELETE. Today this is masked by two accidents — the UI never lists from the DB, and there is effectively one tenant — but it is the first thing to fix before either accident stops being true. (The auto-created `Payment` row *does* go through `create` and is stamped correctly, which is why saved invoices appear in Payments while the invoices table quietly accumulates orphan-tenant rows.)

**Verified gotcha — number generation is random, not serial.** `genInvoiceNumber()` is date + `Math.floor(100 + Math.random() * 900)` — a 1-in-900 same-day collision. Because persistence is upsert-by-number, a collision doesn't error: it **silently overwrites the other invoice**. Also `MF-INV-20260717-123` is 19 characters, which matters for GST compliance (B3.1).

#### Lifecycle: PDF render path

The Download button (`download`, page.tsx lines 34–44):

1. `fetch("/api/brand")` → `getBrand()` → `Tenant` row for the request host → `logoUrl` (or undefined on any failure).
2. `pdf(<InvoicePdf data totals logo />).toBlob()` — `@react-pdf/renderer` runs **in the browser**. `invoice-pdf.tsx` falls back to the baked-in `MAPLE_LOGO_B64` when no tenant logo.
3. Object-URL + synthetic `<a download>` click; filename `<number>.pdf`.

Three properties follow directly:

- **Fonts come from `cdnjs.cloudflare.com` at render time** (`Font.register`, invoice-pdf.tsx lines 7–15) — four Roboto TTFs. Offline or CDN-blocked ⇒ Download fails; also a supply-chain/pinning smell.
- **The export bypasses `act:export`.** No server endpoint is involved beyond the brand fetch, so the seeded export permission is never checked — consistent with the RBAC review finding ([rbac-matrix.md](rbac-matrix.html)) that no route enforces action-level perms.
- **Company identity is hard-coded**, twice: the PDF (name "MAPLE FURNISHERS", tagline, Kirti Nagar address, phone, footer with 36-month warranty) and the HTML preview repeat the same literals. Only the logo is tenant-driven. Notably absent from both: the **seller's own GSTIN** — see B3.1.

`computeInvoiceTotals` order of operations (invoice.ts lines 78–104): items gross → minus per-item discounts → minus overall discount = `taxable` → plus packing (% of taxable) and loading (flat) = GST base → GST on top (`excluded`) or back-calculated out (`included`) → CGST/SGST = gst/2 each when split. **Trap:** this is *not* identical to the quotations math (`utils.ts computeTotals`) — there, GST is computed on the post-discount amount *excluding* packing and loading. Same inputs with packing/loading present produce different grand totals across the two modules; B1 owns the consistency rule.

### A3 · Data model and API

Owned model: `Invoice`. The full editor state lives in the `data` Json column; `total`/`status`/`dueDate` are denormalized for lists. `clientId` is nullable — invoices with no client are legal at the DB level. **Verified: there is no `orderId` on `Invoice`** — the schema has no order→invoice relation at all.

```mermaid
erDiagram
    INVOICE {
        string id PK
        string tenantId "nullable, NULL via upsert bug"
        string number UK "auto MF-INV-date-nnn, globally unique"
        string clientId FK "nullable"
        json data "full InvoiceData blob"
        float total "default 0, denormalized grand total"
        string status "unpaid, partial, paid - never transitions"
        datetime dueDate "nullable"
        datetime createdAt
    }
    CLIENT ||--o{ INVOICE : "clientId"
    INVOICE ||--o{ PAYMENT : "auto-seeded on save"
```

#### API surface with JSON shapes

| Route | Body → Response | Auth that actually exists |
| --- | --- | --- |
| GET `/api/invoices` | — → `[{ id, tenantId, number, clientId, data, total, status, dueDate, createdAt, client: { name } \| null }]` | Middleware: `mt_session` JWT + `canAccessTool(perms, "invoices", role)` |
| POST `/api/invoices` | see below → full `Invoice` row; `400` if no `number`; blanket `503 { error: "Could not save." }` | Middleware tool gate only — no `can()` in handler |
| DELETE `/api/invoices/[id]` | — → `{ ok: true }` or `404 { error: "Not found in tenant" }` | Middleware tool gate only — **no `act:delete` check** |
| GET `/api/brand` | — → `{ name, logoUrl, primaryColor, domain }` | Middleware tool gate |
| POST `/api/auth/logout` | — → clears cookie | None (matcher excludes `api/auth`) |

```json
// POST /api/invoices — what the editor sends
{
  "number": "MF-INV-20260717-412",
  "total": 118000,
  "dueDate": "2026-08-01",
  "status": "unpaid",
  "client": { "name": "A. Sharma", "phone": "98…", "address": "…", "gstin": "07ABCDE1234F1Z5" },
  "data": {
    "number": "MF-INV-20260717-412", "date": "2026-07-17", "dueDate": "2026-08-01",
    "client": { "name": "A. Sharma", "phone": "…", "address": "…", "gstin": "…" },
    "items": [{ "id": "…", "description": "3-seater sofa", "hsn": "9401", "qty": 1,
                "price": 100000, "discountValue": 0, "discountType": "flat" }],
    "charges": { "overallDiscountValue": 0, "overallDiscountType": "flat",
                 "packingPercent": 0, "loadingCharge": 0, "gstPercent": 18,
                 "gstMode": "excluded", "splitCgstSgst": true },
    "payment": { "bankName": "…", "accountName": "Maple Furnishers",
                 "accountNumber": "…", "ifsc": "…", "upiId": "…" },
    "notes": "Goods once sold will not be taken back. Subject to Delhi jurisdiction."
  }
}
```

Note the shape duplication: `number`/`dueDate`/client fields travel both at the top level (for columns) and inside `data` (for the blob) — they can and do drift if a client edits one but not the other via other tooling.

**Deletion orphans the payment.** DELETE removes only the invoice; the auto-created `Payment` has a nullable FK and no cascade, so the payments module keeps showing a due amount whose invoice no longer exists — a dangling receivable. Fix options in B1 (consistency rules).

### A4 · Config reference

| Variable | Used by | Effect (dev default in `apps/invoices/.env.local`) |
| --- | --- | --- |
| `DATABASE_URL` | Prisma | `postgresql://postgres:maple@localhost:5544/mapletools` |
| `AUTH_SECRET` | session verify | `dev-secret` locally — rotate in prod |
| `COOKIE_DOMAIN` / `SSO_DOMAIN` | session cookie | `.maplefurnishers.com` — one SSO cookie suite-wide |
| `LOGIN_URL` | middleware redirect | `https://admin.maplefurnishers.com/login` |
| `FLIPT_URL` / `FLIPT_NAMESPACE` | `isEnabled("tool.invoices")` | Unset ⇒ fail-open; 30 s cache |
| `APP=invoices` | container entrypoint | Selects this app in `maple-suite:latest` |

Not configurable today, though it should be: the company block on the PDF (hard-coded), the default GST rate and notes (`emptyInvoice()` literals), the invoice-number format (function body), and the font source (cdnjs URLs). All four belong on the `Tenant` row.

Runbook: `npm run -w @maple/app-invoices dev -- -p 3007` (`PORTS.local.txt`). Seed creates **no demo invoices**; `admin` (`*`), `sales`, and `accounts` get `tool:invoices` (demo logins `maple@123`). No tests under `apps/invoices`; no `/api/health`.

### A5 · Recipes

#### Recipe 1 — customize the invoice PDF layout

Everything visual lives in `apps/invoices/app/invoice-pdf.tsx`; the preview pane in `page.tsx` (lines 131–167) must be changed in lockstep or the preview lies.

1. **Theme**: the maroon is `const MAROON = "#702119"` — used by header rule, table head, totals rule, labels. To make it tenant-driven, thread `primaryColor` from the existing `/api/brand` fetch into `<InvoicePdf>` alongside `logo` and replace the constant with a prop default.
2. **Company block**: `s.brand` text and the `s.contact` address block (lines 53–57) are literals. Replace with props fed from `getBrand()` — the API already returns `name`; address/phone/GSTIN need new `Tenant` columns (one migration, then `brand.ts` passes them through).
3. **Add a table column** (e.g. per-item discount): add a flex style `cDisc: { flex: 1.2, textAlign: "right" }`, one `<Text>` in the `thead` row and one in the item `map` — column widths are flex ratios, so the row stays aligned automatically. Mirror in the preview `<table>`.
4. **Fonts**: to remove the cdnjs dependency, download the four Roboto TTFs into `apps/invoices/public/fonts/` and point `Font.register` at `/fonts/…` — same-origin, versioned, works offline. (Or embed as base64 data URIs like `MAPLE_LOGO_B64` if you want zero requests.)
5. **Page furniture**: the footer is a `fixed` element (repeats on every page if items overflow to page 2 — `@react-pdf` paginates automatically); the signatory block is positioned by flex, not absolutely, so long notes push it down. Test with 30+ items before shipping layout changes.

#### Recipe 2 — add a field to the invoice (type → editor → PDF)

Example: `placeOfSupply` (needed for B3.1 anyway).

1. `packages/core/src/lib/invoice.ts`: add `placeOfSupply: string` to `InvoiceData`, default `"07-Delhi"` in `emptyInvoice()`.
2. `page.tsx`: one `<Field label="Place of supply"><Input …/></Field>` in the Invoice section, wired to `set({ placeOfSupply: … })`.
3. `invoice-pdf.tsx` + preview: render it in the meta box.
4. **No API or schema change needed** — the whole editor state rides inside the `data` Json column. That's the payoff of the blob design; the cost is that you cannot query by the new field without a Postgres `data->>'placeOfSupply'` expression index.
5. Existing localStorage drafts lack the field — guard with `data.placeOfSupply ?? ""` at render sites (the mount-time `JSON.parse` does no migration).

## Testing — how we verify this module

**Honest current state: zero automated tests.** No test file exists under `apps/invoices` (verify: `find apps/invoices -name "*.test.*"`). More pointed: `packages/core/src/lib/invoice.ts` — the money math every bill depends on — has no test either, even though `utils.test.ts` sits in the same directory (it covers only `money()`). The root vitest config already globs `apps/**/*.test.{ts,tsx}` and `packages/**`; the harness exists, the coverage doesn't. Suite-wide Playwright = `e2e/login.spec.ts`, two SSO smokes.

**Unit targets** — this module owns the most test-worthy pure function in the suite:

- **`computeInvoiceTotals`, with the packing/loading tax divergence as a pinned test case.** One fixture, two libraries, two answers: items ₹1,00,000, packing 2% (₹2,000), loading ₹1,000, GST 18% excluded. This module taxes packing+loading (base ₹1,03,000 → GST ₹18,540 → grand **₹1,21,540**); quotations' `computeTotals` taxes only the ₹1,00,000 and adds packing/loading untaxed (grand **₹1,21,000**). The shared test fixture asserts both current values, so the ₹540 disagreement is documented until B1 Spec 2 picks one behaviour — at which point one assertion flips and the suite forces the other lib to follow.
- The rest of `computeInvoiceTotals`: included-mode back-calculation (`base = incl / (1 + rate)`), CGST/SGST halving, `Math.max(0, …)` clamps on over-discounting, empty-items → all-zeros.
- **`genInvoiceNumber` collision:** only 900 possible same-day suffixes; assert two same-day numbers *can* collide (seeded RNG) and that format is 19 chars — both feed the named regression below and the Rule 46 gap (B3.1).
- **Date coercion:** POST's `dueDate` handling — `""` → `null` (falsy), valid ISO → `Date`, garbage string → Invalid Date reaching Prisma (today swallowed into the blanket 503).

**Integration targets** (route handlers on a scratch Postgres, two tenants seeded). Named regression cases:

| Named case | Asserts | Today |
| --- | --- | --- |
| `REG-upsert-tenant-guard` | Saving as tenant A creates a row with `tenantId = A` (not NULL), and tenant B saving the same `number` does **not** overwrite A's invoice | **Red** — `upsert` bypasses `tenantDb()` on both branches (A2) |
| `REG-number-collision-overwrite` | Two different invoices colliding on `number` → second save refuses; first invoice intact | **Red** — upsert-by-number silently overwrites |
| `REG-auto-payment-orphaning` | DELETE of an invoice removes (or blocks on) its auto-created due `Payment`, never leaves a dangling receivable | **Red** — `SetNull` orphan (A3); goes green with B1 Spec 2's transactional delete |
| `REG-mass-assignment-rejection` (POST variant) | Client-supplied `status` is ignored once status becomes server-owned; re-save of a paid invoice must not reset it to `unpaid` | **Red** — POST trusts `b.status`, editor always sends `"unpaid"` |
| Auto-payment idempotency | Re-saving an invoice never creates a second due row; changed `total` on re-save is flagged (payment drift, A2 of payments bible) | Half-green — `findFirst` guard skips creation, drift unasserted |

The status lifecycle the rollup tests will pin once B1 Spec 2 lands — designed, not yet real (today every invoice is stuck in `unpaid`):

```mermaid
stateDiagram-v2
    [*] --> unpaid : invoice saved
    unpaid --> partial : first payment marked paid
    partial --> paid : paid sum reaches total
    unpaid --> paid : single full payment
    paid --> partial : payment reverted or refund
    partial --> unpaid : last paid row reverted
    paid --> [*] : receivable closed
```

**E2E user stories** (Playwright, live stack):

1. Accounts logs in, builds a wardrobe invoice (1 item, 18% GST excluded, split on), sees the preview grand total match ₹1,18,000, saves — then opens `payments.maplefurnishers.com` and finds the auto-seeded due row for the same amount.
2. Download produces a PDF blob named `<number>.pdf` (assert the download event; content spot-check via pdf text extraction is stretch goal).
3. Reload mid-edit: the draft returns from localStorage exactly as left, including the auto-generated number.
4. Re-saving the same invoice twice leaves exactly one payment row in the ledger.

**Definition of done:** `computeInvoiceTotals` fixture suite (incl. the divergence case) runs in `npm test` and is mirrored against quotations' `computeTotals`; the five named regression cases exist with the red ones marked expected-fail-with-reason; E2E stories 1 and 4 pass against `scripts/dev.sh`; CI blocks on the unit suite before any change to `invoice.ts` merges.

---

## Part B — for architects

### B1 · Cross-module: designing the missing chain links

#### Spec 1 — `Invoice.orderId`: column, relation, backfill

The single highest-leverage schema change in the suite: it turns "which orders have been billed" from tribal knowledge into a query.

**Prisma** (`schema.prisma`):

```prisma
model Invoice {
  // …existing fields…
  orderId  String?
  order    Order?  @relation(fields: [orderId], references: [id], onDelete: SetNull)
}
model Order {
  // …existing fields…
  invoices Invoice[]
}
```

**Migration SQL** (what `prisma migrate dev --name invoice-order-link` will generate, plus the index it won't):

```sql
ALTER TABLE "Invoice" ADD COLUMN "orderId" TEXT;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Invoice_orderId_idx" ON "Invoice"("orderId");
```

**Backfill** — best-effort heuristic, run once, results reviewed by a human before commit. Match on same tenant + same client + amount within ₹1 + invoice created on/after the order, taking the nearest order per invoice:

```sql
WITH candidates AS (
  SELECT i.id AS invoice_id, o.id AS order_id,
         ROW_NUMBER() OVER (PARTITION BY i.id ORDER BY o."createdAt" DESC) AS rn
  FROM "Invoice" i
  JOIN "Order" o ON o."clientId" = i."clientId"
   AND o."tenantId" IS NOT DISTINCT FROM i."tenantId"
   AND ABS(o."value" - i."total") < 1
   AND i."createdAt" >= o."createdAt"
  WHERE i."orderId" IS NULL AND i."clientId" IS NOT NULL
)
UPDATE "Invoice" i SET "orderId" = c.order_id
FROM candidates c WHERE c.invoice_id = i.id AND c.rn = 1;
```

Honest expectation: with `value` being a manual float and most orders orphaned (no `clientId`), this will match a minority of rows. That's fine — the point is the column, not the history.

**Population flow**: mirror the quote→order convert ([module-orders.md](module-orders.html) B1). An order card gains "Raise invoice" → `invoices.maplefurnishers.com/?fromOrder=<id>`; the editor, seeing the param, fetches the order (+ its quotation items via `quotationId` when present), pre-fills client and line items, and includes `orderId` in the save body; POST persists it. Manual invoices keep `orderId = null` — walk-in sales are real.

#### Spec 2 — consistency rules

| Situation | Rule |
| --- | --- |
| Order edited after invoice raised | Invoice is a **snapshot** — never auto-update it (it is a legal document once issued). Surface drift instead: order card shows `Σ invoices.total` vs `value`. |
| Invoice deleted | Delete must be transactional with its payments: `$transaction([payment.deleteMany({ where: { invoiceId, status: "due" } }), invoice.delete(…)])` — paid payments block deletion (`409`), because deleting a paid invoice is an accounting event (that's a credit note, B3.4). Fixes today's orphaned-payment bug at the same time. |
| Payment marked paid | Roll up: when `Σ paid ≥ total` ⇒ `status = "paid"`, `> 0` ⇒ `"partial"` — computed in the payments module's PATCH, or derived at read time and the column dropped. Either ends the write-once lie; and the editor must stop sending `status: "unpaid"` on every save (make `status` server-owned). |
| Quote → invoice totals | `computeInvoiceTotals` taxes packing+loading; quotations' `computeTotals` does not (A2). Decide one behaviour (taxing them is the defensible one under GST — they are part of the taxable value of a composite supply), fix the other lib, and add a shared unit test that pins both to the same fixture. |

#### Spec 3 — event schemas

Envelope identical to the orders bible; the outbox does not exist yet ([event-catalog.md](event-catalog.html)).

```json
{
  "id": "evt_…", "type": "invoice.issued", "version": 1,
  "tenantId": "ten_maple", "occurredAt": "2026-07-17T11:02:00Z",
  "payload": {
    "invoiceId": "inv_…", "number": "MF-INV-20260717-412",
    "orderId": "ord_… | null", "clientId": "cli_… | null",
    "total": 118000, "taxable": 100000, "gst": 18000,
    "dueDate": "2026-08-01", "placeOfSupply": "07"
  }
}
```

```json
{
  "type": "invoice.paid", "version": 1, "tenantId": "ten_maple",
  "occurredAt": "…",
  "payload": {
    "invoiceId": "inv_…", "number": "MF-INV-20260717-412",
    "clientId": "cli_…", "total": 118000,
    "paidAt": "2026-07-30T…", "paymentIds": ["pay_…"],
    "method": "upi", "settledInDays": 13
  }
}
```

`invoice.issued` fires on first successful save (not on re-saves — key off the upsert create branch); consumers: **finance** (income entry), **crm** (client timeline), **payments** (replaces the in-handler `payment.create`, decoupling the hop that is currently non-transactional). `invoice.paid` fires from the payments module when the rollup crosses to `paid`; consumers: finance, crm, and the reminders scheduler (B3.3) which cancels pending reminders.

**Failure modes:** (1) today, upsert succeeds and `payment.create` throws ⇒ invoice with no receivable and a blanket 503 that makes the user re-save (harmless only because the payment check is idempotent) — wrap in `$transaction` now, move to outbox later; (2) event consumed twice ⇒ consumers idempotent on `id`; (3) `invoice.issued` emitted, then invoice number edited and re-saved ⇒ upsert creates a *second* invoice — the editor must treat `number` as immutable after first save (fetch-by-number guard) or carry the row `id` in state.

### B2 · Infra — bootstrap vs enterprise

**Invoice-number sequences** — the load-bearing decision, because GST wants consecutive series (B3.1):

| | Redis `INCR` | Postgres counter table |
| --- | --- | --- |
| Mechanics | `INCR seq:{tenantId}:{fy}` → format | `UPDATE "InvoiceCounter" SET n = n + 1 WHERE "tenantId" = $1 AND fy = $2 RETURNING n` inside the same transaction as `invoice.create` |
| Throughput | ~100 k/s, irrelevant here (tens of invoices/day) | Row-lock serializes writers per tenant per FY — thousands/day per tenant, still 100× headroom |
| Failure behaviour | Number allocated even if the DB insert then fails ⇒ **gaps**; async replication failover can replay an offset ⇒ **duplicates**. Both are compliance defects, not perf trade-offs | Rollback returns the number atomically ⇒ **gapless**; duplicates impossible (`number` stays `@unique` as backstop) |
| New infra | A Redis to run, monitor, back up | None — it's a table |
| Verdict | Wrong tool for a *legal* sequence at any scale; right tool only if numbering were advisory | **Correct at every scale this product will see.** Note: native Postgres `SEQUENCE`s are non-transactional (gaps on rollback) — the counter *table* is the point |

**Eventing/runtime**: same two tracks as the orders bible — Postgres outbox + poller now; Kafka topic `suite.invoices.events` keyed by `tenantId` when modules split. K8s profile: the invoices *server* is as light as orders (`100m/256Mi` requests) because PDF work happens in browsers; adopting server-side rendering (B3.5) changes that calculus — rendering pods want `500m/1Gi` and a queue, which is exactly why B3.5 is designed as a separate worker, not a fatter web pod.

### B3 · Designed enhancements

#### B3.1 GST e-invoice readiness (researched July 2026)

What the GSTN regime actually requires, with sources, mapped to this codebase:

- **Who must register invoices (IRN):** businesses with annual aggregate turnover (AATO) ≥ **₹5 crore** must report every B2B invoice to an Invoice Registration Portal (IRP), which validates it, assigns a 64-char **IRN** (a hash of supplier GSTIN + document type + document number + financial year), and returns a **signed QR code** that must appear on the printed invoice ([ClearTax e-invoicing guide](https://cleartax.in/s/e-invoicing-gst), [GSTN e-invoice FAQ](https://www.gstn.org.in/assets/mainDashboard/Pdf/GST%20e-invoice%20System%20-%20FAQs.pdf)). B2C invoices are outside IRN; a dynamic-QR mandate exists separately for AATO > ₹500 crore.
- **Reporting window:** from 1 April 2025, taxpayers with AATO ≥ ₹10 crore must upload within **30 days of invoice date** — late invoices are rejected by the IRP and become invalid for the buyer's input-tax credit ([einvoice6.gst.gov.in advisory](https://einvoice6.gst.gov.in/content/revised-time-limit-for-e-invoice-reporting-for-businesses-with-aato-of-%E2%82%B910-crores-above/), [IndiaFilings](https://www.indiafilings.com/learn/gst-einvoice-30-day-rule-10crore-turnover)).
- **Schema:** FORM GST INV-01 defines ~132 fields, **28 mandatory + 18 conditionally mandatory** ([IRIS GST on INV-01](https://irisgst.com/gst-e-invoicing-proposed-framework-and-format-released-by-gstn/), [NIC Generate-IRN API](https://einv-apisandbox.nic.in/version1.01/generate-irn.html)).
- **Numbering (Rule 46(b) CGST):** invoice numbers must be consecutive, **≤ 16 characters**, alphanumeric plus only `-` and `/`, unique per financial year, with the series reset each FY ([CBIC Rule 46 text](https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/rules/cgst_rules/active/chapter6/rule46_v1.00.html), [IRIS GST FY-reset advisory](https://irisgst.com/effective-1st-april-2019-reset-the-invoice-number-series-gst-advisory/)).
- **E-way bill:** goods movement needs one at consignment value > **₹50,000 interstate**; Delhi intrastate threshold is **₹1,00,000** ([ClearTax state-wise limits](https://cleartax.in/s/state-wise-threshold-limits-e-way-bills), [myBillBook 2026 table](https://mybillbook.in/s/eway-bill-limit/)) — squarely relevant to a Delhi furniture business delivering big-ticket orders into NCR/interstate.

Where the current implementation stands against that, verified in code:

| Requirement | Today | Gap |
| --- | --- | --- |
| Number ≤16 chars, consecutive, FY-unique | `MF-INV-20260717-412` = **19 chars, random** | Non-compliant twice over. New format `MF/26-27/00042` (14 chars) from the B2 counter, FY-scoped |
| Seller GSTIN on invoice | **Absent** — hard-coded block has address/phone only | Add to `Tenant`, print in header |
| Place of supply + state codes | Absent | Required field (Rule 46); drives CGST+SGST vs IGST |
| IGST for interstate supply | Impossible — math only knows CGST/SGST split or flat GST | Add `igst` path to `computeInvoiceTotals` keyed off place of supply vs seller state |
| Per-line taxable value, rate, unit | qty/price/HSN only | Extend `InvoiceItem`; INV-01 wants line-level tax detail |
| IRN, ack, signed QR storage | No columns | Schema below |

```prisma
// e-invoice readiness columns on Invoice
irn            String?   @unique   // 64-char IRP hash
irnStatus      String    @default("not_applicable") // not_applicable | pending | registered | cancelled | failed
ackNo          String?
ackDate        DateTime?
signedQr       String?   // JWS from IRP, rendered as QR on the PDF
ewayBillNo     String?
ewayBillValidTill DateTime?
placeOfSupply  String?   // state code, e.g. "07"
docType        String    @default("INV") // INV | CRN | DBN
```

Flow: issue locally → an `einvoice` worker (GSP API client — NIC/IRP via a GSP like ClearTax/Cygnet is the realistic route, direct NIC API needs registration) submits, stores `irn/ackNo/signedQr`, flips `irnStatus` — and the PDF re-renders with the QR. Cancellation is only allowed within 24 h on the IRP; after that it's a credit note (B3.4). None of this activates until Maple's AATO crosses ₹5 crore — the readiness work is the schema, the counter-based numbering, IGST math, and the seller-GSTIN print, all of which are correct to do anyway.

#### B3.2 Recurring invoices

For AMC/maintenance contracts. New model, deliberately a *template*, not an invoice:

```prisma
model RecurringInvoice {
  id        String    @id @default(cuid())
  tenantId  String?
  clientId  String
  template  Json      // InvoiceData minus number and dates
  cadence   String    // monthly | quarterly | yearly
  nextRunAt DateTime
  active    Boolean   @default(true)
  createdAt DateTime  @default(now())
}
```

A daily cron (suite has no scheduler yet — a `node-cron` sidecar or K8s CronJob hitting an internal route) finds `active AND nextRunAt <= now()`, mints a real invoice via the same code path as POST (number from the counter, `invoice.issued` event, auto-payment), advances `nextRunAt`. Idempotency: stamp `template->>'recurringId'` + period into the created row and skip if present — reruns after a crashed cron must not double-bill.

#### B3.3 Payment reminders

Schedule relative to `dueDate`: T−3 (gentle), T (due today), T+7 and T+21 (overdue), stop on `invoice.paid`. Storage: a `Reminder` table (`{ invoiceId, kind, sendAt, sentAt?, channel }`) written when the invoice is saved with a due date; the same daily cron drains it.

Channels, both tracks: **bootstrap** — a "Send reminder" button producing a prefilled `https://wa.me/<phone>?text=<encoded>` deep link plus a mailto fallback; zero infra, human stays in the loop, works tomorrow. **Enterprise** — WhatsApp Business Cloud API with a pre-approved template (`payment_reminder_v1`, variables: client name, number, amount, due date, UPI link) and SES/Resend for email; requires Meta business verification and template review, so design the `Reminder.channel` field now and swap the sender later. The UPI deep link (`upi://pay?pa=<upiId>&am=<amount>&tn=<number>`) can be generated from the invoice's own `payment.upiId` field — the data is already captured.

#### B3.4 Credit notes

The missing half of the accounting loop (returns, post-issue discounts, botched invoices older than the IRP's 24 h cancel window). GST requires credit notes to reference the original invoice and be reported like invoices (docType `CRN`).

```prisma
model CreditNote {
  id        String   @id @default(cuid())
  tenantId  String?
  number    String   @unique          // own FY series, CN/26-27/0001
  invoiceId String
  invoice   Invoice  @relation(fields: [invoiceId], references: [id])
  reason    String                    // return | discount | correction
  data      Json                      // line items being credited
  total     Float
  createdAt DateTime @default(now())
}
```

Flow: created *from* an invoice (never free-floating), capped at `invoice.total − Σ existing credit notes`; effect on receivables: reduce the linked due `Payment` (or create a negative adjustment row — pick one and document it in the payments bible); event `creditnote.issued`; PDF is the same layout titled "CREDIT NOTE" with a reference line to the original number/date — one `docType` prop on `InvoicePdf`, not a second component.

#### B3.5 Server-side PDF generation

Client-side rendering is fine until you need: reminders with attached PDFs (B3.3), archived copies that match what the client got, the signed e-invoice QR (B3.1), or `act:export` to mean anything. Design — **a worker, not a bigger web pod**:

1. `POST /api/invoices/[id]/render` → checks `can(perms, "export")` (finally), inserts a `RenderJob` row (`pending`), returns `202 { jobId }`. Bootstrap queue is the table itself + poller; enterprise is BullMQ/Redis or SQS.
2. Worker renders with the *same* `InvoicePdf` component — `@react-pdf/renderer`'s Node API (`renderToBuffer`) accepts identical JSX, so preview and archive cannot drift. Fonts read from disk (Recipe 1 step 4 is a prerequisite).
3. Output to object storage (bootstrap: the `CATALOG_STORAGE`-style local dir that already exists for catalog; enterprise: S3 with per-tenant prefixes) keyed `invoices/{tenantId}/{invoiceId}/{sha}.pdf` — content-addressed, so re-renders of unchanged data dedupe.
4. Download via `GET /api/invoices/[id]/pdf?token=…` — a short-lived HMAC token (`AUTH_SECRET`-signed, 15 min expiry, bound to invoiceId + userId) or native S3 presigned URLs on the enterprise track. The browser Download button stays as the instant path; "email/WhatsApp with PDF" uses the stored artifact.

### B4 · Scaling

- Volume is a non-problem (an aggressive tenant writes thousands of invoices/year); the `data` blob keeps rows ~5–20 KB — list endpoints should `select` the denormalized columns and skip `data` once a real list UI exists.
- The real scaling axis is **tenant isolation correctness**: fix the `upsert` tenancy hole (A2) and make `number` unique *per tenant* (`@@unique([tenantId, number])` replacing the global `@unique`) before onboarding tenant #2 — two businesses will absolutely both want `MF/26-27/0001`-style series.
- Browser PDF rendering scales perfectly (it's the client's CPU) — that's an argument for keeping it as the interactive path even after B3.5 ships.
- `computeInvoiceTotals` floats: money math on IEEE 754 is fine at display precision (`money()` rounds), but the GST columns for e-invoicing want paise-exact values — move to integer paise or a decimal lib when B3.1 activates, and pin with fixtures first.

## AI — use case & pipeline

*Same contract as every AI section in these bibles ([ai-layer.md](ai-layer.html)): module owns retrieval and the review surface, the maple-ai gateway owns keys, models and spend; every call logs an `AiRequest`, every human fix a `Correction` ([er-platform.md](er-platform.html)).*

### Use case 1 — payment-reminder drafting (the human always sends)

**For managers.** B3.3 already schedules the *when* — T−3, due day, T+7, T+21. AI writes the *what*: a gentle pre-due nudge reads very differently from a T+21 overdue notice to a client who has settled late twice before, and today someone composes each one by hand or sends nothing. The draft appears in a queue, accounts tweaks a word if needed, and taps send through the same wa.me/mailto deep link B3.3 designs. The system never messages a client by itself.

One structural guardrail worth its sentence: the model returns copy with `{{amount}}` / `{{number}}` / `{{dueDate}}` placeholders and the module substitutes the real values verbatim — a hallucinated rupee figure is impossible by construction, not by prompt.

```mermaid
flowchart LR
    REM[(Reminder row due B3.3)] --> CRON[daily drain cron]
    CRON --> GW[gateway POST /v1/draft-reminder]
    GW --> AN[haiku-4.5 placeholder copy]
    AN --> GW
    GW --> LOG[(AiRequest - reminder-draft)]
    GW --> SUB[module substitutes amount and dates verbatim]
    SUB --> Q[reminders queue screen]
    Q --> HR{{HUMAN REVIEW - accounts edits then sends}}
    HR -->|send| WA[wa.me or mailto deep link - human sends]
    HR -->|edited before send| CORR[(Correction row)]
```

| Concern | Decision |
| --- | --- |
| Endpoint | gateway `POST /v1/draft-reminder`, called by B3.3's daily drain when a `Reminder` row falls due; the draft is stored on the row |
| Context sent | invoice number/amount/due date, reminder kind (T−3…T+21), channel, and the client's payment history (count of late settlements from `Payment` rows) |
| `json_schema` | `{ message: string (≤600 chars, placeholders for all figures), subject: string\|null, tone: "gentle"\|"neutral"\|"firm" }` — `additionalProperties: false` |
| Model | `haiku-4.5` — short templated copy; a bigger model writes nothing a reviewer wouldn't rewrite anyway |
| ₹/draft | ≈₹0.10–0.20 — at tens of invoices/day this rounds to nothing beside the ₹8–10 fable-5 catalog pages funding the gateway ([ai-layer.md](ai-layer.html)) |
| Spend log | `AiRequest { module: "invoices", useCase: "reminder-draft", promptVersion: "reminder-draft-v1" }` |
| Review surface | the reminders queue — accounts edits then sends; **human sends, always**. On the enterprise WhatsApp track this is doubly true: business-initiated messages must be pre-approved templates (tasks bible B3.2), so the draft degrades gracefully into template variables |
| Correction capture | edited-before-send diffs → `Correction` rows — per-tenant tone preferences emerge from these |

**Rollout & honest gate:** not before B3.3's `Reminder` table and drain cron exist — the AI is a better writer *inside* that design, not a replacement for it. Ship B3.3's static templates first; add drafting when someone actually complains the templates read robotic.

### Use case 2 — bank-statement line → invoice matching (the bigger prize)

**For managers.** Month-end reconciliation is reading a bank CSV against the payments ledger, line by line. Deterministic rules clear most of it — exact amount, UTR reference, sensible date window. The residue is where the hours actually go: partial payments, one transfer covering two invoices, an "IMPS-SHRMAINTRR" narration. The assistant proposes matches for that residue; accounts confirms every single one. Nothing flips to paid without a click, because a wrong auto-match corrupts the receivable ledger.

```mermaid
flowchart LR
    CSV[bank statement upload] --> P[parser normalizes lines]
    P --> RULES[rule matcher - amount + UTR + date window]
    RULES -->|clean hits| SUG[suggested matches]
    RULES -->|residue| GW[gateway POST /v1/match-statement]
    GW --> AN[sonnet-5 allocation output]
    AN --> GW
    GW --> LOG[(AiRequest - statement-match)]
    SUG --> HR{{HUMAN REVIEW - every match confirmed before any write}}
    GW --> HR
    HR -->|confirm| PAY[Payment paid then status rollup then invoice.paid event]
    HR -->|reject or reallocate| CORR[(Correction row - first Dataset to freeze)]
```

| Concern | Decision |
| --- | --- |
| Endpoint | statement upload route in the invoices/payments surface → rules pass in code → residue only to gateway `POST /v1/match-statement` |
| Rules pass first | exact amount within a date window + UTR/ref match against `Payment` rows — ₹0, deterministic, expected to clear the majority; **measure the residue % before building any model call** |
| Model input | residue lines + top ~10 candidate open invoices per line (amount proximity, client-name trigram) — candidates retrieved by the module; the model ranks and allocates, it never searches |
| `json_schema` | `{ matches: [{ lineId, kind: "full"\|"partial"\|"multi"\|"none", allocations: [{ invoiceNumber, amountPaise }], rationale: string, confidence: "high"\|"low" }] }` — paise integers, per the B4 money-precision note |
| Model | `sonnet-5` — cross-record reasoning over 10–20 candidates per line; haiku confuses partials with unrelated near-amounts |
| ₹/batch | ≈₹0.50–1.00 per ~20 residue lines — a whole month-end costs less than one catalog page |
| Spend log | `AiRequest { module: "invoices", useCase: "statement-match", promptVersion: "statement-match-v1" }` |
| Review surface | a reconciliation screen where every suggestion is confirm/reject; confirm marks the `Payment` paid, which drives the B1 Spec 2 status rollup and emits `invoice.paid` (envelope `id` + `type` + integer `version`, per [infra-events.md](infra-events.html) D-ENV) |
| Correction capture | confirm/reject/reallocate verdicts → `Correction` rows — the cleanest-labeled correction stream in the suite, and the first `Dataset` worth freezing when the fine-tuning loop goes live ([er-platform.md](er-platform.html)) |

**Rollout & honest gates.**

- **Not before** the B1 Spec 2 payment→status rollup exists — a confirmed match must have something correct to write to, and today `status` never transitions.
- Build the rules matcher alone first and measure: if under ~20% of lines are residue, the model layer waits — hand-matching a handful of lines monthly is cheaper than building this.
- The model layer earns its build when residue × volume equals real hours: multiple tenants reconciling, or one tenant crossing ~100 invoices/month.

### B5 · Status — done and left

**Done ✓**
- Full GST invoice editor with shared totals math, CGST/SGST split, included/excluded GST modes, per-item + overall discounts, packing/loading charges.
- Client-side A4 PDF with tenant logo; live HTML preview; localStorage draft persistence.
- Upsert-by-number persistence, client dedupe/create via `findOrCreateClient`, automatic due-payment seeding (the chain's only automated hop).
- SSO middleware, `tool.invoices` flag, DB-down handling.

**Left ◻**
- No order/quotation linkage — `orderId` missing from the model; spec, migration and backfill SQL in B1.
- **Tenancy hole:** `invoice.upsert` bypasses the `tenantDb()` extension — NULL `tenantId` on create, unscoped match on update (A2). Fix before tenant #2.
- `status` never transitions to `partial`/`paid` from payment activity — rollup rule in B1 Spec 2; editor also resets it to `unpaid` on every save.
- Invoice numbering: random 3-digit suffix (silent-overwrite collisions) and 19 chars vs Rule 46's 16-char/consecutive requirement — counter design in B2, format in B3.1.
- Full tenant branding in the PDF (name/address/footer/GSTIN hard-coded despite `getBrand()`); seller GSTIN absent entirely.
- No PATCH route; no list/reload of saved invoices in the UI (editor starts from localStorage, not the DB).
- Action-level permission checks missing (DELETE lacks `act:delete`; client-side export path bypasses `act:export` — B3.5 restores it).
- Deleting an invoice orphans its auto-created `Payment` (transactional-delete rule in B1 Spec 2).
- PDF fonts load from cdnjs at render time — self-host (A5 Recipe 1).
- No `/api/health`; no tests under `apps/invoices`.

**Decisions taken**
- Postgres counter table over Redis for invoice sequences (gapless legal series beats throughput nobody needs).
- Issued invoices are immutable snapshots; corrections are credit notes, not edits.
- Server-side PDF is an async worker with stored, content-addressed artifacts — the browser path stays for interactive use.
- E-invoice (IRN) integration deferred until the ₹5 crore AATO threshold approaches; readiness schema and Rule 46-compliant numbering land first regardless.
