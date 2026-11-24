# Automated Deployment of a Website Using DevOps Tools

A portfolio website with a small Node.js API, deployed to AWS automatically on every push. Docker packages it, Terraform creates the AWS infrastructure, Ansible configures the servers and deploys, and GitHub Actions runs the whole pipeline.

- **Run it on your computer:** [SETUP.md](SETUP.md) (Windows, macOS and Linux)
- **Deploy it to AWS:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## What's inside

```
devops-website/
├── app/
│   ├── website/            Static site (HTML, CSS, JavaScript) + Nginx
│   │   ├── index.html
│   │   ├── style.css
│   │   ├── app.js          All interactive features
│   │   ├── theme-init.js   Applies saved light/dark theme before the page paints
│   │   ├── 404.html
│   │   ├── favicon.svg
│   │   ├── deployments.json  Recent deploys (sample; the pipeline rewrites it)
│   │   ├── fonts/          Self-hosted fonts (SIL Open Font License, see LICENSE files)
│   │   ├── nginx.conf      Serves the site, proxies /api/ to the API, security headers
│   │   └── Dockerfile
│   └── api/                Node.js (Express) API
│       ├── src/app.js      Routes and validation
│       ├── src/server.js   Starts the server, handles shutdown
│       ├── test/           Automated tests (node:test)
│       └── Dockerfile
├── terraform/              Infrastructure as Code (AWS)
│   ├── network.tf          VPC, two public subnets in two availability zones
│   ├── security.tf         Security groups (firewalls)
│   ├── compute.tf          EC2 web servers (Ubuntu 24.04) and Elastic IPs
│   ├── lb.tf               Application Load Balancer, health checks, HTTPS
│   ├── outputs.tf          Site URL and the generated Ansible inventory
│   ├── envs/               dev.tfvars (1 server) and prod.tfvars (2 servers + load balancer)
│   └── bootstrap/          One-time: S3 state bucket and the GitHub OIDC role
├── ansible/                Configuration management
│   ├── site.yml            Server setup: roles common, hardening, docker, ssl
│   ├── deploy.yml          Rolling deploy (serial: 1) with load balancer drain
│   ├── group_vars/all.yml  Shared settings
│   └── roles/              common, hardening, docker, ssl, deploy
├── .github/workflows/      CI/CD pipeline
│   ├── deploy.yml          Push to main: test, build, deploy dev, approve, deploy prod
│   ├── _deploy.yml         Reusable deploy job (Terraform + Ansible + live check)
│   ├── ci.yml              Pull requests: tests, lint, Terraform plan comment
│   ├── rollback.yml        Redeploy an earlier version
│   └── destroy.yml         Delete an environment
├── scripts/
│   └── generate-deployments.js   Writes deployments.json from git history
├── docs/DEPLOYMENT.md      Step-by-step AWS and GitHub setup
└── docker-compose.yml      Runs both containers together (local)
```

## Website features

- **About:** short bio, skills and a learning-path timeline.
- **Interactive architecture map:** every part of the system (developer, GitHub, Actions, registry, Terraform, Ansible, load balancer, both servers, visitors). Select one to see what it does, when it runs and which files control it; connected parts light up.
- **Load balancer test:** sends 10 requests to `/api/health` and charts which server answered each one. With two servers behind the load balancer, both get a share.
- **Recent deployments:** the last commits from `deployments.json`, with the one currently live marked LIVE (matched against `/api/version`).
- **Self-hosted fonts:** no requests to Google or any other site, so the security policy only allows this site's own files.
- **Live status panel:** reads `/api/health` and `/api/version` and shows online/offline, which server answered, the deployed commit, build time, environment and a ticking uptime. Refreshes every 30 seconds and on "Check again".
- **Animated terminal** in the hero showing a deploy, with a Replay button.
- **Projects** with filter buttons by tool and a details popup for each project.
- **Pipeline explorer:** six stages (Push, Test, Build, Infrastructure, Deploy, Live) with the tool and file behind each. Click, use arrow keys, or press Play.
- **Quote** fetched from `/api/quote`, never the same one twice in a row.
- **Contact form** checked in the browser and again on the server, with spam protection (hidden field) and a limit of 5 messages per 10 minutes per visitor.
- **Light and dark theme** that follows the system and remembers your choice.
- **Mobile menu**, keyboard support, and reduced motion for people who turn animations off.
- If the API is down, the page still works: status shows Offline, the quote falls back to a built-in one, and the form explains the problem.

