const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../src/app');

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    // Listen on an ephemeral port for testing
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('GET / should return 200 and welcome payload', async () => {
  const res = await fetch(`${baseUrl}/`);
  const data = await res.json();

  assert.equal(res.status, 200);
  assert.equal(data.status, 'online');
  assert.equal(data.message, 'Welcome to Knotnex API');
});

test('GET /api/health should return 200 with health metrics and mock dependencies', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  const data = await res.json();

  assert.equal(res.status, 200);
  assert.equal(data.status, 'ok');
  assert.equal(data.service, 'knotnex-backend');
  assert.ok(data.uptime);
  assert.ok(data.timestamp);
  assert.ok(data.dependencies.database);
  assert.equal(data.dependencies.database.status, 'healthy (mocked)');
});

test('GET /health (alias) should return 200 OK', async () => {
  const res = await fetch(`${baseUrl}/health`);
  const data = await res.json();

  assert.equal(res.status, 200);
  assert.equal(data.status, 'ok');
});

test('GET /api/health/mock should return 200 with mock testing data', async () => {
  const res = await fetch(`${baseUrl}/api/health/mock`);
  const data = await res.json();

  assert.equal(res.status, 200);
  assert.equal(data.status, 'ok');
  assert.equal(data.mockData.simulation, 'healthy');
});

test('GET /api/health/mock?status=down should simulate a 503 degraded/down state', async () => {
  const res = await fetch(`${baseUrl}/api/health/mock?status=down`);
  const data = await res.json();

  assert.equal(res.status, 503);
  assert.equal(data.status, 'error');
  assert.equal(data.dependencies.database.status, 'down (mocked)');
});

test('GET /api/health/mock?status=degraded should simulate a degraded state', async () => {
  const res = await fetch(`${baseUrl}/api/health/mock?status=degraded`);
  const data = await res.json();

  assert.equal(res.status, 200);
  assert.equal(data.status, 'degraded');
});

test('GET /non-existing-route should return 404', async () => {
  const res = await fetch(`${baseUrl}/non-existing-route`);
  const data = await res.json();

  assert.equal(res.status, 404);
  assert.equal(data.success, false);
});
