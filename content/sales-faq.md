# Sales: the questions buyers actually ask

Written for whoever sells MapleOne to Indian furniture dealers and interior designers. Every answer below is grounded in an architecture page — the evidence link is part of the answer, not decoration. Where the honest answer is "designed, not built yet", the answer says exactly that, with a **Today / On the roadmap** split. Nothing here is a claim the code can't back.

House rule for the field: never promise a roadmap item as a shipped feature. The buyer who catches one inflated claim discounts every true one.

---

## 1 · Product & fit

### Q1. What does this actually do for my shop, today?

It turns a client conversation into a priced, branded proposal:

- Your sales person adds rooms — Living Room, two Bedrooms, Kitchen — and drops in sofas and wardrobes with sizes and rates.
- Discounts apply at every level: per item, per room, and overall, flat or percent.
- GST splits into CGST/SGST automatically and the grand total updates live.
- One click produces the client-facing PDF with your logo, colours, address and payment details — the document you send on WhatsApp.
- Or skip the file: send a link, and the quote opens in the client's browser — no app, no login on their side.

**Evidence:** [module-quotations.md](module-quotations.html), "For managers" table — quote builder, branded PDF, share links.

### Q2. I run my business on WhatsApp and Excel. Why change?

We don't ask you to leave either. Quotes export to the exact rate-sheet format a team Google Sheet uses, and an existing Excel sheet — photos included — imports back in. The PDF and the share link are built to be sent on WhatsApp; that's the stated delivery path in the product's own user journey. The pitch is not "abandon your tools", it's "stop retyping between them".

**Evidence:** [module-quotations.md](module-quotations.html) — sheet export + Excel import row; the "Send the link or PDF on WhatsApp" journey step.

### Q3. Can it really read my workshop's handwritten rate sheets?

Yes, and this is the feature to demo, not describe. The parser is taught the trade's notation explicitly:

- "85K" means ₹85,000.
- "18K per pc" multiplies by quantity.
- A crossed-out price means take the replacement.
- "Pending" items get flagged, not priced.

It has been verified against real scanned catalogs where every legible rate parsed correctly and every ambiguous one was flagged rather than guessed.

**Evidence:** [ai-layer.md](ai-layer.html) — prompt and schema conventions; [module-quotations.md](module-quotations.html) AI catalog import row.

### Q4. Does it handle the whole flow: quote, order, invoice, delivery, payment?

Honest answer, because this one matters:

- **Today:** each of those modules exists and works on its own screen. Two links in the chain are live: saving an invoice automatically creates the amount-due row in Payments, and quotes, orders, invoices and payments all attach to the same client record.
- **On the roadmap:** the automatic handoffs — quote accepted creates the order, order creates the invoice, delivery challan attaches to the order — are fully designed with state machines and endpoints, but today each handoff is a person re-entering data. The design document says it plainly: the money chain is "only partially linked" and closing it is the product promise, not polish.

Sell the modules that are strong today (quotations, the AI import, photoshoot delivery) and describe the chain as the direction of travel, dated honestly.

**Evidence:** [cross-module.md](cross-module.html) §1 and the closing "punchline for planning"; [module-invoices.md](module-invoices.html) — the auto-seeded payment row.

### Q5. Can it look like MY brand, not yours?

Yes, and this is already in the code, not a promise:

- The tenant record carries your logo, banner, colours, company details and domain.
- Every page and every PDF resolves the brand from the domain that serves it — `tools.yourbrand.com` shows your identity end to end.
- The roadmap's own words: "Their clients never see the word Maple."

**Evidence:** `MAPLEONE-ROADMAP.md` (white-labelling section); [platform-architecture.md](platform-architecture.html) — Tenant row and branding as build step ⑥.

### Q6. My renders and product videos: what do you do with those?

