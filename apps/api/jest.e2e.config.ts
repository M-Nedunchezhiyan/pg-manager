import type { Config } from 'jest';

/**
 * E2E config — requires a live Postgres + Redis (use `pnpm docker:up`).
 * Set TEST_DATABASE_URL to override DATABASE_URL during the run.
 */
const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/test'],
  testTimeout: 30_000,
  setupFiles: ['<rootDir>/test/jest.env.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  testRegex: '.*\\.e2e-spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
};

export default config;
