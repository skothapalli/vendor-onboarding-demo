import { prisma } from '../src/infrastructure/database/prisma';

beforeAll(async () => {
  // Setup test environment
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.ENCRYPTION_KEY = '32-byte-encryption-key-test-only';
});

afterAll(async () => {
  await prisma.$disconnect();
});

// Clean database between tests
beforeEach(async () => {
  // Clear tables in correct order (respecting foreign keys)
  const tablenames = await prisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

  const tables = tablenames
    .map(({ tablename }) => tablename)
    .filter((name) => name !== '_prisma_migrations')
    .map((name) => `"public"."${name}"`)
    .join(', ');

  if (tables.length > 0) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
    } catch {
      // Ignore errors during truncate
    }
  }
});