Photoshoot Studio takes a finished product video, stamps your logo bottom-right if watermarking is on, extracts a cover frame, and gives you a private link: your client opens a clean dark player in their browser — autoplay, seek, download — with no login and no file transfer. Uploads show a real progress bar even for large 4K files, and a vendor's download link can be imported directly by URL instead of downloading and re-uploading.

**Evidence:** [module-photoshoot.md](module-photoshoot.html), "For managers" table.

### Q7. Can my staff actually learn this?

The product ships with its own instructions where staff already are: step-by-step guides live inside the app under `/docs`, signed-in staff land straight in the builder, and the builder carries the habits office users expect — keyboard shortcuts for save and PDF, undo/redo with 50 steps of history, and a product library where "the Sheesham 3-seater you quoted last month is one click away." At pilot stage, onboarding is hand-held by us (Q13).

**Evidence:** [module-quotations.md](module-quotations.html) — public landing + in-app docs row, builder shortcuts; `MAPLEONE-ROADMAP.md` Phase 2.

---

## 2 · Data & trust

### Q8. What happens to my data if we part ways?

The strongest answer in the deck, so learn it well:

- On the starting deployment shape you get **one instance per customer** — your data sits in your own database, not in rows mixed with anyone else's.
- It's **standard PostgreSQL**, and the operations plan already includes routine `pg_dump` exports — the same tool hands you a complete, open-format copy of everything: quotes, clients, products, settings. Product images are stored inside the database itself, so the dump is self-contained.
- No proprietary lock-in format exists anywhere in the stack.

**Evidence:** `MAPLEONE-ROADMAP.md` — "their data in their own database"; [aws-deployment.md](aws-deployment.html) §2 (one database per module) and §6 (monthly pg_dump to S3).

### Q9. Can your other customers see my data?

On instance-per-customer: no shared deployment, no shared database — the isolation argument is structural, not a policy. That posture is explicitly chosen as the starting shape because it is the "highest isolation, zero multi-tenant risk" option. When a shared multi-tenant shape ever arrives, it comes with its own scoping layer that already exists in the code.

**Evidence:** [aws-deployment.md](aws-deployment.html) §4 Phase 3 white-label options; `MAPLEONE-ROADMAP.md` Phase A/B.

### Q10. What if the AI reads a rate wrong?

It is designed so a wrong rate cannot silently reach a quote. Three layers:

1. **The AI never guesses.** An ambiguous rate comes back marked pending with low confidence instead of an invented number — that behaviour is a written convention in the system prompt and was verified against real scans.
2. **A human always reviews.** Every AI import lands on a review screen first — the explicit trust boundary. Anything the AI wasn't sure about is flagged amber and must be edited or removed before it can enter the quote. The manager guide's own escalation rule: "if items ever appear unreviewed, stop and call engineering."
3. **The server recomputes the money.** On every save, all totals are recalculated server-side and the client's number is ignored — a mismatch is rejected loudly, never stored silently.

**Evidence:** [ai-layer.md](ai-layer.html) — "Never guess" convention and the review-screen trust boundary; [module-quotations.md](module-quotations.html) — "Signs it's working".

### Q11. Where does my data physically live? Does the AI send my catalogs abroad?

Split the answer; don't blur it.

- **Storage:** the deployment plan puts the database and files in AWS Mumbai (ap-south-1) — genuinely India-resident, with daily automated backups.
- **AI parsing, today:** the scanned PDF is sent to Anthropic's API for parsing, which is not an India-resident service. The internal guidance is explicit about what sales may say: data *stored* in Mumbai — never "AI inference never leaves India."
- **On the roadmap:** a central AI gateway with PII masking before anything leaves our boundary, an AWS-internal model option, and eventually our own model on a Mumbai GPU — which the research notes is "the strongest residency story we will ever be able to tell."

**Evidence:** [infra-aws-services.md](infra-aws-services.html) §4.2 (D8, the permitted claim) and §1.6; [aws-deployment.md](aws-deployment.html) §5.

### Q12. What if YOU lose my data?

The backup posture, in full:

