# Complete documentation: Automating Node.js deployment to AWS EC2 using GitHub Actions CI/CD


## Why we use CI/CD and what problem it solves

- **Goal:** Automate builds, tests, and deployments so changes ship reliably and quickly without manual steps.
- **Need:** Manual deployments are error-prone (missed commands, environment drift, permissions). CI/CD standardizes and repeats the process on every push.
- **Benefits:** Faster iteration, fewer mistakes, reproducible environments, clear logs, auditability, safer secrets handling, and easy rollbacks.
- **Outcome:** Push to GitHub → pipeline runs → app restarts on EC2 → users see changes instantly.

---

## High-level architecture overview

- **Flow:** GitHub → GitHub Actions (self-hosted runner on EC2) → PM2 process manager → Nginx reverse proxy → Node.js app → Client browsers.
- **Key roles:**
  - **GitHub:** Source control and CI/CD workflows.
  - **Self-hosted runner:** Executes workflows on your EC2 server.
  - **PM2:** Keeps Node.js app running and handles restarts.
  - **Nginx:** Fronts HTTP traffic (port 80), proxying to Node backend (port 8000).
  - **Environment:** Secrets and .env values injected during pipeline.

---

## Tools used and why

- **GitHub Actions:** Automates build/deploy on push; integrates secrets and runners.
- **Self-hosted runner:** Runs jobs on your EC2 (access to files, PM2, Nginx).
- **PM2:** Production process manager (start, restart, logs, uptime).
- **Nginx:** Reverse proxy, SSL termination potential, static serving, routing.
- **Node.js + npm:** Runtime and package manager for the app.
- **OpenSSH:** Secure connection to EC2 for configuration.
- **AWS EC2:** Compute instance hosting runner, app, and proxy.
- **GitHub Secrets:** Secure environment variable management.

---

## End-to-end setup and commands

### 1) Prepare your Node.js project

- **Initialize project:**
  ```bash
  mkdir my-node-app && cd my-node-app
  npm init -y
  ```
- **Add start script (package.json):**
  ```json
  {
    "scripts": {
      "start": "node server.js"
    }
  }
  ```
- **Sample server.js:**
  ```js
  require('dotenv').config();

  const express = require('express');
  const app = express();
  const PORT = process.env.PORT || 8000;

  app.get('/api/get', (req, res) => {
    res.send('<h1>API IS WORKING FINE</h1>');
  });

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
  ```
- **Push to GitHub:**
  ```bash
  git init
  git remote add origin https://github.com/<username>/<repo>.git
  git add .
  git commit -m "Initial commit"
  git branch -M main
  git push -u origin main
  ```

---

### 2) Launch an EC2 instance and connect

- **Choose AMI:** Ubuntu Server (you used Ubuntu for runner setup; Amazon Linux differences are noted later).
- **Create key pair:** Download `.pem` file.
- **Security Group inbound rules:**
  - SSH: **Port 22**, source: your IP.
  - HTTP: **Port 80**, source: `0.0.0.0/0`.
- **Connect from your terminal:**
  ```bash
  chmod 400 your-key.pem
  ssh -i "your-key.pem" ubuntu@<your-ec2-public-ip>
  ```

---

### 3) Install system dependencies (Ubuntu)

- **Update & install:**
  ```bash
  sudo apt update
  sudo apt-get install -y nodejs npm nginx
  sudo npm install -g pm2
  ```
- **Verify versions:**
  ```bash
  node -v
  npm -v
  nginx -v
  pm2 -v
  ```

---

### 4) Configure a self-hosted GitHub Actions runner (on EC2)

- **Create runner directory:**
  ```bash
  mkdir actions-runner && cd actions-runner
  ```
- **Download runner:**
  ```bash
  curl -o actions-runner-linux-x64-2.329.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.329.0/actions-runner-linux-x64-2.329.0.tar.gz
  ```
- **Validate checksum (replace with actual hash from GitHub):**
  ```bash
  echo "194f1e1e4bd02f80b7e9633fc546084d8d4e19f3928a324d512ea53430102e1d  actions-runner-linux-x64-2.329.0.tar.gz" | shasum -a 256 -c
  ```