## Deployment history

`app/website/deployments.json` ships with sample entries so the section works locally. In the pipeline, regenerate it from git before building the website image:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 10
- run: node scripts/generate-deployments.js
```

## API

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/health` | `{ status, server, uptime_s, timestamp }` |
| GET | `/api/version` | `{ commit, build_time, environment, version }` from `GIT_SHA`, `BUILD_TIME`, `APP_ENV`, `APP_VERSION` |
| GET | `/api/quote?exclude=<id>` | `{ text, author, id }` |
| POST | `/api/contact` | `201` on success, `400` with an error per field, `429` when rate limited |

There is no database. Contact messages are written to the API container's log:

```bash
docker compose logs api | grep contact_message
```

## Run it

### With Docker (same as on the server)

```bash
docker compose up --build
```

Open http://localhost:8080. Pass build information the way the pipeline will:

```bash
GIT_SHA=$(git rev-parse --short HEAD) BUILD_TIME=$(date -u +%FT%TZ) APP_ENV=dev docker compose up --build
```

### Without Docker (quick local development)

```bash
cd app/api
npm install
npm run dev        # serves the website and API together on http://localhost:3000
```

### Tests

```bash
cd app/api
npm test           # 13 tests: every endpoint, validation, spam field, rate limit, bad JSON, size limit
```

## Make it yours

- **Name and text:** edit `app/website/index.html` (search for "Aditya"), including the About section, skills and learning-path dates.
- **Projects:** edit the `PROJECTS` list near the middle of `app/website/app.js`. The five included projects are examples; replace them with your own.
- **Domain:** replace `aditya.dev` in `index.html`, `app.js` and `404.html` with your domain.
- **Registry:** in `docker-compose.yml`, change `ghcr.io/your-github-username` to your GitHub username, or set `REGISTRY` when running compose.

## How it was tested

- 13 API tests with `npm test`.
- 38 browser checks with Playwright covering every feature above, run twice: against `npm run dev`, and through the real `nginx.conf` with its Content Security Policy enforced. Includes mobile layout, dark theme, offline API, rate limiting, the architecture map, a simulated two-server load balancer test, and a check that the page makes no requests to other websites.
- `nginx -t` on the config, `hadolint` on both Dockerfiles, and `docker compose config` on the compose file.
- `scripts/generate-deployments.js` tested on a real git repository, including commit messages with quotes and commas.
- The Docker images themselves were not built in the test environment, because it could not download base images from Docker Hub. Run `docker compose up --build` once on your machine to confirm.

- Terraform: `fmt` and `validate` pass. Ansible: `ansible-lint` passes at the production profile, and a dry run on Ubuntu 24.04 passes. Workflows: `actionlint` and `shellcheck` pass. Details in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#what-was-checked-before-delivery).

## Project phases (from the synopsis)

| Phase | What | Where |
| --- | --- | --- |
| 1. Containerization | Dockerfiles, Nginx reverse proxy, Compose | `app/`, `docker-compose.yml` |
| 2. Infrastructure as Code | VPC, security groups, EC2, Elastic IPs, S3 state | `terraform/` |
| 3. Configuration management | Hardening, Docker, HTTPS, deploy | `ansible/` |
| 4. CI/CD pipeline | Test, build, deploy, PR plan comments, rollback | `.github/workflows/` |
| 5. Dev and prod | Separate tfvars, inventories and state; approval for prod | `terraform/envs/`, GitHub environments |
| 6. High availability | Load balancer, two servers, rolling deploy | `terraform/lb.tf`, `ansible/deploy.yml` |
