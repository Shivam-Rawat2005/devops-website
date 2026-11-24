'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp, validateContact, createRateLimiter, QUOTES } = require('../src/app');

let server;
let base;
const logged = [];

before(async () => {
  const app = createApp({
    env: { GIT_SHA: 'abc1234', BUILD_TIME: '2026-10-29T08:00:00Z', APP_ENV: 'test', APP_VERSION: '1.2.3' },
    log: (entry) => logged.push(entry),
  });
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

const post = (path, body, raw) =>
  fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw ?? JSON.stringify(body) });

describe('GET /api/health', () => {
  test('returns ok with server name and uptime', async () => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(typeof body.server, 'string');
    assert.ok(Number.isInteger(body.uptime_s) && body.uptime_s >= 0);
    assert.ok(!Number.isNaN(Date.parse(body.timestamp)));
  });
});

describe('GET /api/version', () => {
  test('returns build information from environment variables', async () => {
    const body = await (await fetch(`${base}/api/version`)).json();
    assert.deepEqual(body, { commit: 'abc1234', build_time: '2026-10-29T08:00:00Z', environment: 'test', version: '1.2.3' });
  });

  test('falls back to local defaults when variables are missing', async () => {
    const app = createApp({ env: {} });
    const s = await new Promise((r) => { const x = app.listen(0, '127.0.0.1', () => r(x)); });
    const body = await (await fetch(`http://127.0.0.1:${s.address().port}/api/version`)).json();
    s.close();
    assert.equal(body.commit, 'local');
    assert.equal(body.environment, 'development');
  });
});

describe('GET /api/quote', () => {
  test('returns a quote with text, author and id', async () => {
    const body = await (await fetch(`${base}/api/quote`)).json();
    assert.equal(typeof body.text, 'string');
    assert.equal(typeof body.author, 'string');
    assert.ok(body.id >= 0 && body.id < QUOTES.length);
  });

  test('never returns the excluded quote', async () => {
    for (let i = 0; i < 25; i++) {
      const body = await (await fetch(`${base}/api/quote?exclude=2`)).json();
      assert.notEqual(body.id, 2);
    }
  });
});

describe('POST /api/contact', () => {
  test('accepts a valid message and logs it', async () => {
    const res = await post('/api/contact', { name: 'Riya', email: 'riya@example.com', message: 'Loved the pipeline demo!' });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.match(body.message, /Riya/);
    assert.ok(logged.some((e) => e.type === 'contact_message' && e.email === 'riya@example.com'));
  });

  test('rejects invalid fields with a message per field', async () => {
    const res = await post('/api/contact', { name: 'R', email: 'not-an-email', message: 'hi' });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.deepEqual(Object.keys(body.errors).sort(), ['email', 'message', 'name']);
  });

  test('quietly ignores spam that fills the hidden field', async () => {
    const before = logged.length;
    const res = await post('/api/contact', { name: 'Bot', email: 'bot@spam.io', message: 'Buy cheap things now', website: 'http://spam.io' });
    assert.equal(res.status, 200);
    assert.equal(logged.length, before);
  });

  test('returns 400 for malformed JSON', async () => {
    const res = await post('/api/contact', null, '{"name": ');
    assert.equal(res.status, 400);
    assert.equal((await res.json()).ok, false);
  });

  test('returns 413 for oversized bodies', async () => {
    const res = await post('/api/contact', { name: 'Big', email: 'big@example.com', message: 'x'.repeat(20000) });
    assert.equal(res.status, 413);
  });
});

describe('unknown routes', () => {
  test('return JSON 404', async () => {
    const res = await fetch(`${base}/api/nope`);
    assert.equal(res.status, 404);
    assert.equal((await res.json()).ok, false);
  });
});

describe('helpers', () => {
  test('validateContact trims input', () => {
    const { errors, clean } = validateContact({ name: '  Asha  ', email: ' asha@example.com ', message: '  Hello there, nice site  ' });
    assert.deepEqual(errors, {});
    assert.equal(clean.name, 'Asha');
  });

  test('rate limiter blocks after the limit and resets after the window', () => {
    let t = 0;
    const limited = createRateLimiter({ limit: 2, windowMs: 1000, now: () => t });
    assert.equal(limited('ip'), false);
    assert.equal(limited('ip'), false);
    assert.equal(limited('ip'), true);
    assert.equal(limited('other-ip'), false);
    t = 1500;
    assert.equal(limited('ip'), false);
  });
});
