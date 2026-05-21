# Security policy

## Supported versions

Only `main` is supported. Patches are released against `main`.

## Reporting a vulnerability

Email security disclosures privately. **Do not** open public GitHub issues for security bugs.

We aim to acknowledge within 72 hours and ship a fix or mitigation within 14 days for high/critical issues.

## Threat model (summary)

| Asset | Threat | Mitigation |
|---|---|---|
| Admin credentials | Brute force, credential stuffing | Argon2id, rate limit (`AUTH_THROTTLE_LIMIT`), account lockout |
| Session tokens | Theft via XSS | httpOnly + Secure + SameSite=strict cookies; strict CSP; no `dangerouslySetInnerHTML` |
| Session tokens | CSRF | SameSite=strict + CSRF token on state-changing requests |
| Resident PII (phone, ID) | Database compromise | AES-256-GCM at rest with `PII_ENCRYPTION_KEY`; HMAC for searchable lookup |
| Audit trail | Tampering | `audit_logs` append-only; row deletes not exposed via API |
| Cross-PG data leak | Manager accessing another PG | `PGScopeGuard` enforces `UserPGScope` on every PG-scoped route |
| SQL injection | Untrusted input in queries | Prisma parameterized queries only; no raw SQL |
| XSS | Untrusted HTML rendered | React escapes by default; strict CSP forbids inline scripts; user input never `dangerouslySetInnerHTML` |
| Container escape | Malicious dep or image | Non-root user, `no-new-privileges`, minimal capabilities, Trivy scans |
| Secret leak | Accidental commit | `.gitignore` + gitleaks in CI + `.env.example` only |
| Supply chain | Compromised dep | Pinned versions, frozen lockfile, weekly Dependabot, daily `pnpm audit` |

## CVE policy

- **Critical / High** in production dependencies → block PR merges via CI.
- **Moderate** → tracked via Dependabot weekly digest; resolved within 30 days.
- **Low** → reviewed quarterly.
- All CVEs are surfaced via the `Security` workflow (daily cron) so newly-disclosed issues against pinned versions are caught even without code changes.

## Headers shipped

API + web both ship: `Content-Security-Policy`, `Strict-Transport-Security` (prod), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` (camera/mic/geo off).

## Secrets management

- `.env` is gitignored. Only `.env.example` is in the repo, with placeholder `change_me_*` values that gitleaks ignores.
- In production, inject secrets via Docker secrets, Vault, or your orchestrator's secret store. Never bake them into images.
- Rotate `JWT_*_SECRET` and `PII_ENCRYPTION_KEY` requires a key-rotation procedure (TODO: document in `docs/key-rotation.md` when ops needs it).

## What's NOT in scope for v1

- Multi-region failover
- Customer-managed encryption keys (BYOK)
- Formal SOC2 / ISO27001 — controls are aligned but no audit
- Penetration test — recommended before going live with real residents
