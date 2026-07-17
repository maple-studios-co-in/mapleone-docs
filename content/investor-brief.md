# Investor questions, strategist answers

Format: a skeptical seed investor asks, the strategist answers. Every number in an answer comes from an architecture page and is linked; where the docs don't carry a number, the answer says "we don't have that number" instead of inventing one. Pricing figures are hypotheses and labelled as such. All ₹ infra figures are July 2026 estimates at ₹87/$ plus 18% GST, per the assumptions in [infra-aws-services.md](infra-aws-services.html).

---

## 1 · Market & wedge

### Q1. What's your market size?

**Strategist:** We don't have a defensible TAM number and won't pretend to. What we have is a qualitative thesis with a live proof point: the Indian furniture/interiors/modular-kitchen trade runs on WhatsApp, Excel, and handwritten rate sheets — we know because we run one (Maple Furnishers) and those are our own rate sheets the parser was built on. No vertical SaaS serves these businesses in their language of work. The measurable base today: 200–500 AI-parsed catalog pages per month of real usage, one business, growing toward a projected 2–5k pages/month with a white-label fleet.

**Evidence:** `MAPLEONE-ROADMAP.md` "Why this can be big"; [infra-aws-services.md](infra-aws-services.html) scale reference.

### Q2. Why is a quotation tool the wedge and not, say, inventory?

**Strategist:** Because we picked the two most painful moments in the trade and both already work: the money document (a priced, branded quotation to the client) and the marketing image (making a workshop product look sellable). Everything else in the suite is the upsell ladder behind those two — sold by flipping a per-tenant feature flag, not a new install. Inventory, HR, CRM exist as modules but they are not the reason anyone signs.

**Evidence:** `MAPLEONE-ROADMAP.md` — "Our two wedges"; [platform-architecture.md](platform-architecture.html) step ⑥.

### Q3. Who's the first customer and what does that prove?

**Strategist:** Customer zero is our own furniture business — the sales team uses the quotation builder as its daily workflow, which is the ongoing pilot. First named external target is Maple Enterprise, with the go-live infrastructure shape already specified. Distribution for the first ten is relationship sales — our suppliers, fellow dealers in Kirti Nagar, interior designers we already work with — not paid acquisition. That proves willingness-to-use; it does not yet prove willingness-to-pay. The 2–3 pilot white-label customers in Phase 2 are the willingness-to-pay test.

**Evidence:** `MAPLEONE-ROADMAP.md` Phases 1–2; [aws-deployment.md](aws-deployment.html) §4 Phase 2, §7.

---

## 2 · Moat

### Q4. A frontier-model API call is not a moat. What stops anyone from copying the parser?

**Strategist:** The prompt isn't the moat; the corrections dataset is. Every catalog parse a human corrects on the review screen is a labeled training pair — (page image, corrected JSON) — produced as a by-product of normal work. The pipeline is designed end to end: corrections captured → dataset versioned on S3 → LoRA fine-tune → eval harness against a regression set of real scanned catalogs with known answers → only models that beat the incumbent get routed. Every AI output is stamped with its exact prompt and model version, so the dataset is attributable, which is what makes it trainable. AWS's own published pipeline for exactly this shape of problem — multipage document to JSON — reports a fine-tuned 3B model competing with far larger ones. A copycat can rent the same model; they cannot rent two years of a furniture trade's corrected handwriting.

**Evidence:** [aws-deployment.md](aws-deployment.html) §5 Step C ("the real moat"); [ai-layer.md](ai-layer.html) — promptVersion stamping; [infra-aws-services.md](infra-aws-services.html) §2.3 (the SWIFT doc-to-JSON precedent).

### Q5. Is that moat accruing today, or is it a diagram?

**Strategist:** Diagram, mostly — and I'd rather tell you that than have you find it. The review screens exist and are used daily; the *capture* of corrections into a dataset is item 3 on the AI-infra lane, sequenced right after the gateway v1. Until that lands, corrections are applied and discarded. The cost to close the gap is small: gateway v1 is estimated at about a week because it's mostly extraction of code already proven in production, and a full fine-tune cycle costs under ₹5k on spot instances — cheap enough that experiments are pre-approved even at bootstrapped posture. The gate on shipping any model is the eval harness, not budget.

