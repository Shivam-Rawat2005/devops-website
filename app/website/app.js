'use strict';

/* ---------- Small helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) node.append(c);
  return node;
}

async function api(path, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(path, { ...options, signal: ctrl.signal, headers: { Accept: 'application/json', ...(options.headers || {}) } });
    let body = null;
    try { body = await res.json(); } catch (e) { /* non-JSON response */ }
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- Theme ---------- */
function currentTheme() {
  const set = document.documentElement.dataset.theme;
  if (set) return set;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function updateThemeButton() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  $('#theme-btn').setAttribute('aria-label', `Switch to ${next} theme`);
}
$('#theme-btn').addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (e) { /* storage blocked */ }
  updateThemeButton();
});
updateThemeButton();

/* ---------- Mobile menu ---------- */
const nav = $('#site-nav');
const menuBtn = $('#menu-btn');
function setMenu(open) {
  nav.classList.toggle('open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}
menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
$$('a', nav).forEach((a) => a.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

// Highlight the nav link for the section on screen.
const sections = $$('main section[id]');
const navObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    $$('a', nav).forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${entry.target.id}`));
  });
}, { rootMargin: '-45% 0px -50% 0px' });
sections.forEach((s) => navObserver.observe(s));

/* ---------- Hero terminal ---------- */
const TERM_LINES = [
  ['cmd', 'git commit -m "Add new project"'],
  ['out', '[main 7d2e4b9] Add new project'],
  ['cmd', 'git push origin main'],
  ['out', 'GitHub Actions: deploy.yml started'],
  ['out', '  ✓ tests passed (12)'],
  ['out', '  ✓ docker images built and pushed'],
  ['out', '  ✓ terraform: infrastructure up to date'],
  ['out', '  ✓ ansible: web-1 updated, web-2 updated'],
  ['ok', '✓ live at https://shivam.dev'],
];
let termRun = 0;
async function playTerminal() {
  const run = ++termRun;
  const term = $('#hero-term');
  const prompt = '<span class="p">$</span> ';
  if (reduceMotion) {
    term.innerHTML = TERM_LINES.map(([kind, text]) => (kind === 'cmd' ? prompt + text : `<span class="${kind === 'ok' ? 'g' : 'c'}">${text}</span>`)).join('\n');
    return;
  }
  let html = '';
  term.innerHTML = '';
  for (const [kind, text] of TERM_LINES) {
    if (run !== termRun) return;
    if (kind === 'cmd') {
      for (let i = 1; i <= text.length; i++) {
        if (run !== termRun) return;
        term.innerHTML = `${html}${prompt}${text.slice(0, i)}<span class="cursor">&nbsp;</span>`;
        await sleep(32);
      }
      html += `${prompt}${text}\n`;
      await sleep(350);
    } else {
      html += `<span class="${kind === 'ok' ? 'g' : 'c'}">${text}</span>\n`;
      term.innerHTML = html;
      await sleep(kind === 'ok' ? 0 : 420);
    }
  }
  if (run === termRun) term.innerHTML = `${html}${prompt}<span class="cursor">&nbsp;</span>`;
}
$('#replay-btn').addEventListener('click', playTerminal);
playTerminal();

/* ---------- Live status ---------- */
const status = { uptimeBase: null, fetchedAt: 0 };

function formatUptime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

function formatBuildTime(iso) {
  if (!iso) return 'Build time unknown';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Build time unknown';
  return `Built ${d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`;
}

function setDots(state) {
  $('#st-dot').dataset.state = state;
  $('#header-pill .dot').dataset.state = state;
}

async function checkStatus() {
  const btn = $('#check-btn');
  btn.disabled = true;
  setDots('checking');
  $('#st-status').textContent = 'Checking…';
  try {
    const [health, version] = await Promise.all([api('/api/health'), api('/api/version')]);
    if (!health.ok || !health.body || health.body.status !== 'ok') throw new Error('unhealthy');

    setDots('ok');
    $('#st-status').textContent = 'Online';
    $('#st-server').textContent = health.body.server;
    status.uptimeBase = health.body.uptime_s;
    status.fetchedAt = Date.now();
    $('#st-uptime').textContent = formatUptime(status.uptimeBase);

    if (version.ok && version.body) {
      const v = version.body;
      status.commit = v.commit;
      markLiveDeploy();
      $('#st-commit').textContent = v.commit;
      $('#st-build').textContent = formatBuildTime(v.build_time);
      $('#st-env').textContent = v.environment;
      $('#foot-version').textContent = `version ${v.commit}`;
      $('#header-pill-text').textContent = `${v.environment} · ${v.commit}`;
    }
    $$('.tile').forEach((t) => { t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash'); });
  } catch (e) {
    setDots('down');
    $('#st-status').textContent = 'Offline';
    $('#header-pill-text').textContent = 'API offline';
    status.uptimeBase = null;
    $('#st-uptime').textContent = '–';
  } finally {
    btn.disabled = false;
    $('#st-checked').textContent = `Last checked at ${new Date().toLocaleTimeString()}`;
  }
}

setInterval(() => {
  if (status.uptimeBase === null) return;
  $('#st-uptime').textContent = formatUptime(status.uptimeBase + (Date.now() - status.fetchedAt) / 1000);
}, 1000);
$('#check-btn').addEventListener('click', checkStatus);
checkStatus();
setInterval(() => { if (!document.hidden) checkStatus(); }, 30000);

/* ---------- Projects ---------- */
const PROJECTS = [
  {
    title: 'This website',
    featured: true,
    summary: 'A portfolio site that deploys itself: every push to GitHub is tested, packaged and released to AWS.',
    tags: ['terraform', 'ansible', 'docker', 'github-actions', 'nginx'],
    problem: 'Deploying by hand was slow, and every deploy was a little different.',
    built: ['Website and Node.js API packaged as Docker images', 'AWS servers and load balancer written in Terraform', 'Ansible roles for hardening, HTTPS and deployment', 'GitHub Actions pipeline with a manual approval for production'],
    result: 'A push to main reaches the live site in a few minutes, with zero downtime.',
  },
  {
    title: 'Server hardening playbook',
    summary: 'Ansible roles that turn a fresh Ubuntu server into a locked-down Docker host.',
    tags: ['ansible'],
    problem: 'New servers started with root login and open ports.',
    built: ['Disable root and password SSH login', 'UFW firewall with only ports 22, 80 and 443', 'fail2ban and automatic security updates', 'Roles tested in containers with Molecule'],
    result: 'Any new server is secured the same way in under five minutes.',
  },
  {
    title: 'AWS infrastructure modules',
    summary: 'Reusable Terraform modules for EC2, security groups and an application load balancer.',
    tags: ['terraform'],
    problem: 'Infrastructure was created in the console and could not be rebuilt.',
    built: ['Modules for network, EC2 and load balancer', 'Remote state in S3 with locking', 'Separate dev and prod variable files', 'terraform plan posted on every pull request'],
    result: 'The whole environment can be destroyed and rebuilt from code.',
  },
  {
    title: 'Dockerized to-do app',
    summary: 'A JavaScript to-do app served by Nginx inside a small Alpine image.',
    tags: ['docker', 'nginx'],
    problem: 'The app behaved differently on each machine.',
    built: ['Multi-stage Dockerfile under 30 MB', 'Nginx config with caching and security headers', 'Health check built into the image'],
    result: 'Runs the same on a laptop and on a server with one command.',
  },
  {
    title: 'CI pipeline for Node.js',
    summary: 'A GitHub Actions workflow that lints, tests and builds an image on every pull request.',
    tags: ['github-actions', 'docker'],
    problem: 'Broken code was reaching the main branch.',
    built: ['Lint and unit tests on every pull request', 'Docker image built and tagged with the commit ID', 'Branch protection requires a green build'],
    result: 'Failing changes are caught before they are merged.',
  },
];
const TAG_NAMES = { terraform: 'Terraform', ansible: 'Ansible', docker: 'Docker', 'github-actions': 'GitHub Actions', nginx: 'Nginx' };

let activeFilter = 'all';
function renderProjects() {
  const list = $('#project-list');
  const shown = PROJECTS.filter((p) => activeFilter === 'all' || p.tags.includes(activeFilter));
  list.replaceChildren(...shown.map((p) => el('button', {
    class: `project fade-in${p.featured ? ' featured' : ''}`,
    type: 'button',
    'aria-haspopup': 'dialog',
    onclick: () => openProject(p),
  }, [
    el('h3', { text: p.title }),
    el('p', { text: p.summary }),
    el('div', { class: 'tags' }, p.tags.map((t) => el('span', { class: 'tag', text: TAG_NAMES[t] }))),
    el('span', { class: 'more', text: 'View details →' }),
  ])));
  const label = activeFilter === 'all' ? '' : ` using ${TAG_NAMES[activeFilter]}`;
  $('#project-count').textContent = `Showing ${shown.length} of ${PROJECTS.length} projects${label}.`;
}
$$('#filters .chip').forEach((chip) => chip.addEventListener('click', () => {
  activeFilter = chip.dataset.filter;
  $$('#filters .chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
  renderProjects();
}));

const dialog = $('#project-dialog');
function openProject(p) {
  $('#dlg-title').textContent = p.title;
  $('#dlg-body').replaceChildren(
    el('div', { class: 'tags' }, p.tags.map((t) => el('span', { class: 'tag', text: TAG_NAMES[t] }))),
    el('h4', { text: 'Problem' }), el('p', { text: p.problem }),
    el('h4', { text: 'What I built' }), el('ul', {}, p.built.map((b) => el('li', { text: b }))),
    el('h4', { text: 'Result' }), el('p', { text: p.result }),
  );
  dialog.showModal();
}
dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
renderProjects();

/* ---------- Pipeline explorer ---------- */
const STAGES = [
  {
    title: 'Push code', tool: 'Git and GitHub',
    text: 'A developer commits a change and pushes it to the main branch. This is the only manual step; GitHub starts the pipeline automatically.',
    file: '.github/workflows/deploy.yml',
    code: 'on:\n  push:\n    branches: [main]',
  },
  {
    title: 'Test', tool: 'GitHub Actions',
    text: 'The API tests run, and the Ansible and Terraform code is checked. If anything fails, the pipeline stops and nothing reaches the servers.',
    file: '.github/workflows/deploy.yml',
    code: '- run: npm ci && npm test\n  working-directory: app/api\n- run: ansible-lint ansible/\n- run: terraform validate',
  },
  {
    title: 'Build images', tool: 'Docker',
    text: 'The website and API are packaged as Docker images tagged with the commit ID, then pushed to the GitHub container registry. The same image runs in dev and prod.',
    file: 'app/website/Dockerfile',
    code: 'docker build -t ghcr.io/shivam-rawat2005/site:$GITHUB_SHA app/website\ndocker push ghcr.io/shivam-rawat2005/site:$GITHUB_SHA',
  },
  {
    title: 'Infrastructure', tool: 'Terraform',
    text: 'Terraform compares the AWS servers, firewall rules and load balancer with the code. It creates or changes only what is different, so most runs change nothing.',
    file: 'terraform/main.tf',
    code: 'resource "aws_instance" "web" {\n  count         = 2\n  ami           = var.ubuntu_ami\n  instance_type = "t3.micro"\n}',
  },
  {
    title: 'Deploy', tool: 'Ansible',
    text: 'Ansible updates one server at a time: it takes the server out of the load balancer, pulls the new image, restarts the containers and checks health before moving on.',
    file: 'ansible/deploy.yml',
    code: '- hosts: web\n  serial: 1\n  roles:\n    - deploy',
  },
  {
    title: 'Live', tool: 'Health check',
    text: 'The pipeline calls /api/version on the live site and confirms it reports the new commit. The version shown in this page’s footer comes from the same endpoint.',
    file: '.github/workflows/deploy.yml',
    code: 'curl -fsS https://shivam.dev/api/version \\\n  | grep "$GITHUB_SHA"',
  },
];

let stageIndex = 0;
let playTimer = null;

function renderStageList() {
  $('#stages').replaceChildren(...STAGES.map((s, i) => el('li', {}, el('button', {
    class: 'stage-btn',
    type: 'button',
    role: 'tab',
    id: `stage-tab-${i}`,
    'aria-controls': 'stage-detail',
    onclick: () => { stopPlay(); selectStage(i); },
  }, [
    el('span', { class: 'n', text: String(i + 1) }),
    el('span', {}, [el('span', { class: 't', text: s.title }), el('span', { class: 'tool', text: s.tool })]),
  ]))));
}

function selectStage(i, focus = false) {
  stageIndex = (i + STAGES.length) % STAGES.length;
  $$('.stage-btn').forEach((b, j) => {
    b.setAttribute('aria-selected', String(j === stageIndex));
    b.tabIndex = j === stageIndex ? 0 : -1;
    b.classList.toggle('done', j < stageIndex);
  });
  const s = STAGES[stageIndex];
  const detail = $('#stage-detail');
  detail.setAttribute('aria-labelledby', `stage-tab-${stageIndex}`);
  detail.replaceChildren(
    el('div', { class: 'meta' }, [el('span', { class: 'tag', text: `Stage ${stageIndex + 1} of ${STAGES.length}` }), el('span', { class: 'tag', text: s.tool })]),
    el('h3', { text: s.title }),
    el('p', { text: s.text }),
    el('span', { class: 'file', text: s.file }),
    el('pre', {}, el('code', { text: s.code })),
  );
  detail.classList.remove('fade-in'); void detail.offsetWidth; detail.classList.add('fade-in');
  if (focus) $(`#stage-tab-${stageIndex}`).focus();
}

function stopPlay() {
  clearInterval(playTimer);
  playTimer = null;
  $('#play-btn').textContent = 'Play';
}
function startPlay() {
  if (stageIndex === STAGES.length - 1) selectStage(0);
  $('#play-btn').textContent = 'Pause';
  playTimer = setInterval(() => {
    if (stageIndex === STAGES.length - 1) { stopPlay(); return; }
    selectStage(stageIndex + 1);
  }, 2600);
}
$('#play-btn').addEventListener('click', () => (playTimer ? stopPlay() : startPlay()));
$('#prev-btn').addEventListener('click', () => { stopPlay(); selectStage(stageIndex - 1); });
$('#next-btn').addEventListener('click', () => { stopPlay(); selectStage(stageIndex + 1); });
$('#stages').addEventListener('keydown', (e) => {
  const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
  if (e.key in keys) { e.preventDefault(); stopPlay(); selectStage(stageIndex + keys[e.key], true); }
  if (e.key === 'Home') { e.preventDefault(); stopPlay(); selectStage(0, true); }
  if (e.key === 'End') { e.preventDefault(); stopPlay(); selectStage(STAGES.length - 1, true); }
});
renderStageList();
selectStage(0);

/* ---------- Quote ---------- */
const FALLBACK_QUOTE = { text: 'If it hurts, do it more often, and bring the pain forward.', author: 'Jez Humble', id: 0 };
let quoteId = null;
async function loadQuote() {
  const box = $('.quote');
  const btn = $('#quote-btn');
  box.classList.add('loading');
  btn.disabled = true;
  let q = FALLBACK_QUOTE;
  try {
    const res = await api(`/api/quote${quoteId !== null ? `?exclude=${quoteId}` : ''}`);
    if (res.ok && res.body && res.body.text) q = res.body;
  } catch (e) { /* keep fallback */ }
  quoteId = q.id;
  $('#quote-text').textContent = `“${q.text}”`;
  $('#quote-author').textContent = `— ${q.author}`;
  box.classList.remove('loading');
  btn.disabled = false;
}
$('#quote-btn').addEventListener('click', loadQuote);
loadQuote();

/* ---------- Contact form ---------- */
const form = $('#contact-form');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RULES = {
  name: (v) => (v.length < 2 ? 'Enter your name (at least 2 characters).' : ''),
  email: (v) => (!EMAIL_RE.test(v) ? 'Enter a valid email address, like name@example.com.' : ''),
  message: (v) => (v.length < 10 ? 'Write a message of at least 10 characters.' : ''),
};

function setFieldError(name, message) {
  const input = form.elements[name];
  input.closest('.field').classList.toggle('invalid', Boolean(message));
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  $(`#${name}-err`).textContent = message || '';
}
function validateField(name) {
  const msg = RULES[name](form.elements[name].value.trim());
  setFieldError(name, msg);
  return !msg;
}
Object.keys(RULES).forEach((name) => {
  const input = form.elements[name];
  input.addEventListener('blur', () => { if (input.value.trim()) validateField(name); });
  input.addEventListener('input', () => { if (input.closest('.field').classList.contains('invalid')) validateField(name); });
});
form.elements.message.addEventListener('input', (e) => {
  $('#message-count').textContent = `${e.target.value.length} / 2000`;
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const msgEl = $('#form-msg');
  msgEl.className = 'form-msg';
  msgEl.textContent = '';

  const results = Object.keys(RULES).map(validateField);
  if (results.includes(false)) {
    const firstBad = Object.keys(RULES).find((n) => form.elements[n].getAttribute('aria-invalid') === 'true');
    form.elements[firstBad].focus();
    return;
  }

  const btn = $('#send-btn');
  btn.disabled = true;
  btn.textContent = 'Sending…';
  const payload = Object.fromEntries(['name', 'email', 'message', 'website'].map((n) => [n, form.elements[n].value]));
  try {
    const res = await api('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) {
      msgEl.classList.add('ok');
      msgEl.textContent = (res.body && res.body.message) || 'Thanks. Your message was received.';
      form.reset();
      $('#message-count').textContent = '0 / 2000';
    } else if (res.status === 400 && res.body && res.body.errors) {
      Object.entries(res.body.errors).forEach(([name, m]) => setFieldError(name, m));
      msgEl.classList.add('bad');
      msgEl.textContent = 'Please fix the highlighted fields.';
    } else {
      msgEl.classList.add('bad');
      msgEl.textContent = (res.body && res.body.error) || `The server returned an error (${res.status}). Try again in a minute.`;
    }
  } catch (err) {
    msgEl.classList.add('bad');
    msgEl.textContent = 'Could not reach the server. Check your connection and try again.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send message';
  }
});

/* ---------- Architecture map ---------- */
const ARCH = {
  developer: {
    title: 'Developer', links: ['github'],
    text: 'Writes the website, API and infrastructure code on a laptop, tests it locally with docker compose, then pushes to GitHub.',
    when: 'Whenever there is a change to make.', files: ['app/', 'docker-compose.yml'],
  },
  github: {
    title: 'GitHub repository', links: ['developer', 'actions'],
    text: 'One repository holds everything: the website, the API, the Dockerfiles, the Terraform and Ansible code and the pipeline itself. Every change is a commit that can be reviewed and undone.',
    when: 'Always. It is the single source of truth.', files: ['app/', 'terraform/', 'ansible/', '.github/workflows/'],
  },
  actions: {
    title: 'GitHub Actions', links: ['github', 'registry', 'terraform', 'ansible'],
    text: 'The pipeline. It tests the code, builds the Docker images, runs Terraform and then Ansible, and finally checks the live site. Production waits for a manual approval.',
    when: 'On every push to main, and on every pull request (tests only).', files: ['.github/workflows/deploy.yml'],
  },
  registry: {
    title: 'Container registry', links: ['actions', 'web1', 'web2'],
    text: 'GitHub Container Registry stores each version of the website and API images, tagged with the commit ID. Servers pull from here, and a rollback just means pulling an older tag.',
    when: 'Images are pushed by the pipeline and pulled during deploys.', files: ['app/website/Dockerfile', 'app/api/Dockerfile'],
  },
  terraform: {
    title: 'Terraform', links: ['actions', 'lb', 'web1', 'web2'],
    text: 'Creates the AWS resources from code: the two EC2 servers, firewall rules, the load balancer and its HTTPS listener. Its state is kept in S3 so every run knows what already exists.',
    when: 'Every pipeline run. It only changes what differs from the code.', files: ['terraform/main.tf', 'terraform/variables.tf', 'terraform/envs/'],
  },
  ansible: {
    title: 'Ansible', links: ['actions', 'web1', 'web2'],
    text: 'Connects to each server over SSH. It hardens the server, installs Docker, then deploys the new images one server at a time so the site stays online.',
    when: 'Every deploy, after Terraform.', files: ['ansible/site.yml', 'ansible/roles/', 'ansible/inventories/'],
  },
  lb: {
    title: 'Load balancer', links: ['visitors', 'web1', 'web2', 'terraform'],
    text: 'An AWS Application Load Balancer receives every visitor request over HTTPS and sends it to a healthy server. If a server fails its health check, traffic goes to the other one.',
    when: 'Always on. Checks each server every few seconds.', files: ['terraform/modules/lb/'],
  },
  web1: {
    title: 'web-1 (EC2 server)', links: ['lb', 'ansible', 'registry', 'terraform'],
    text: 'An Ubuntu server running two containers: Nginx with the website, and the Node.js API. Nginx serves the pages and passes /api/ requests to the API.',
    when: 'Always on. Updated first during a deploy.', files: ['app/website/nginx.conf', 'docker-compose.yml'],
  },
  web2: {
    title: 'web-2 (EC2 server)', links: ['lb', 'ansible', 'registry', 'terraform'],
    text: 'An identical copy of web-1. Having two servers means one can be updated, or can fail, while the other keeps the site online.',
    when: 'Always on. Updated after web-1 is healthy again.', files: ['app/website/nginx.conf', 'docker-compose.yml'],
  },
  visitors: {
    title: 'Visitors', links: ['lb'],
    text: 'People opening the site in a browser. They only ever see the load balancer’s address, so servers can be replaced without anyone noticing.',
    when: 'Any time.', files: [],
  },
};

const archMap = $('#arch-map');
function selectNode(key) {
  const node = ARCH[key];
  archMap.classList.add('focused');
  $$('.node', archMap).forEach((b) => {
    b.classList.toggle('selected', b.dataset.node === key);
    b.classList.toggle('linked', node.links.includes(b.dataset.node));
    b.setAttribute('aria-pressed', String(b.dataset.node === key));
  });
  const linkedNames = node.links.map((k) => ARCH[k].title).join(', ');
  const detail = $('#arch-detail');
  detail.replaceChildren(
    el('span', { class: 'tag', text: 'Selected' }),
    el('h3', { text: node.title }),
    el('p', { text: node.text }),
    el('dl', {}, [
      el('div', {}, [el('dt', { text: 'When it runs' }), el('dd', { text: node.when })]),
      el('div', {}, [el('dt', { text: 'Connected to' }), el('dd', { text: linkedNames })]),
      ...(node.files.length ? [el('div', {}, [el('dt', { text: 'Files in the repository' }), el('dd', { class: 'files' }, node.files.map((f) => el('code', { text: f })))])] : []),
    ]),
  );
  detail.classList.remove('fade-in'); void detail.offsetWidth; detail.classList.add('fade-in');
}
$$('.node', archMap).forEach((b) => b.addEventListener('click', () => selectNode(b.dataset.node)));
selectNode('actions');

/* ---------- Load balancer test ---------- */
async function runLbTest() {
  const btn = $('#lb-btn');
  const total = 10;
  const counts = new Map();
  let failed = 0;
  btn.disabled = true;
  btn.textContent = 'Sending…';
  $('#lb-summary').textContent = 'Sending requests…';

  const draw = (done) => {
    $('#lb-bar').style.width = `${(done / total) * 100}%`;
    const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (failed) rows.push(['failed', failed]);
    $('#lb-results').replaceChildren(...rows.map(([srv, n]) => {
      const bar = el('i');
      bar.style.width = `${(n / total) * 100}%`;
      return el('li', { class: srv === 'failed' ? 'fail' : '' }, [
        el('span', { class: 'srv', text: srv === 'failed' ? 'No answer' : srv }),
        el('span', { class: 'bar' }, bar),
        el('span', { class: 'num', text: `${n} / ${total}` }),
      ]);
    }));
  };

  for (let i = 1; i <= total; i++) {
    try {
      const res = await api(`/api/health?n=${i}&t=${Date.now()}`);
      if (res.ok && res.body && res.body.server) counts.set(res.body.server, (counts.get(res.body.server) || 0) + 1);
      else failed += 1;
    } catch (e) {
      failed += 1;
    }
    draw(i);
    if (!reduceMotion) await sleep(120);
  }

  const servers = counts.size;
  let summary;
  if (servers === 0) summary = 'No server answered. The API may be down.';
  else if (servers === 1) summary = `All answered requests came from one server (${[...counts.keys()][0]}). That is expected when only one server is running.`;
  else summary = `${servers} servers shared the requests, so the load balancer is spreading traffic.`;
  if (failed && servers) summary += ` ${failed} request${failed > 1 ? 's' : ''} got no answer.`;
  $('#lb-summary').textContent = summary;
  btn.disabled = false;
  btn.textContent = 'Send 10 again';
}
$('#lb-btn').addEventListener('click', runLbTest);

/* ---------- Recent deployments ---------- */
let deployList = [];

function timeAgo(iso) {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  const units = [['year', 31536000], ['month', 2592000], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [name, size] of units) {
    const n = Math.floor(s / size);
    if (n >= 1) return `${n} ${name}${n > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

function renderDeploys() {
  const list = $('#deploys');
  if (!deployList.length) {
    list.replaceChildren(el('li', {}, el('span', { class: 'muted', text: 'No deployment history yet. The pipeline writes it on the next build.' })));
    return;
  }
  list.replaceChildren(...deployList.map((d) => {
    const isLive = status.commit && d.commit && status.commit.startsWith(d.commit.slice(0, 7));
    const sha = el('span', { class: 'sha', text: d.commit.slice(0, 7) });
    const msg = el('span', { class: 'msg' }, [document.createTextNode(d.message)]);
    if (isLive) msg.append(el('span', { class: 'live-badge', text: 'LIVE' }));
    msg.append(el('small', { text: d.author ? `by ${d.author}` : '' }));
    return el('li', {}, [sha, msg, el('time', { class: 'ago', datetime: d.date, title: new Date(d.date).toLocaleString(), text: timeAgo(d.date) })]);
  }));
}
function markLiveDeploy() { if (deployList.length) renderDeploys(); }

async function loadDeploys() {
  try {
    const res = await api('deployments.json');
    if (res.ok && Array.isArray(res.body)) {
      deployList = res.body.filter((d) => d && typeof d.commit === 'string' && typeof d.message === 'string').slice(0, 8);
    }
  } catch (e) { /* show the empty state */ }
  renderDeploys();
}
loadDeploys();

/* ---------- Footer ---------- */
$('#year').textContent = String(new Date().getFullYear());
