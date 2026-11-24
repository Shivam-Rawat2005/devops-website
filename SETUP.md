# Setup Guide: Run the Website on Your Computer

This guide takes you from the zip file to the website running on your own computer, and then onto GitHub. It covers Windows, macOS and Linux.

At the end you will have:

- The website and API running at `http://localhost:3000` (quick way) or `http://localhost:8080` (Docker way)
- All automated tests passing
- The code in your own GitHub repository, ready for the next phases (Terraform, Ansible, GitHub Actions)

Time needed: about 30–45 minutes, most of it installing tools.

---

## Step 1: Install the tools

Install these four tools. Restart your computer after installing Docker Desktop.

| Tool | Why you need it | Download |
| --- | --- | --- |
| **Git** | Saves your code and sends it to GitHub | https://git-scm.com/downloads |
| **Node.js 22 (LTS)** | Runs the API and the tests | https://nodejs.org (choose the LTS version) |
| **Docker Desktop** | Runs the website in containers, like on the real server | https://www.docker.com/products/docker-desktop |
| **VS Code** | Code editor | https://code.visualstudio.com |

**Windows only:** Docker Desktop needs **WSL 2**. If Docker asks for it during installation, accept. If it doesn't install by itself, open **PowerShell as Administrator** and run:

```powershell
wsl --install
```

Then restart your computer.

### Check that everything is installed

Open a terminal (on Windows: **PowerShell**; on Mac: **Terminal**) and run each line:

```bash
git --version
node --version
npm --version
docker --version
docker compose version
```

Each one should print a version number. `node --version` should show **v20 or higher** (v22 recommended).

If you see **"not recognized"** or **"command not found"**, close the terminal, open a new one and try again. If it still fails, reinstall that tool.

---

## Step 2: Get the project

1. Unzip `devops-website.zip`. Put the folder somewhere simple, for example:
   - Windows: `C:\Projects\devops-website`
   - Mac/Linux: `~/Projects/devops-website`
2. Open **VS Code** → **File → Open Folder** → choose the `devops-website` folder.
3. Open the terminal inside VS Code: **Terminal → New Terminal**.

All commands below are typed in this terminal. It starts inside the `devops-website` folder.

The folder looks like this:

```
devops-website/
├── app/
│   ├── website/     the website (HTML, CSS, JavaScript) + Nginx
│   └── api/         the Node.js API + tests
├── scripts/         helper script for the deployment history
├── docker-compose.yml
├── README.md
└── SETUP.md         (this file)
```

---

## Step 3: Run the website (quick way, without Docker)

Use this while you are editing the website. It is the fastest way to see changes.

```bash
cd app/api
npm install
npm test
npm run dev
```

What each command does:

| Command | What it does | What you should see |
| --- | --- | --- |
| `npm install` | Downloads the API's libraries | `added 69 packages` (number may vary) |
| `npm test` | Runs the 13 automated tests | `# pass 13` and `# fail 0` |
| `npm run dev` | Starts the website and API together | `Open http://localhost:3000 in your browser` |

Now open **http://localhost:3000** in your browser.

To stop the server, click in the terminal and press **Ctrl + C**.

> **Important:** always open the site through `http://localhost:3000`. Do **not** double-click `index.html`. If you open the file directly, the page cannot reach the API and will show "API offline".

When you change a file in `app/website/`, just refresh the browser. When you change a file in `app/api/`, stop the server (Ctrl + C) and run `npm run dev` again.

---

## Step 4: Run the website with Docker (the way it runs on the server)

This builds the two containers (Nginx + website, and the Node.js API) exactly as they will run on AWS.

1. Start **Docker Desktop** and wait until it says **"Engine running"**.
2. In the VS Code terminal, go back to the main folder and start the containers:

```bash
cd ../..
docker compose up --build
```

(If your terminal is already in the main `devops-website` folder, skip the `cd ../..` line.)

The first time takes a few minutes, because Docker downloads the base images. When you see lines like `api-1 ... "type":"startup"`, open:

**http://localhost:8080**

Useful Docker commands (run them in a **second** terminal while the site is running):

| Command | What it does |
| --- | --- |
| `docker compose ps` | Shows both containers and whether they are healthy |
| `docker compose logs api` | Shows the API's log |
| `docker compose logs api \| grep contact_message` | Shows messages sent through the contact form (on Windows PowerShell use `docker compose logs api \| Select-String contact_message`) |
| `docker compose down` | Stops and removes the containers |
| `docker compose up --build` | Rebuilds after you change code, then starts again |

To stop: press **Ctrl + C** in the first terminal, then run `docker compose down`.

> Docker does not pick up code changes automatically. After editing files, run `docker compose up --build` again.

---

## Step 5: Check that everything works

Open the site and go through this list:

- [ ] **Live** section shows **Status: Online**, an uptime that counts up, and **Environment: local** (quick way) or **development** (Docker way)
- [ ] **Load balancer test**: click **Send 10 requests**. On your computer all 10 come from one server. That is correct; the second server comes in a later phase.
- [ ] **Recent deployments** shows 5 entries
- [ ] **Architecture map**: clicking a box shows its details on the right
- [ ] **Pipeline**: **Play** moves through the six stages
- [ ] **Projects**: filter buttons work, and clicking a card opens its details
- [ ] **Quote**: **Another quote** changes the quote
- [ ] **Contact form**: sending it empty shows errors; filling it in correctly shows "Thanks, … Your message was received."
- [ ] **Theme button** (top right) switches between light and dark
- [ ] Make the browser window narrow: the menu button appears and works

If all boxes are ticked, your setup is complete.

---

## Step 6: Make it yours

The site comes with example content. Change it before you show it to anyone.

| What to change | File | What to look for |
| --- | --- | --- |
| Your name, bio, skills, learning-path dates | `app/website/index.html` | Search for `Aditya` and the `About` section |
| Your projects | `app/website/app.js` | The `PROJECTS` list (about halfway down) |
| Domain name | `app/website/index.html`, `app/website/app.js`, `app/website/404.html` | Replace `aditya.dev` (or leave it until you buy a domain) |
| Deployment history | `app/website/deployments.json` | Sample data for now; the pipeline will fill it in later |
| GitHub username for Docker images | `docker-compose.yml` | Replace `your-github-username` |

**Tip:** in VS Code, press **Ctrl + Shift + F** (Mac: **Cmd + Shift + F**) to search all files at once.

After editing, refresh the browser (quick way) or run `docker compose up --build` (Docker way), then run `npm test` again inside `app/api` to make sure nothing broke.

---

## Step 7: Put the project on GitHub

The next phases (GitHub Actions) need your code on GitHub.

### 7.1 Create the repository on GitHub

1. Sign in at https://github.com (create an account if you don't have one).
2. Click **+** (top right) → **New repository**.
3. Name it `devops-website`.
4. Choose **Public** or **Private**. Public is useful for your resume.
5. **Do not** tick "Add a README", ".gitignore" or "license". The project already has them.
6. Click **Create repository**. Keep the page open; it shows your repository's address.

### 7.2 Set your name in Git (first time only)

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

Use the same email as your GitHub account.

### 7.3 Upload the code

Run these in the main `devops-website` folder. Replace `YOUR-USERNAME` with your GitHub username.

```bash
git init
git add .
git commit -m "Initial version of website and API"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/devops-website.git
git push -u origin main
```

The first push asks you to sign in to GitHub. A browser window opens; approve it.

Refresh the GitHub page. You should see all the project files. The `node_modules` folder is **not** uploaded; that is correct, because `.gitignore` excludes it.

### 7.4 Every change after this

```bash
git add .
git commit -m "Describe what you changed"
git push
```

Right now a push only **saves** the code on GitHub; it does not update any live website yet. Making a push update the live site automatically is exactly what the next phases build.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `'npm' is not recognized` or `command not found: node` | Close and reopen the terminal (or restart VS Code). If it still fails, reinstall Node.js and tick "Add to PATH". |
| `npm test` fails with `Cannot find module 'express'` | Run `npm install` first, inside `app/api`. |
| `Error: listen EADDRINUSE ... 3000` | Port 3000 is already used. Stop the other program, or use another port: **PowerShell** `$env:PORT=4000; npm run dev` · **Command Prompt** `set PORT=4000 && npm run dev` · **Mac/Linux** `PORT=4000 npm run dev`. Then open `http://localhost:4000`. |
| Docker: `port is already allocated` for 8080 | Use another port: **PowerShell** `$env:WEB_PORT=9090; docker compose up --build` · **Mac/Linux** `WEB_PORT=9090 docker compose up --build`. Then open `http://localhost:9090`. |
| `Cannot connect to the Docker daemon` / `error during connect` | Docker Desktop is not running. Open it and wait for "Engine running". |
| Docker Desktop says WSL 2 is missing (Windows) | Run `wsl --install` in PowerShell as Administrator, then restart. |
| `docker compose up` hangs or fails while downloading images | Check your internet connection. College networks sometimes block Docker Hub; try a mobile hotspot. |
| Page shows **API offline** | Make sure the server is still running in the terminal, and that you opened `http://localhost:...`, not the file directly. |
| My change doesn't show | Quick way: refresh the browser (Ctrl + F5 for a full refresh). Docker way: run `docker compose up --build` again. |
| `git push` is rejected | You may have ticked "Add a README" on GitHub. Run `git pull origin main --allow-unrelated-histories`, then `git push`. |

---

## What's next

The website now runs on your computer and the code is on GitHub. To put it online with automatic deployment (Terraform, Ansible and GitHub Actions on AWS), follow **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.