**Evidence:** [team-tasks.md](team-tasks.html) Lane 1; [platform-architecture.md](platform-architecture.html) ("v1 ≈ a week"); [infra-aws-services.md](infra-aws-services.html) §2.7 and decision D4.

### Q6. Any moat beyond the dataset?

**Strategist:** Two, both structural. First, white-label depth: tenant branding, domain resolution and per-tenant login are product IP already in the code — the research explicitly rejected managed auth (Cognito) because "white-label *is* the product." Second, the residency option: our own fine-tuned model on a Mumbai GPU is, per the research's own words, "the strongest residency story we will ever be able to tell" to Indian enterprise buyers — and it's only reachable through the dataset in Q4. The moats compound or they don't exist.

**Evidence:** [infra-aws-services.md](infra-aws-services.html) §3.11 and §4.2.

---

## 3 · Unit economics

### Q7. What does it cost you to serve one customer?

**Strategist:** Depends on phase, and the phase plan is written down. Today: one box, ₹2–4k/month total. Go-live shape (Phase 2): apps on one box, data in managed services — ₹8–15k/month all-in, *shared across every customer on it*. True microservices (Phase 3): roughly ₹4–8k per always-on service per month, which is why that phase is triggered by a paying fleet, not enthusiasm. On top: AI at ₹8–10 per parsed catalog page, metered per tenant once the gateway's spend log is live. The variable cost per additional early customer on the shared Phase 2 box is close to zero infrastructure and nonzero founder support time — support is the real unit cost at pilot scale.

**Evidence:** [aws-deployment.md](aws-deployment.html) §4 (all three phase costs); [ai-layer.md](ai-layer.html) cost row.

### Q8. Show me the margin math on ten customers.

**Strategist:** Illustrative, assumptions labelled — the price is a hypothesis (₹1,500–4,000/month "instinct range" from the roadmap, untested), and support cost is an estimate, not a doc number:

| Line | Assumption | ₹/month |
|---|---|---|
| Revenue: 10 customers × ₹2,500 avg | midpoint of the ₹1,500–4,000 hypothesis | **+25,000** |
| Shared infra (Phase 2 box + managed deps) | [aws-deployment.md](aws-deployment.html) §4, one shared stack | −8,000 to −15,000 |
| AI pass-through: 10 × ~100 pages × ₹8–10 | page volume assumed, per-page cost from [ai-layer.md](ai-layer.html) | −8,000 to −10,000 |
| Monitoring/email misc (UptimeRobot Solo, SES) | ~$9/mo + ₹45 ([infra-observability.md](infra-observability.html) §6, [infra-aws-services.md](infra-aws-services.html) §3.9) | −1,000 |
| **Infra-level margin** | before any salaries or support time | **≈ ₹0 to +8,000** |

Read it honestly: at ten customers and midpoint pricing, infrastructure roughly breaks even and the business is paying for nothing else. The model only works if (a) AI cost is passed through as credits with margin — which is the roadmap's stated design for generation features, (b) setup fees price the hand-held onboarding, and (c) pricing lands nearer the top of the range for multi-module plans via the flag ladder. If pilot pricing proves out below ~₹2,000/month, this is a lifestyle tool, not a company — that's the number the first three pilots must establish.

**Evidence:** `MAPLEONE-ROADMAP.md` revenue shape; [aws-deployment.md](aws-deployment.html) §4; [ai-layer.md](ai-layer.html).

### Q9. When do you own GPUs, and why not now?

**Strategist:** The trigger is arithmetic, not ambition, and it's logged. A 24×7 GPU box runs ₹50k–1.5L/month (₹30–45k on spot/savings plans); at today's 200–500 pages/month the API bill is ₹4–5k, so APIs win by a mile. The crossover analysis: at 5,000 pages/month a scale-to-zero managed endpoint costs ₹8–15k against ₹40–50k of API fees — that's the switch point, and the gateway's per-tenant spend log is exactly the evidence that fires it. The stated rule: first fine-tune cycle when the spend log shows sustained ₹15–20k+/month on parsing. Trying costs under ₹5k; owning before the math says so costs ₹30k+/month of pure waste.

**Evidence:** [aws-deployment.md](aws-deployment.html) §5 Step C ("honest economics"); [infra-aws-services.md](infra-aws-services.html) §2.8 three-way serving table.

---

## 4 · Execution & team risk