- **Extract:**
  ```bash
  tar xzf actions-runner-linux-x64-2.329.0.tar.gz
  ```
- **Configure runner (replace URL/token):**
  ```bash
  ./config.sh --url https://github.com/<username>/<repo> --token <your_token>
  ```
- **Install as a service and start:**
  ```bash
  sudo ./svc.sh install
  sudo ./svc.sh start
  ```
- **Verify runner work directory:**
  ```bash
  ls ~/actions-runner/_work
  ```

---

### 5) Configure Nginx reverse proxy

#### Ubuntu (sites-available/sites-enabled)

- **Edit default site:**
  ```bash
  sudo nano /etc/nginx/sites-available/default
  ```
- **Add location block under server:**
  ```nginx
  server {
      listen 80;
      server_name _;

      location /api {
          rewrite ^/api/(.*)$ /api/$1 break;
          proxy_pass http://localhost:8000;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      }
  }
  ```
- **Test and restart:**
  ```bash
  sudo nginx -t
  sudo systemctl restart nginx
  ```

#### Amazon Linux (conf.d pattern)

- **Create file:**
  ```bash
  sudo nano /etc/nginx/conf.d/api.conf
  ```
- **Add a pure server block (do NOT wrap with http {}):**
  ```nginx
  server {
      listen 80;
      server_name _;

      location /api {
          rewrite ^/api/(.*)$ /api/$1 break;
          proxy_pass http://localhost:8000;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      }
  }
  ```
- **Test and reload:**
  ```bash
  sudo nginx -t
  sudo systemctl reload nginx
  ```

---

### 6) Start and manage the backend with PM2

- **Locate project checked out by runner:**
  ```bash
  cd ~/actions-runner/_work/<repo>/<repo>
  ```
- **Start app:**
  ```bash
  pm2 start server.js --name Backend
  ```
- **Check status and logs:**
  ```bash
  pm2 list
  pm2 logs Backend
  ```
- **Persist PM2 across reboots (optional):**
  ```bash
  pm2 startup
  pm2 save
  ```

---

### 7) Create the GitHub Actions workflow (CI/CD)

- **Workflow file:** `.github/workflows/node.js.yml`
- **Use self-hosted runner and inject secrets:**
  ```yaml
  name: Node.js CI

  on:
    push:
      branches: [ "main" ]

  jobs:
    build:
      runs-on: self-hosted

      strategy:
        matrix:
          node-version: [18.x]

      steps:
      - uses: actions/checkout@v4

      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Create .env file
        run: |
          echo "PORT=${{ secrets.PORT }}" >> .env
          # echo "DB_URL=${{ secrets.DB_URL }}" >> .env
          # add other secrets as needed

      - name: Install PM2
        run: npm install -g pm2

      - name: Restart Backend
        run: pm2 restart Backend || pm2 start server.js --name Backend
  ```

---

### 8) Configure environment variables and secrets

- **Local .env (not committed):**
  ```env
  PORT=8000
  ```
- **Add `.env` to `.gitignore`:**
  ```
  .env
  ```
- **Create secrets in GitHub:**
  - Repo → Settings → Secrets and variables → Actions → New repository secret.
  - **PORT**: `8000` (or add multi-line secrets if needed).
- **Workflow uses secrets:** already shown in the YAML above.

---

### 9) Test end-to-end

- **Local check via EC2 shell:**
  ```bash
  curl http://localhost:8000/api/get
  ```
- **Public access via browser:**
  ```
  http://<your-ec2-public-ip>/api/get
  ```
- **Trigger pipeline (push changes):**
  ```bash
  git add .
  git commit -m "Update API"
  git push
  ```
- **Watch runner and logs:**
  ```bash
  pm2 logs Backend
  ```

---

## Differences between Ubuntu and Amazon Linux

