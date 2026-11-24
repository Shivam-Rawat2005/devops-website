# Deployment Guide: Terraform, Ansible and GitHub Actions on AWS

This guide takes the project from your computer to a live website on AWS, deployed automatically on every push. Do [SETUP.md](../SETUP.md) first, so the site runs locally and the code is on GitHub.

Time needed: about 1 to 1.5 hours the first time. After that, deploying is just `git push`.

---

## How the pieces fit

```
git push ──▶ GitHub Actions (.github/workflows/deploy.yml)
               1. Test        npm test
               2. Build       Docker images → GitHub Container Registry, tagged with the commit ID
               3. Dev         Terraform (terraform/) creates/updates AWS
                              Ansible  (ansible/site.yml) sets up and secures the server
                              Ansible  (ansible/deploy.yml) deploys the new version
                              curl     checks /api/version shows the new commit
               4. Prod        waits for your approval, then the same steps on 2 servers
                              behind a load balancer, one server at a time
```

| Folder | Tool | What it does |
| --- | --- | --- |
| `terraform/bootstrap/` | Terraform | One-time: S3 bucket for Terraform state, and the role GitHub uses to log in to AWS |
| `terraform/` | Terraform | VPC, subnets, security groups, EC2 servers, Elastic IPs, load balancer (prod) |
| `terraform/envs/` | Terraform | `dev.tfvars` (1 server, no load balancer) and `prod.tfvars` (2 servers + load balancer) |
| `ansible/site.yml` | Ansible | Roles `common`, `hardening`, `docker`, `ssl` |
| `ansible/deploy.yml` | Ansible | Role `deploy`, with `serial: 1` for rolling, zero-downtime updates |
| `.github/workflows/` | GitHub Actions | `deploy.yml`, `_deploy.yml`, `ci.yml`, `rollback.yml`, `destroy.yml` |

---

## Before you start: cost

- **Dev** (1 × `t3.micro`) is the cheapest setup. Depending on your AWS account, it may be covered by the free tier; check the Billing page.
- **Prod** adds a second server and an **Application Load Balancer, which is not free**. AWS also charges a small hourly fee for each public IPv4 address.
- Create a **budget alert**: AWS Console → Billing → Budgets → Create budget → choose a small monthly amount. AWS emails you before you go over.
- When you're not demoing, run the **Destroy** workflow for prod (and dev if you like). Rebuilding is just running Deploy again.

---

## Step 1: Install the AWS CLI and Terraform on your computer

You only need these once, for the bootstrap in Step 3. After that, GitHub Actions runs everything.

**Windows (PowerShell):**
```powershell
winget install Amazon.AWSCLI
winget install Hashicorp.Terraform
```
Close and reopen PowerShell, then check:
```powershell
aws --version
terraform -version    # must be 1.10 or newer
```

**macOS:** `brew install awscli terraform` · **Linux:** see https://developer.hashicorp.com/terraform/install

---

## Step 2: Give your computer access to AWS

1. Sign in to the AWS Console with your account.
2. Go to **IAM → Users → Create user**. Name it `admin-cli`, attach the policy **AdministratorAccess**, and create it.
3. Open the user → **Security credentials → Create access key → Command Line Interface (CLI)**. Copy both keys.
4. In PowerShell:
   ```powershell
   aws configure
   ```
   Paste the two keys, region `ap-south-1` (Mumbai, or your choice), output `json`.
5. Check it works: `aws sts get-caller-identity` shows your account number.

These keys stay on your computer only. GitHub never gets them; it uses a temporary login instead (OIDC, created in the next step).

---

## Step 3: Run the bootstrap (once)

This creates the S3 bucket for Terraform's state and the IAM role that GitHub Actions is allowed to use.

Pick a **bucket name** that is unique across all of AWS, for example `devops-website-tfstate-yourname-2026`. Use your GitHub `username/repository`.

```powershell
cd terraform/bootstrap
terraform init
terraform apply -var="github_repo=YOUR-USERNAME/devops-website" -var="state_bucket_name=devops-website-tfstate-yourname-2026"
```

Type `yes` when asked. At the end it prints:

```
aws_role_arn = "arn:aws:iam::123456789012:role/devops-website-github-deploy"
state_bucket = "devops-website-tfstate-yourname-2026"
```