### Q10. Three people. Can you actually ship this?

**Strategist:** The plan is sized for three, explicitly. The task board runs three lanes — AI infra, DevOps/lead, fullstack — sequenced Now/Next/Later with a weekly sync cadence. The infrastructure principles are written to keep the ops surface inside three people's capacity: "boring infrastructure", "no Kubernetes until a human being is hired to run it", managed AWS for everything precious, disposable containers for everything else, and a rule against skipping phases until the current one hurts. The honest maintenance budget in the plan is measured in single hours per month per concern. What three people cannot do is ship the full 16-module vision fast — which is why the wedge strategy (Q2) exists.

**Evidence:** [team-tasks.md](team-tasks.html); [aws-deployment.md](aws-deployment.html) §1 and §6.

### Q11. What's the key-person risk?

**Strategist:** High, and the docs don't hide it: the bootstrapped cost posture is literally defined as "one box, founder-run", and Phase 2 support is "founder-does-support". Mitigants that exist today are documentation-shaped, and unusually deep for this stage: per-module engineering bibles, a deployment runbook, a written learning path, and the task board itself — the bus-factor asset is that a competent hire can be pointed at the docs. Mitigant that doesn't exist yet: the hire. Part of the raise (Q17) is converting single-founder-dependency into a staffed three-lane team.

**Evidence:** [infra-aws-services.md](infra-aws-services.html) (bootstrapped posture definition); `MAPLEONE-ROADMAP.md` Phase 2; [team-tasks.md](team-tasks.html).

### Q12. What's in the security debt ledger?

**Strategist:** Eleven numbered blockers, B1–B11, consolidated in one registry, with the governing rule stated in bold at the top: "nothing goes in front of an external user until every B is closed." The list includes a roles-API privilege escalation, mass-assignment on five modules' PATCH routes, cross-tenant overwrite via an unscoped upsert on globally-unique document numbers, seeded passwords in prod, and invoice numbering that both collides silently and violates GST Rule 46(b). Two things to note: first, we found these ourselves, in our own audits, and wrote them down with file paths; second, the fixes are the fullstack lane's "Now" queue, ordered by severity, with the fix pattern for the worst one already existing in another module. Debt you can enumerate is a work queue; debt you can't is a breach.

**Evidence:** [team-tasks.md](team-tasks.html) blockers registry; [cross-module.md](cross-module.html) §2.4; [module-invoices.md](module-invoices.html) B10.

---

## 5 · Technical risk

### Q13. Your pitch is an integrated suite. Is the integration real?

**Strategist:** Today, mostly no — and the architecture bible says so in its own punchline: "cross-module integration is the suite's *pitch* but currently its *thinnest layer*. Identity and tenancy are solid, Client-as-hub half-works, the money chain is mostly manual, and events are a table nobody writes to... the fold-in and the event machine aren't polish, they're the product promise." The verified specifics: Order→Invoice has no schema link at all, Lead→Client conversion doesn't exist, and there is zero event-driven integration. What derisks it: the target design is fully specified — state machines, convert endpoints, a transactional outbox with an ordered build list where the cheap links come first — and the strong layers (single sign-on, tenancy, the AI import) are verified working. We're selling the two wedges today and building the chain in the open.

**Evidence:** [cross-module.md](cross-module.html) — §1 findings table, §10, and the punchline.

### Q14. Multi-tenancy — one bad query away from a data leak?

**Strategist:** The scoping layer exists and covers the common operations, but its edges are documented precisely: upserts bypass tenant scoping entirely (blocker B8, with a verified cross-tenant overwrite path), and by-id operations require a per-route guard discipline. Two answers to the risk. Structural: the launch posture is instance-per-customer — separate databases — so the multi-tenant edges aren't load-bearing for the first fleet at all. Procedural: the edges are named blockers with named fixes (per-tenant unique constraints, scoped find-then-write), gated before external users. The standalone quotations repo already ships the fixed pattern; the suite copies inherit it at fold-in.

**Evidence:** [cross-module.md](cross-module.html) §2.4; [team-tasks.md](team-tasks.html) B8; [aws-deployment.md](aws-deployment.html) §4 Phase 3.

### Q15. What's the riskiest single piece of engineering ahead?