- Automated daily database backups with 7–30 day retention, plus file versioning, plus a monthly full dump to separate storage.
- A **quarterly restore drill** is mandated — the plan's own words: "an untested backup is a rumour."
- On the go-live deployment shape, nothing precious lives on the application server at all — if the box dies, a new one is running in about 30 minutes with zero data loss.

**Evidence:** [aws-deployment.md](aws-deployment.html) §6 (maintenance table) and §4 Phase 2 ("Why this shape").

---

## 3 · Pricing & commercials

### Q13. What does it cost?

The working hypothesis — and call it that, it hasn't met the market yet — is a setup fee plus a monthly subscription in the ₹1,500–4,000/month range per business, led by the Quotations module. AI generation features (photoshoot/Lens) are priced as credits per generation on top, so heavy AI users pay for their usage. Final rate card is set at pilot stage.

**Evidence:** `MAPLEONE-ROADMAP.md` — revenue shape ("₹1,500–4,000/mo instinct range", "credits per generation").

### Q14. Why is there a setup fee?

Because onboarding is real work today: your branding, domain, users and settings are configured hand-held by us — the roadmap openly lists a self-serve onboarding wizard as *still to build*. The fee prices the labour honestly instead of hiding it in the subscription.

**Evidence:** `MAPLEONE-ROADMAP.md` — "Still to build for white-label v1" (billing, onboarding wizard); Phase 2 "hand-held onboarding".

### Q15. Do the AI catalog imports cost extra?

Cost transparency you can share: a parsed catalog page costs roughly ₹8–10 in model fees at current volumes. Whether that's bundled into the plan or metered is a commercial decision per plan, but the underlying number is known, logged, and small next to the hours of retyping it replaces — the roadmap's own framing is that catalog parsing "killed hours of retyping."

**Evidence:** [ai-layer.md](ai-layer.html) — cost observed row; [infra-aws-services.md](infra-aws-services.html) §1.7 (the per-page token math); `MAPLEONE-ROADMAP.md`.

### Q16. Do I pay for modules I don't use?

No — plans map to feature flags per tenant. Selling you a module is literally flipping a flag on your instance, and the upsell ladder works the same way: "you liked Quotations — invoices and orders plug in", no new install.

**Evidence:** [platform-architecture.md](platform-architecture.html) step ⑥ ("selling a module = flipping a flag"); `MAPLEONE-ROADMAP.md` revenue shape.

---

## 4 · Delivery & support

### Q17. Internet goes down at the shop. What happens to my work?

Honest answer: this is a hosted web application — there is no offline mode, and saving to the system, AI imports and share links all need a connection. What you don't lose is the quote you were typing:

- The builder autosaves your working quote to the browser's local storage roughly every second.
- Drafts live in a drafts tab and survive a browser restart.
- When the connection returns, you save to the system as normal.

Don't oversell this as offline support; sell it as "you won't lose the hour of work."

**Evidence:** [module-quotations.md](module-quotations.html) — autosave (800 ms debounce to localStorage, drafts, quota-safe retry); state lives in "Postgres, localStorage, and the URL".

### Q18. Who answers when something breaks?

At pilot stage, the founder does — that's written in the plan, not a dodge ("founder-does-support"). Before you hear about a problem from your client, we usually hear about it from a machine: every public domain has an uptime monitor wired to a phone alarm, plus infrastructure alarms on CPU, disk, database storage and error spikes. The plan's own reasoning: "you want to know before the client calls."

**Evidence:** `MAPLEONE-ROADMAP.md` Phase 2; [aws-deployment.md](aws-deployment.html) §2 row 8 and §6 monitoring row.

### Q19. How fast are you back up after a failure?

On the go-live architecture: the application server holds nothing precious — database, files, secrets and app images all live in managed services. Server dies → new server → redeploy → "back in ~30 minutes with zero data loss." That number is the design target of the deployment shape, not a marketing figure.

**Evidence:** [aws-deployment.md](aws-deployment.html) §4 Phase 2.

