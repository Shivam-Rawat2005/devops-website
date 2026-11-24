#!/usr/bin/env node
// Writes app/website/deployments.json from the latest commits on the current branch.
// GitHub Actions runs this before building the website image:
//   - uses: actions/checkout@v4
//     with: { fetch-depth: 10 }
//   - run: node scripts/generate-deployments.js
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const COUNT = Number.parseInt(process.argv[2], 10) || 8;
const OUT = path.join(__dirname, '..', 'app', 'website', 'deployments.json');
const FIELD = '\x1f';
const RECORD = '\x1e';

const raw = execFileSync('git', ['log', `-n${COUNT}`, '--first-parent', `--pretty=format:%H${FIELD}%s${FIELD}%an${FIELD}%cI${RECORD}`], { encoding: 'utf8' });

const deployments = raw
  .split(RECORD)
  .map((r) => r.trim())
  .filter(Boolean)
  .map((r) => {
    const [commit, message, author, date] = r.split(FIELD);
    return { commit: commit.slice(0, 7), message, author, date };
  });

fs.writeFileSync(OUT, `${JSON.stringify(deployments, null, 2)}\n`);
console.log(`Wrote ${deployments.length} entries to ${path.relative(process.cwd(), OUT)}`);