**Strategist:** The fold-in — merging the hardened standalone modules back into the suite — and within it the Product-model merge, which the integration bible flags as "the fold-in's riskiest item": the product catalog exists twice with zero shared truth, one side frozen by contract until the merge. Sequencing discipline is the mitigation on record: fold-in waits until the security fixes and package publishing land, "or it inherits the debt."

**Evidence:** [cross-module.md](cross-module.html) §3.2 and §10; [team-tasks.md](team-tasks.html) dependencies note.

---

## 6 · Exit paths & the kill question

### Q16. What does an acquirer actually buy here?

**Strategist:** No exit thesis is written in these docs, so I'll answer with the assets they document instead of a story. Three things would survive diligence: (1) the corrections dataset and its eval harness — attributable, versioned, regression-tested training data for a niche no one else has instrumented (Q4); (2) the white-label machinery — tenant model, per-domain branding, per-plan flags — which is the generic asset for anyone selling vertical SaaS into Indian SMBs beyond furniture; (3) the module contract — every module ships, deploys and scales identically, so the platform generalizes. Plausible acquirer classes follow from the assets — vertical-SaaS consolidators, accounting-software players moving up from Tally-adjacent work — but that's inference, not a plan. At seed, the honest exit answer is: build the dataset and the fleet; optionality follows the assets.

**Evidence:** [ai-layer.md](ai-layer.html); [platform-architecture.md](platform-architecture.html); [aws-deployment.md](aws-deployment.html) §3.

### Q17. What does the next ₹25L buy?

**Strategist:** Roughly a year of runway at the documented cost posture, allocated against the written plan rather than a new one:

| Allocation | What it buys | Grounding |
|---|---|---|
| Infra ≈ ₹1–2L/yr | Phase 2 go-live shape (₹8–15k/mo) + monitoring | [aws-deployment.md](aws-deployment.html) §4 |
| AI ≈ ₹0.5–1L/yr | Parse volume at ₹8–10/page + fine-tune cycles at <₹5k each + the ~₹1k base-model eval spike | [ai-layer.md](ai-layer.html); [infra-aws-services.md](infra-aws-services.html) §2.6–2.7 |
| People ≈ the rest | Staffing the three lanes: B1–B11 closed, gateway v1 + corrections capture live, fold-in executed, 2–3 paying white-label pilots onboarded | [team-tasks.md](team-tasks.html); `MAPLEONE-ROADMAP.md` Phase 2 |

The milestones the money must hit: security registry closed (launch gate), corrections dataset accruing (moat gate), and pilot pricing validated against the ₹1,500–4,000 hypothesis (business gate). Miss the third and the spend on the first two was premature — which is why pilots are sequenced inside the same tranche, not after it.

### Q18. What would kill this?

**Strategist:** Four things, in probability order:

1. **Pricing falsifies the hypothesis.** If furniture dealers won't pay ~₹2,000+/month, the Q8 table shows infra-plus-support eats the margin. Cheapest to test, so we test it first.
2. **Founder unavailability before the team exists.** Q11 — the docs mitigate knowledge loss, not labour loss.
3. **Shipping the security debt.** A cross-tenant data incident at a white-label client would end trust in a product whose whole pitch is "your data, your brand." The B-registry launch gate exists precisely because this is fatal, not embarrassing.
4. **The integration promise staying a diagram.** If the money chain and the corrections loop are still unwired in 18 months, we're selling a nice quotation tool at a suite's valuation — the punchline in Q13 is the standing warning, and the ordered build list in [cross-module.md](cross-module.html) §10 is the countermeasure.

What doesn't kill us, per the research: AI unit costs (paise-level, passed through), GPU capex (triggered, not assumed), and infrastructure scale (the phase plan defers every expensive decision until a revenue trigger fires).

**Evidence:** [team-tasks.md](team-tasks.html); [cross-module.md](cross-module.html) §10; [infra-aws-services.md](infra-aws-services.html) §5.

---

*Related docs: [sales-faq.md](sales-faq.html) (the same honesty, pointed at buyers) · [aws-deployment.md](aws-deployment.html) · [infra-aws-services.md](infra-aws-services.html) · [ai-layer.md](ai-layer.html) · [cross-module.md](cross-module.html) · [team-tasks.md](team-tasks.html) · [platform-architecture.md](platform-architecture.html) · `MAPLEONE-ROADMAP.md` (repo root — market thesis, pricing hypothesis, phase plan).*
