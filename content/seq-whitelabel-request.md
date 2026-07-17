# White-label request resolution

Traced from `maple-suite/Caddyfile`, `packages/core/src/lib/{brand.ts,tenant.ts,tenant-db.ts}`, and the standalone app's `maple-quotations/middleware.ts`, `src/lib/brand.ts`, `app/layout.tsx`, `app/pdf-catalog.tsx`. Branding is resolved per request host: `getBrand()` reads the `Host` header itself (it takes no argument), reduces it to the registrable domain, and looks up `Tenant` by `domain` with a 60s in-process cache — falling back to the `slug: "maple"` tenant, then the first tenant row, then a hardcoded default. Note the committed `Caddyfile` only declares `*.maplefurnishers.com` site blocks, so serving `tools.customerbrand.com` additionally requires adding a site block (the app side is already host-agnostic).

```mermaid
sequenceDiagram
    participant B as Browser
    participant C as Caddy (Caddyfile)
    participant M as quotations middleware.ts
    participant S as "@maple/core session.ts"
    participant BR as brand.ts (getBrand / currentTenant)
    participant TD as tenant-db.ts (tenantDb)
    participant P as Postgres

    B->>C: GET https://tools.customerbrand.com/ (site block required per domain)
    C->>M: reverse_proxy quotations:3000 (Host header preserved)
    M->>S: verifySession(mt_session cookie)
    alt no valid session
        M-->>B: page routes: 302 to login with ?next= — API routes: 401 json
    else session valid + canAccessTool("quotations")
        M-->>M: NextResponse.next() — request reaches app/layout.tsx
        M->>BR: getBrand() — reads Host header, registrable("tools.customerbrand.com") = "customerbrand.com"
        alt brand cached under 60s TTL
            BR-->>M: cached Brand
        else cache miss
            BR->>P: tenant.findFirst({domain: "customerbrand.com"})
            alt tenant row matches domain
                P-->>BR: tenant row
            else no domain match
                BR->>P: currentTenant() fallback — slug "maple", then first tenant, then hardcoded default
                P-->>BR: fallback tenant (or none)
            end
            BR-->>M: Brand {name, logoUrl, primaryColor, address, gstin, ...}
        end
        M->>TD: tenantDb() for data routes
        TD->>S: getTenantId() — session tenantId, else currentTenant() by host
        TD-->>TD: Prisma $extends — findMany/findFirst/count/updateMany/deleteMany filtered by tenantId, create stamps it
        TD->>P: tenant-scoped queries only
        P-->>TD: rows for this tenant
        TD-->>B: branded page (SuiteShell gets brand) or proposal PDF (MasterProposalPdf uses PdfBrand: logo, accent color, address)
    end
```
