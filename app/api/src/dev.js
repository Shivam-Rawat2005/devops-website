'use strict';

// Local development: serve the website and the API together on http://localhost:3000.
// Works the same on Windows, macOS and Linux (no shell-specific environment syntax).
const path = require('path');

process.env.STATIC_DIR = process.env.STATIC_DIR || path.join(__dirname, '..', '..', 'website');
process.env.APP_ENV = process.env.APP_ENV || 'local';
process.env.PORT = process.env.PORT || '3000';

require('./server');
console.log(`Open http://localhost:${process.env.PORT} in your browser. Press Ctrl+C to stop.`);
