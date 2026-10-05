export const LOAD_TEST_CONFIG = {
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:8080/api/v1',
  userCount: 10,
  userPrefix: 'instant_login',
  concurrency: 10,
  timeoutMs: 10000,
};
