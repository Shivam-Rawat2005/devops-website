# Automated Website Deployment Using DevOps Tools
## Project Presentation Deck

---

## Slide 1: Title Slide

### **Automated Website Deployment Using DevOps Tools**
#### End-to-End CI/CD Pipeline on AWS

* **Presenter:** Shivam Rawat
* **Project Name:** DevOps Web Application (`shivam.dev`)
* **Technology Stack:** Docker, Terraform, Ansible, GitHub Actions, AWS

---

## Slide 2: Project Overview & The Problem We Solve

### **Why DevOps? Moving from Manual to Automated Delivery**

* **The Old Manual Way (Traditional):**
  * Developers manually log into cloud servers.
  * Installing Node.js, web servers, and libraries by hand takes hours.
  * High chance of human mistakes; if a server crashes, the site goes down.

* **Our Automated Solution (DevOps):**
  * **Code Defines Everything:** Both the app and the cloud servers are written as code.
  * **Sealed Containers (Docker):** Runs identically on my laptop and on AWS servers.
  * **Push-to-Deploy (CI/CD):** A single `git push` automatically tests, builds, and deploys the website in under 3 minutes.

---

## Slide 3: System Architecture & Workflow

### **How All the Tools Connect**

```
 [ Developer ] ──▶ [ GitHub Repository ]
                          │
                          ▼ (git push)
               [ GitHub Actions ] (The Automation Engine)
                          │
       ┌──────────────────┼──────────────────┐
       ▼                  ▼                  ▼
  [ Docker ]        [ Terraform ]       [ Ansible ]
 Builds App into    Creates AWS Cloud    Configures Linux &
   Containers        Infrastructure      Deploys Containers
       │                  │                  │
       └──────────────────┼──────────────────┘
                          ▼
            [ AWS Cloud (Mumbai Region) ]
            • 1 Application Load Balancer
            • 2 Production Servers (web-1 & web-2)
            • 1 Development Server (dev-web-1)
```

---

## Slide 4: Key DevOps Tools & Simple Roles

### **One Clear Job for Every Tool**

* 🐳 **Docker:**
  * Packages our website and Node.js API into lightweight, portable containers so they run the same anywhere.
* 🏗️ **Terraform (Infrastructure as Code):**
  * The cloud builder. Reads our configuration files and automatically creates AWS servers, networks, and firewalls in 60 seconds without clicking buttons.
* ⚙️ **Ansible (Configuration Management):**
  * The system admin. Logs into the AWS servers over SSH, installs Docker, and starts our web containers.
* 🚀 **GitHub Actions (CI/CD):**
  * The robot conveyor belt. Listens for code pushes and runs the steps (Test → Build → Deploy) automatically.
* ☁️ **AWS (Cloud Provider):**
  * Hosts our virtual servers (EC2), private network (VPC), and load balancer in the Mumbai data center.

---

## Slide 5: Cloud Setup: Why 3 EC2 Instances?

### **Development vs. High-Availability Production**

| Server Name | Environment | What It Does |
| :--- | :--- | :--- |
| **`devops-website-dev-web-1`** | **Dev** | **Testing Server:** Runs new updates first to test them safely before showing to real users. |
| **`devops-website-prod-web-1`** | **Prod** | **Live Server 1:** Sits behind the Load Balancer to serve visitors. |
| **`devops-website-prod-web-2`** | **Prod** | **Live Server 2 (Backup):** Located in a **different physical AWS data center**. If one data center has a power outage, the other keeps the site online! |

* **Application Load Balancer:** Distributes incoming website visitors evenly between Server 1 and Server 2 so neither server gets overloaded.

---

## Slide 6: Terraform Architecture: The Main Files & Use Cases

### **How Every File Builds a Piece of the Cloud**

* 📁 **`bootstrap/main.tf` (One-Time Setup):**
  * **Use Case:** Creates the secure S3 bucket for Terraform remote state and the AWS IAM OIDC Role that allows GitHub Actions to log into AWS without permanent passwords.
* 🌐 **`network.tf` (Virtual Private Cloud):**
  * **Use Case:** Creates our private network (VPC: `10.20.0.0/16`), an Internet Gateway, and 2 subnets across two data centers (`ap-south-1a` and `ap-south-1b`).
* 🔒 **`security.tf` (Cloud Firewalls):**
  * **Use Case:** Configures AWS Security Groups. Restricts SSH to key-only access on port 22; allows web traffic on port 80 only through the Load Balancer.
* 💻 **`compute.tf` (Virtual Servers):**
  * **Use Case:** Automatically finds Ubuntu 24.04 Linux, injects our SSH key, launches `t3.micro` EC2 instances, and assigns static Elastic IPs.
* ⚖️ **`lb.tf` (Application Load Balancer):**
  * **Use Case:** Sets up the Load Balancer across both servers and runs automated health checks (`/healthz` ping every 15s) to stop traffic to unhealthy nodes.
* 📄 **`inventory.yml.tftpl` & `outputs.tf` (Ansible Bridge):**
  * **Use Case:** Dynamically reads the newly created server IPs and automatically writes the Ansible inventory file (`hosts.yml`).
* ⚙️ **`envs/dev.tfvars` & `envs/prod.tfvars` (Environment Configs):**
  * **Use Case:** Specifies parameters per environment: 1 server without Load Balancer for **Dev**; 2 servers with Load Balancer for **Prod**.

---

## Slide 7: What Did We Actually Build? The Web Application

### **Features of the Live Website (`shivam.dev`)**

* **Frontend (Nginx):** Clean, fast, modern portfolio displaying projects, skills, and about info.
* **Backend API (Node.js & Express):**
  * `/api/health`: Monitors server health and active memory.
  * `/api/version`: Shows which Git commit and build time is live.
  * `/api/quote`: Serves dynamic tech quotes.
  * `/api/contact`: Working contact form with spam protection and rate limiting.
* **Interactive DevOps Features on the Page:**
  * **Live Status Panel:** Shows real-time server health and ticking uptime.
  * **Load Balancer Tester:** Sends 10 requests to demonstrate AWS balancing traffic between `web-1` and `web-2` live.

---

## Slide 8: The 5-Step Automated Pipeline

### **What Happens When You Type `git push`?**

1. **Step 1: Test** — GitHub Actions automatically runs 13 unit tests on the Node.js API.
2. **Step 2: Build** — Docker builds the website and API containers and saves them to GitHub Container Registry.
3. **Step 3: Infrastructure Check** — Terraform verifies that AWS servers, networking, and firewalls match our code.
4. **Step 4: Deploy to Dev** — Ansible deploys the new containers to the Dev server first.
5. **Step 5: Deploy to Prod** — With approval, Ansible updates production servers with the new version!

---

## Slide 9: Conclusion & Key Takeaways

### **What We Achieved**

* **Full DevOps Integration:** Connected Git, Docker, Terraform, Ansible, and GitHub Actions into one seamless flow.
* **100% Automated:** Turned hours of manual server configuration into a 3-minute push-to-deploy pipeline.
* **High Reliability:** Multi-server production setup on AWS ensures the website is always online.
* **Real-World Skills:** Built using the exact same DevOps tools and practices used by top tech companies worldwide.