### Q20. What do you need from me to go live?

Little, and it's a checklist that already exists: your branding details (logo, colours, address, GSTIN), your domain (or a subdomain we provide), and your staff list to seed user accounts. The go-live step in the rollout plan is exactly that: "their branding row, their domains, seeded users, uptime monitoring on their domains." Before any external customer goes live, the plan gates on a passed restore drill and the closed security checklist.

**Evidence:** [aws-deployment.md](aws-deployment.html) §7 rollout order, steps 2–3; [team-tasks.md](team-tasks.html) blockers rule.

---

## 5 · Competition & the hard objections

### Q21. "You're a three-person company. Why would I bet my shop's paperwork on you?"

Don't duck it — answer with structure:

- **The product is run on itself daily.** Maple Furnishers, a real furniture business, is customer zero and uses the quotation tool as its daily workflow — the team hits the bugs before you do.
- **The infrastructure is deliberately boring.** The stated first principle is "fewest moving parts", with the precious parts (database, files, backups) handed to AWS-managed services and the app servers treated as disposable. Small team, small failure surface — by design, not accident.
- **The team is three focused lanes** — AI infrastructure, DevOps/lead, fullstack — with a written task board and a rule that nothing goes in front of an external user until every item on the security blocker registry is closed.
- **And your exit is cheap** (Q8): your own database, open format, full export. The cost of being wrong about us is low, which is exactly what a small vendor owes you.

**Evidence:** `MAPLEONE-ROADMAP.md` (ongoing pilot); [aws-deployment.md](aws-deployment.html) §1 principles; [team-tasks.md](team-tasks.html) — three lanes and the blockers registry rule.

### Q22. "My accountant lives in Tally."

Good — the plan is built around that fact, not against it. The designed integration is a one-way file export: one click produces a month's vouchers as a Tally XML file the accountant imports through *Gateway of Tally → Import Data → Vouchers* — the format Tally natively accepts. The design decision on record: file export only, no live bridge, because "the accountant's Tally is not a server we can reach."

**Today / roadmap split, stated plainly:** the Tally XML export is designed in detail but not built. The finance module today is a simple income/expense ledger, and a CSV export is specified as the stopgap accountants can use first. If the buyer's accountant is the decision-maker, this is a roadmap commitment, not a live feature.

**Evidence:** [module-finance.md](module-finance.html) — B3.2 Tally export, D4 decision, and the CSV stopgap.

### Q23. "Is this actually GST-compliant?"

The honest current state, module by module:

- **Quotation GST math works today**: rate on top or baked in, CGST/SGST split, verified by unit tests.
- **The invoice module has real gaps, and we say so**: the seller's own GSTIN doesn't print on the PDF yet; there's no IGST path for interstate supply (the math only knows CGST/SGST); and invoice numbers are currently random rather than the consecutive, 16-character-max series Rule 46(b) requires.
- **The fixes are designed, not hand-waved**: counter-based sequential numbering per tenant per financial year, seller GSTIN on the tenant record, an IGST computation keyed off place of supply, and researched e-invoice (IRN/QR) readiness — noting that IRN registration only becomes mandatory at ₹5 crore turnover, which most target buyers are under.

Position it as: the quote-to-PDF flow is solid today; treat the invoice module as functional billing that is being brought to strict GST form, with the gap list public.

**Evidence:** [module-invoices.md](module-invoices.html) — verified gotchas, B3.1 GST e-invoice readiness table, Rule 46(b) analysis; [module-quotations.md](module-quotations.html) GST handling.

### Q24. "Why not just use a generic billing or CRM app?"

Two grounded points, no adjectives:

1. **Vertical fit.** This market runs on WhatsApp, Excel and handwritten rate sheets — the roadmap's thesis is that no vertical SaaS serves these businesses in their language of work: rooms, square-foot rates, per-piece pricing, festival discounts, the WhatsApp proposal.
2. **The handwriting parser is a live differentiator, not a slide.** A generic tool doesn't read "18K per pc" off a scanned workshop sheet and flag what it can't read. Ours does, in production, today.