| Topic | Ubuntu | Amazon Linux 2 |
|---|---|---|
| **Default user** | ubuntu | ec2-user |
| **Package manager** | apt / apt-get | yum (dnf on newer) |
| **Nginx configuration layout** | `/etc/nginx/sites-available` + symlink to `sites-enabled` | `/etc/nginx/conf.d/*.conf` included directly in `nginx.conf` |
| **Default error pages** | Plain Nginx | Fedora-styled pages under `/usr/share/nginx/html/` |
| **Node.js install options** | apt, NVM | amazon-linux-extras, NVM, yum |
| **Service control** | systemctl | systemctl |
| **Firewall defaults** | May use UFW | Typically rely on Security Groups |
| **Paths and permissions** | Edit with sudo in `/etc/nginx/sites-available` | Edit with sudo in `/etc/nginx/conf.d` (no `http {}` wrapping inside conf.d files) |

---

## Troubleshooting and issues faced (with fixes)

- **Nginx served Fedora 404 page:**
  - **Cause:** Config not loaded (wrong file name like `api.conf␣`, or wrong location).
  - **Fix:** Rename and ensure file is `/etc/nginx/conf.d/api.conf` without trailing spaces; run `sudo nginx -t` and `sudo systemctl reload nginx`.

- **Permission denied when editing Nginx configs:**
  - **Cause:** System directories owned by root.
  - **Fix:** Use `sudo nano /etc/nginx/...` or create in home then `sudo mv`.

- **Runner shows “idle”:**
  - **Cause:** No workflow running; idle is normal while waiting.
  - **Fix:** Push code to trigger; watch jobs in GitHub Actions tab.

- **Server logs show “port undefined”:**
  - **Cause:** `.env` missing or secrets not injected as `KEY=value`.
  - **Fix:** In workflow, write `echo "PORT=${{ secrets.PORT }}" >> .env`.

- **PM2 not found or path issues:**
  - **Cause:** Installed under different user env.
  - **Fix:** `npm install -g pm2`; ensure workflow restarts with `pm2 restart Backend || pm2 start server.js --name Backend`.

- **Nginx config structure error (Amazon Linux):**
  - **Cause:** Wrapping `server {}` inside `http {}` inside conf.d file.
  - **Fix:** Only use `server {}` in `/etc/nginx/conf.d/*.conf`.

- **Security Group blocks access:**
  - **Cause:** Missing HTTP inbound rule.
  - **Fix:** Add HTTP port 80 rule for 0.0.0.0/0.

---

## Operational tips and best practices

- **Use PM2 ecosystem file (optional):**
  ```json
  {
    "apps": [
      {
        "name": "Backend",
        "script": "server.js",
        "env": {
          "PORT": 8000
        }
      }
    ]
  }
  ```
  ```bash
  pm2 start ecosystem.config.js
  pm2 save
  ```

- **Enable PM2 startup on boot:**
  ```bash
  pm2 startup
  pm2 save
  ```

- **Validate Nginx before reload:**
  ```bash
  sudo nginx -t && sudo systemctl reload nginx
  ```

- **Secure SSH:** Restrict port 22 to your IP; consider key rotation and IAM roles.

- **Logs and monitoring:**
  ```bash
  pm2 logs Backend
  sudo journalctl -u nginx --since "1 hour ago"
  ```

- **Backups:** Keep a copy of Nginx configs and workflow files; version control them in your repo or infra repo.

---

## Appendix: Quick reference commands

- **Core EC2 connect:**
  ```bash
  ssh -i "your-key.pem" ubuntu@<public-ip>
  ```
- **System packages (Ubuntu):**
  ```bash
  sudo apt update && sudo apt-get install -y nodejs npm nginx
  ```
- **Runner setup:**
  ```bash
  mkdir actions-runner && cd actions-runner
  curl -o actions-runner-linux-x64-2.329.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.329.0/actions-runner-linux-x64-2.329.0.tar.gz
  tar xzf actions-runner-linux-x64-2.329.0.tar.gz
  ./config.sh --url https://github.com/<username>/<repo> --token <token>
  sudo ./svc.sh install && sudo ./svc.sh start
  ```
- **Nginx test & reload:**
  ```bash
  sudo nginx -t
  sudo systemctl reload nginx
  ```
- **PM2 lifecycle:**
  ```bash
  pm2 start server.js --name Backend
  pm2 restart Backend
  pm2 logs Backend
  pm2 list
  pm2 save
  pm2 startup
  ```

