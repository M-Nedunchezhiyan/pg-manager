// Re-export the singleton from @pg/db. Centralised here so route handlers
// can `import { prisma } from '@/server/common/prisma'` without crossing the
// package boundary directly.

export { prisma } from '@pg/db';