**Evidence:** `MAPLEONE-ROADMAP.md` — "Why this can be big"; [ai-layer.md](ai-layer.html).

---

## 6 · Objection-handling cheat sheet

One line per objection. The Depth column is where to send yourself (or a technical buyer) for the full answer.

| Objection | One-line response | Today or roadmap? | Depth |
|---|---|---|---|
| "What do you actually do?" | Client conversation → priced, branded PDF or link, sent on WhatsApp | Today | [module-quotations.md](module-quotations.html) |
| "We use WhatsApp + Excel" | We export to your sheet format and import it back, photos included | Today | [module-quotations.md](module-quotations.html) |
| "Handwritten rate sheets?" | Reads "85K", "per pc", crossed-out corrections; flags what it can't read | Today — demo it | [ai-layer.md](ai-layer.html) |
| "End-to-end quote→payment flow?" | Modules work; automatic handoffs are designed, not built — each hop is manual today | Roadmap (say so) | [cross-module.md](cross-module.html) |
| "Your brand or mine?" | Your logo, colours, domain on every page and PDF; clients never see Maple | Today | [platform-architecture.md](platform-architecture.html) |
| "Can my staff learn it?" | In-app step-by-step docs, keyboard shortcuts, one-click product library; hand-held onboarding at pilot | Today | [module-quotations.md](module-quotations.html) |
| "Data if we part ways?" | Your own database, standard Postgres, full pg_dump export | Today | [aws-deployment.md](aws-deployment.html) |
| "Other customers see my data?" | One instance per customer — separation is structural | Today (Phase A) | [aws-deployment.md](aws-deployment.html) §4 |
| "AI reads a rate wrong?" | It flags instead of guessing, a human review screen gates every import, and the server recomputes all totals | Today | [ai-layer.md](ai-layer.html) |
| "Data leaves India?" | Storage in Mumbai; AI parsing goes to Anthropic today — never claim otherwise | Split (be precise) | [infra-aws-services.md](infra-aws-services.html) §4.2 |
| "What if you lose it?" | Daily backups + monthly dump + quarterly restore drill; box death = ~30 min recovery, zero data loss | Today (Phase 2 shape) | [aws-deployment.md](aws-deployment.html) §6 |
| "Price?" | Setup fee + ₹1,500–4,000/mo hypothesis; AI generations as credits | Hypothesis (say so) | `MAPLEONE-ROADMAP.md` |
| "Internet down at the shop?" | No offline mode — but the quote you're typing autosaves locally and isn't lost | Today (limits stated) | [module-quotations.md](module-quotations.html) |
| "Who supports us?" | Founder-does-support at pilot; uptime alarms ring us before your client calls | Today | [aws-deployment.md](aws-deployment.html) §6 |
| "Three-person company" | Boring managed infra, daily dogfooding, cheap exit for you, security blockers gate launch | Today | [team-tasks.md](team-tasks.html) |
| "Accountant uses Tally" | Designed one-way Tally XML voucher export; CSV stopgap first — not built yet | Roadmap (say so) | [module-finance.md](module-finance.html) |
| "GST compliant?" | Quote math yes; invoice numbering/GSTIN/IGST gaps are known, listed, and designed for fix | Split (gap list is public) | [module-invoices.md](module-invoices.html) |
| "Why not a generic app?" | Vertical language of work + a handwriting parser that exists in production | Today | `MAPLEONE-ROADMAP.md` |

*Related docs: [module-quotations.md](module-quotations.html) · [module-photoshoot.md](module-photoshoot.html) · [module-invoices.md](module-invoices.html) · [module-finance.md](module-finance.html) · [cross-module.md](cross-module.html) · [aws-deployment.md](aws-deployment.html) · [ai-layer.md](ai-layer.html) · [investor-brief.md](investor-brief.html) (the same honesty, pointed at investors).*