Keep both values for Step 5. Keep the `terraform.tfstate` file in this folder safe (it is ignored by Git).

---

## Step 4: Create the SSH key Ansible uses

Ansible logs in to the servers with an SSH key. Create a new key just for this project:

```powershell
ssh-keygen -t ed25519 -C "devops-website-deploy" -f devops-deploy
```
When it asks for a passphrase, press **Enter twice** to leave it empty (the pipeline can't type a passphrase).

This makes two files:
- `devops-deploy`: the **private** key. Never commit it or share it.
- `devops-deploy.pub`: the **public** key. Terraform puts it on the servers.

Do this outside your project folder, so the keys can't be committed by accident.

---

## Step 5: Add secrets, variables and environments in GitHub

Open your repository on GitHub → **Settings**.

### 5.1 Secrets (Settings → Secrets and variables → Actions → Secrets → New repository secret)

| Name | Value |
| --- | --- |
| `AWS_ROLE_ARN` | `aws_role_arn` from Step 3 |
| `SSH_PRIVATE_KEY` | The whole contents of `devops-deploy`, including the `-----BEGIN` and `-----END` lines |
| `SSH_PUBLIC_KEY` | The contents of `devops-deploy.pub` (one line) |

Tip for copying file contents in PowerShell: `Get-Content devops-deploy -Raw | Set-Clipboard`

### 5.2 Variables (same page → Variables tab → New repository variable)

| Name | Value |
| --- | --- |
| `TF_STATE_BUCKET` | `state_bucket` from Step 3 |
| `AWS_REGION` | `ap-south-1` (or the region you chose) |
| `CERTIFICATE_ARN` | Optional, for HTTPS on prod (see "HTTPS" below). Leave it out for now. |

### 5.3 Environments (Settings → Environments → New environment)

1. Create **`dev`**. No settings needed.
2. Create **`prod`**. Tick **Required reviewers** and add yourself. This is the manual approval before production.

---

## Step 6: Deploy

Commit and push the project (it now includes `terraform/`, `ansible/` and `.github/`):

```powershell
git add .
git commit -m "Add Terraform, Ansible and GitHub Actions"
git push
```

Then open your repository → **Actions** tab → the **Deploy** run.

1. **Test** and **Build and push images** run first.
2. **Dev / Deploy to dev** creates the AWS resources and deploys. The first run takes longer because it creates everything and installs Docker.
3. **Prod / Deploy to prod** shows **Waiting for review**. Click **Review deployments → prod → Approve and deploy**.
4. When a job finishes, its summary shows **Live at: http://…**. Open that address.

On the site, the **Live** section should show **Online**, your environment (`dev` or `prod`), and the **commit ID** you just pushed. On prod, **Send 10 requests** shows the requests split between `web-1` and `web-2`.

### First-run note: container image access

The first build creates two packages in GitHub (`devops-website-web` and `devops-website-api`). The workflows link them to your repository, so the deploy can pull them. If a deploy fails with `denied` or `unauthorized` while pulling images, open your GitHub profile → **Packages** → each package → **Package settings → Manage Actions access → Add repository**, give your repository **Read** access, and re-run the failed job.

---

## Step 7: The everyday flow (and the viva demo)

1. Edit something, for example a heading in `app/website/index.html`.
2. `git add . && git commit -m "Change heading" && git push`
3. Watch **Actions → Deploy**. Approve prod when asked.
4. Refresh the site: the change is there, and **Version** shows the new commit with **LIVE** in Recent deployments.

**Showing a safe failure:** in `app/api/test/api.test.js`, change an expected value so a test fails, and push. The pipeline stops at **Test**; nothing is built or deployed, and the live site keeps the old version. Undo the change and push again.

**Pull requests:** open a pull request instead of pushing to `main`, and the **CI** workflow runs the tests, `terraform validate`, `ansible-lint`, and posts the **Terraform plan** as a comment.

---

## Rollback

Actions tab → **Rollback** → **Run workflow** → choose the environment and enter the 7-character commit ID of a working version (from Recent deployments on the site, or from an earlier Deploy run). The older images are still in the registry, so nothing is rebuilt; the same rolling deploy puts that version back.

---

## Destroy (stop paying)

Actions tab → **Destroy** → **Run workflow** → choose the environment and type its name again to confirm. Terraform deletes everything it created for that environment. Prod asks for approval first.

The bootstrap resources (state bucket and IAM role) stay; they cost almost nothing. To remove those too, empty the bucket in the S3 console, remove `prevent_destroy` from `terraform/bootstrap/main.tf`, and run `terraform destroy` in that folder.

---

## HTTPS

- **Prod (load balancer):** in AWS Certificate Manager (same region), request a public certificate for your domain and complete the DNS validation it asks for. Copy the certificate ARN into the GitHub variable `CERTIFICATE_ARN`, push, then point your domain's DNS (a CNAME record) at the load balancer address. The load balancer then redirects HTTP to HTTPS.
- **Dev (single server):** point your domain's A record at the server's Elastic IP, then in `ansible/group_vars/all.yml` set `enable_tls: true`, `domain_name` and `letsencrypt_email`. The `ssl` role gets a free Let's Encrypt certificate and renews it automatically.

---

## Running Terraform and Ansible from your own computer (optional)

The pipeline does this for you, but you can run the same commands yourself to learn them. Ansible does not run natively on Windows, so on Windows use **WSL** (`wsl --install`, then run these inside Ubuntu).

```bash
# Terraform
cd terraform
terraform init -backend-config="bucket=YOUR-BUCKET" -backend-config="key=dev/terraform.tfstate" -backend-config="region=ap-south-1"
terraform plan  -var-file=envs/dev.tfvars -var="ssh_public_key=$(cat ~/devops-deploy.pub)"
terraform apply -var-file=envs/dev.tfvars -var="ssh_public_key=$(cat ~/devops-deploy.pub)"
terraform output -raw ansible_inventory > ../ansible/inventories/dev/hosts.yml

# Ansible
cd ../ansible
pip install "ansible-core>=2.17,<2.18"
ansible-galaxy collection install -r requirements.yml
ansible-playbook -i inventories/dev/hosts.yml site.yml --private-key ~/devops-deploy
IMAGE_TAG=abc1234 REGISTRY=ghcr.io/your-username ansible-playbook -i inventories/dev/hosts.yml deploy.yml --private-key ~/devops-deploy
```

Use `--check` with `ansible-playbook` to see what would change without changing anything.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `Not authorized to perform sts:AssumeRoleWithWebIdentity` | `github_repo` in Step 3 doesn't match your repository name exactly (case matters). Re-run the bootstrap with the correct `owner/name`. |
| `Could not load credentials from any providers` | The secret `AWS_ROLE_ARN` is missing or misspelled. |
| Terraform: `Error acquiring the state lock` | Another run is still going. Wait for it; the workflows queue per environment. |
| Terraform: `required_version` / `use_lockfile` errors | Use Terraform 1.10 or newer (the workflows already do). |
| Ansible: `UNREACHABLE` / SSH timeout | The private key secret doesn't match `SSH_PUBLIC_KEY`, or it lost its first/last lines when pasted. Paste the whole file again. |
| Ansible: `denied` pulling images | See "First-run note: container image access" above. |
| Ansible: version check fails on `/api/version` | The image wasn't built from this commit. Re-run the whole Deploy workflow rather than a single job. |
| Prod: load balancer step waits a long time | `target-in-service` waits for 2 health checks on `/healthz`. If it never passes, check the server with `curl http://localhost/healthz` over SSH. |
| Site shows the old version | The browser may be showing a cached page; refresh with Ctrl + F5. |

---

## What was checked before delivery

- `terraform fmt` and `terraform validate` pass for `terraform/` and `terraform/bootstrap/` (checked with OpenTofu 1.8 and the AWS provider 5.80).
- `ansible-lint` passes at the strictest (**production**) profile, and both playbooks pass `--syntax-check`.
- The Ansible templates were rendered and checked: both Compose files pass `docker compose config`, and the HTTPS Nginx config passes `nginx -t`.
- A dry run (`--check`) of `site.yml` on Ubuntu 24.04 went through the `common` and `hardening` roles successfully; it stopped at the Docker download only because the test machine had no access to download.docker.com.
- All workflows pass `actionlint`, including `shellcheck` on every script step.
- Not done: a real run against an AWS account. That first real run happens in Step 6 on your account.
