/** Root ESLint — security-focused. Per-package configs extend this. */
module.exports = {
  root: true,
  env: { node: true, es2022: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['@typescript-eslint', 'security', 'no-unsanitized', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:security/recommended-legacy',
    'plugin:no-unsanitized/recommended-legacy',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  rules: {
    // Hard bans — these are footguns.
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-floating-promises': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'security/detect-object-injection': 'off', // too noisy; we use Prisma + Zod
    'security/detect-non-literal-fs-filename': 'warn',
    'security/detect-child-process': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-unsafe-regex': 'error',
    'no-unsanitized/method': 'error',
    'no-unsanitized/property': 'error',
    'import/order': [
      'warn',
      { 'newlines-between': 'always', alphabetize: { order: 'asc' } },
    ],
  },
  ignorePatterns: ['dist', '.next', 'node_modules', '.turbo', 'coverage', '*.config.js', '*.config.cjs'],
};
