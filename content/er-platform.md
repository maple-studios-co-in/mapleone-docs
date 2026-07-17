# Platform & AI layer — ER diagram (proposed)

**Status: proposed — none of these tables exist yet.** The application data models live in [er-suite.md](er-suite.html) (22 models) and [module-quotations.md](module-quotations.html) (9 models). This diagram covers the *platform* tables the AWS plan (`aws-deployment.md`) implies: selling the suite to customers (plans, subscriptions, per-module flags) and running the AI layer (the `maple-ai` gateway's usage log, model registry, and fine-tuning loop). `Tenant` is the only entity here that already exists — everything hangs off it.

Design notes:
- **Billing** stays deliberately thin (a `Subscription` row per tenant, module entitlements as rows, payments recorded on receipt) — Razorpay webhooks can fill it later without schema change.
- **AiRequest** is the gateway's append-only spend log: every call, who made it, which model served it, **which prompt version ran**, tokens and ₹. It is the evidence base for the "own models yet?" decision and for per-tenant AI billing. `promptVersion` matters for the fine-tuning loop: a `Correction` is only a usable training/eval example if you know the exact prompt + model that produced the output being corrected, and eval regressions must be attributable to prompt changes vs model changes.
- **The fine-tuning loop** is four tables: corrections captured from review screens → versioned `Dataset` → `TrainingRun` → `EvalRun` against the regression set; a `ModelVersion` only becomes routable when its eval beats the incumbent. `ModelRoute` is the gateway's switchboard: use-case → model version, per tenant when needed.

```mermaid
erDiagram
    Tenant ||--o{ Subscription : "pays via"
    Plan ||--o{ Subscription : "priced by"
    Subscription ||--o{ ModuleEntitlement : "unlocks"
    Subscription ||--o{ PaymentRecord : "settled by"
    Tenant ||--o{ AiRequest : "spends"
    Tenant ||--o{ AiBudget : "capped by"
    AiModel ||--o{ ModelVersion : "versioned as"
    ModelVersion ||--o{ AiRequest : "served"
    ModelVersion ||--o{ ModelRoute : "routed via"
    Dataset ||--o{ TrainingRun : "trains"
    TrainingRun ||--o| ModelVersion : "produces"
    ModelVersion ||--o{ EvalRun : "scored by"
    Tenant ||--o{ Correction : "labels"
    AiRequest ||--o| Correction : "corrected by"
    Correction }o--o| Dataset : "compiled into"

    Tenant {
        string id PK
        string name
        string domain UK
        string brandName "exists today - full branding cols"
    }
    Plan {
        string id PK
        string name "starter / suite / enterprise"
        int priceMonthlyInr
        string billingPeriod
    }
    Subscription {
        string id PK
        string tenantId FK
        string planId FK
        string status "trial|active|past_due|cancelled"
        datetime startsAt
        datetime endsAt
    }
    ModuleEntitlement {
        string id PK
        string subscriptionId FK
        string module "quotations|photoshoot|orders|..."
        boolean enabled "mirrored into Flipt flags"
    }
    PaymentRecord {
        string id PK
        string subscriptionId FK
        int amountInr
        string gatewayRef "razorpay id"
        datetime paidAt
    }
    AiRequest {
        string id PK
        string tenantId FK
        string module "quotations|photoshoot"
        string useCase "catalog-parse|photo-locate|generate"
        string modelVersionId FK
        string promptVersion "e.g. catalog-parse-v3"
        int inputTokens
        int outputTokens
        int costPaise
        string status "ok|refused|error|fallback"
        datetime createdAt
    }
    AiBudget {
        string id PK
        string tenantId FK
        int monthlyCapPaise
        int alertAtPercent
    }
    AiModel {
        string id PK
        string provider "anthropic|openai|bedrock|self"
        string family "claude-fable-5|qwen-vl|..."
    }
    ModelVersion {
        string id PK
        string aiModelId FK
        string version "api-2026-06 or ft-checkpoint"
        string endpoint "api|bedrock-arn|sagemaker-endpoint"
        boolean routable "true only after eval win"
    }
    ModelRoute {
        string id PK
        string useCase "catalog-parse|generate|..."
        string modelVersionId FK
        string tenantId FK "null = default route"
        int priority "fallback order"
    }
    Correction {
        string id PK
        string tenantId FK
        string module
        string useCase
        string aiRequestId FK "ties the fix to model + promptVersion"
        json modelOutput "what the AI said"
        json humanFixed "what the reviewer corrected"
        datetime createdAt
    }
    Dataset {
        string id PK
        string useCase
        string s3Uri "versioned snapshot"
        int exampleCount
        datetime frozenAt
    }
    TrainingRun {
        string id PK
        string datasetId FK
        string baseModel "which foundation model"
        string method "lora|full-ft"
        string status "running|done|failed"
        string artifactS3Uri
    }
    EvalRun {
        string id PK
        string modelVersionId FK
        string regressionSet "real catalogs with known answers"
        float score
        float incumbentScore
        boolean beatIncumbent
        datetime ranAt
    }
```

**Where these live:** `Subscription`/`Plan`/entitlements belong in the suite DB (admin app manages them). The AI tables belong to the **gateway's own database** — same module-owns-its-tables rule as everything else. `Correction` rows are written by module review screens through a gateway endpoint, so modules never touch the AI schema directly.
