'use strict';

const os = require('os');
const path = require('path');
const express = require('express');

const QUOTES = [
  { text: 'If it hurts, do it more often, and bring the pain forward.', author: 'Jez Humble' },
  { text: 'Automate the boring parts, then automate the rest.', author: 'DevOps proverb' },
  { text: 'Treat servers like cattle, not pets.', author: 'Bill Baker' },
  { text: 'Everything fails, all the time.', author: 'Werner Vogels' },
  { text: 'Infrastructure is code. Review it like code.', author: 'DevOps proverb' },
  { text: 'You build it, you run it.', author: 'Werner Vogels' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Checks the contact form and returns a map of field -> error message (empty when valid).
function validateContact(body) {
  const errors = {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (name.length < 2) errors.name = 'Enter your name (at least 2 characters).';
  else if (name.length > 80) errors.name = 'Name must be 80 characters or fewer.';

  if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address, like name@example.com.';
  else if (email.length > 120) errors.email = 'Email must be 120 characters or fewer.';

  if (message.length < 10) errors.message = 'Write a message of at least 10 characters.';
  else if (message.length > 2000) errors.message = 'Message must be 2000 characters or fewer.';

  return { errors, clean: { name, email, message } };
}

// Allows `limit` requests per `windowMs` per key. Memory only, which is fine for one small site.
function createRateLimiter({ limit, windowMs, now }) {
  const hits = new Map();
  return function isLimited(key) {
    const t = now();
    const recent = (hits.get(key) || []).filter((ts) => t - ts < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return true;
    }
    recent.push(t);
    hits.set(key, recent);
    return false;
  };
}

function createApp(options = {}) {
  const env = options.env || process.env;
  const now = options.now || (() => Date.now());
  const log = options.log || ((entry) => console.log(JSON.stringify(entry)));
  const startedAt = now();

  const info = {
    commit: env.GIT_SHA || 'local',
    build_time: env.BUILD_TIME || null,
    environment: env.APP_ENV || 'development',
    version: env.APP_VERSION || '1.0.0',
  };

  const app = express();
  app.disable('x-powered-by');
  // Requests arrive through Nginx (and the AWS load balancer), so trust their X-Forwarded-For.
  app.set('trust proxy', 'loopback, uniquelocal');
  app.use(express.json({ limit: '10kb' }));

  const contactLimited = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000, now });

  const api = express.Router();

  api.get('/health', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({
      status: 'ok',
      server: os.hostname(),
      uptime_s: Math.floor((now() - startedAt) / 1000),
      timestamp: new Date(now()).toISOString(),
    });
  });

  api.get('/version', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(info);
  });

  api.get('/quote', (req, res) => {
    const exclude = Number.parseInt(req.query.exclude, 10);
    let choices = QUOTES.map((q, i) => ({ ...q, id: i }));
    if (Number.isInteger(exclude)) choices = choices.filter((q) => q.id !== exclude);
    res.set('Cache-Control', 'no-store');
    res.json(choices[Math.floor(Math.random() * choices.length)]);
  });

  api.post('/contact', (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};

    // Hidden "website" field: people never fill it in, simple spam bots do.
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      return res.status(200).json({ ok: true });
    }
    if (contactLimited(req.ip)) {
      return res.status(429).json({ ok: false, error: 'Too many messages. Try again in 10 minutes.' });
    }

    const { errors, clean } = validateContact(body);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ ok: false, errors });
    }

    // No database: messages go to the container log (read them with `docker compose logs api`).
    log({ type: 'contact_message', received_at: new Date(now()).toISOString(), ...clean });
    return res.status(201).json({ ok: true, message: `Thanks, ${clean.name}. Your message was received.` });
  });

  app.use('/api', api);

  // Local development only: serve the website from the same process (Nginx does this in Docker).
  if (options.staticDir) {
    app.use(express.static(path.resolve(options.staticDir), { extensions: ['html'] }));
  }

  app.use('/api', (req, res) => res.status(404).json({ ok: false, error: `No API route for ${req.method} ${req.path}` }));

  // Malformed JSON and oversized bodies end up here.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) log({ type: 'error', message: err.message });
    res.status(status).json({ ok: false, error: status === 413 ? 'Request is too large.' : status < 500 ? 'Request body is not valid JSON.' : 'Something went wrong on the server.' });
  });

  return app;
}

module.exports = { createApp, validateContact, createRateLimiter, QUOTES };
