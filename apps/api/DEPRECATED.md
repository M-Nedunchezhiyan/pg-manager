# Deprecated — apps/api

This NestJS API has been replaced by Next.js Route Handlers under
`apps/web/src/app/api/`. The migration is documented in `/MIGRATION.md`.

**Why kept around:** the service-class business logic in `src/modules/*/service.ts`
is the reference implementation for ports to the new Route Handlers. Each method
has been (or will be) copied to `apps/web/src/server/services/*` with minor adjustments:
NestJS DI → plain function imports; `@nestjs/common` exceptions → `HttpError` class.

**Safe to delete:** once every controller's logic is ported to the web app and verified
in production, this whole directory can be removed in one commit.

**Don't deploy this anywhere.** The auth model (custom Argon2 + JWT) is no longer the
source of truth — Supabase Auth is.
