'use strict';

/**
 * Jest config for Abonasi backend
 *
 * Run:
 *   cd backend
 *   npx jest
 *
 * Optional:
 *   NODE_ENV=test
 *   dotenv can be loaded via `node -r dotenv/config ...` if you use .env.test
 */
module.exports = {
  testEnvironment: 'node',
  verbose: true,
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 60_000,
  // make stack traces easier
  restoreMocks: true,
  clearMocks: true
};
