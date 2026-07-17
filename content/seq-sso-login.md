# Cross-subdomain SSO login

Traced from `apps/quotations/middleware.ts`, `apps/admin/app/login/page.tsx`, `apps/admin/app/api/auth/login/route.ts`, and `packages/core/src/lib/{sso.ts,session.ts,auth.ts,permissions.ts}`. The shared login UI and credential endpoint live in the **admin** app (every other app's middleware defaults `LOGIN_URL` to `https://admin.maplefurnishers.com/login`); there is no login route in `apps/users`. SSO is stateless: one `mt_session` JWT (jose, HS256, 7-day expiry) signed with the shared `AUTH_SECRET` and set on the parent domain (`COOKIE_DOMAIN`, e.g. `.maplefurnishers.com`), so any subdomain's middleware can verify it locally with `verifySession()` — no callback to the identity app.

```mermaid
sequenceDiagram
    participant B as Browser
    participant C as Caddy
    participant Q as quotations app (middleware.ts)
    participant A as admin app (login page + /api/auth/login)
    participant S as "@maple/core session.ts / sso.ts"
    participant P as Postgres

    B->>C: GET https://quotations.maplefurnishers.com/some/page
    C->>Q: reverse_proxy quotations:3000
    Q->>S: verifySession(mt_session cookie)
    S-->>Q: null (no cookie / bad JWT)
    Q-->>B: 302 LOGIN_URL?next=https://quotations.maplefurnishers.com/some/page
    B->>C: GET https://admin.maplefurnishers.com/login?next=...
    C->>A: reverse_proxy admin:3000
    A-->>B: login page (app/login/page.tsx)
    B->>A: POST /api/auth/login {email, password}
    A->>P: prisma.user.findFirst({email, tenantId}) via currentTenant()
    P-->>A: user row
    A->>A: verifyPassword(bcrypt) + permsForRole(role, tenantId)
    alt invalid credentials or inactive user
        A-->>B: 401 {error: "Invalid email or password"}
    else valid credentials
        A->>S: signSession(user) — jose SignJWT HS256, AUTH_SECRET, 7d
        S-->>A: JWT
        A-->>B: 200 {ok} + Set-Cookie mt_session (domain=COOKIE_DOMAIN, httpOnly, lax)
        B->>S: safeNext(?next param, "/") in login page
        alt next is http(s) URL on SSO_DOMAIN suffix (or relative path)
            S-->>B: validated URL
            B->>C: window.location.assign(next) — back to quotations subdomain
        else next fails validation (foreign host / malformed)
            S-->>B: fallback "/"
            B->>A: router.push("/") — stays on admin app
        end
        C->>Q: GET /some/page (mt_session sent — parent-domain cookie)
        Q->>S: verifySession(token) with shared AUTH_SECRET
        S-->>Q: SessionUser {id, role, perms, tenantId}
        Q->>Q: canAccessTool(perms, "quotations", role)
        Q-->>B: 200 page
    end
```
