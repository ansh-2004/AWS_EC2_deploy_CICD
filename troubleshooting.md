
# 📘 Deployment Documentation Errors Faced : Node.js on Amazon EC2 with GitHub Actions

## 1. Nginx Configuration Problems
- **Missing `sites-available` folder**  
  - *Ubuntu:* Uses `/etc/nginx/sites-available` and `/etc/nginx/sites-enabled`.  
  - *Amazon Linux:* Uses `/etc/nginx/conf.d/*.conf`.  
  - *Error faced:* Couldn’t find `sites-available` on Amazon Linux.  
  - *Fix:* Created `api.conf` inside `/etc/nginx/conf.d/`.

- **Wrong block structure**  
  - *Error faced:* Added `http {}` block inside `api.conf`.  
  - *Fix:* Removed outer `http {}` wrapper; only `server {}` blocks are allowed in `conf.d`.

- **Default Fedora 404 page**  
  - *Error faced:* Nginx served `/usr/share/nginx/html/404.html`.  
  - *Cause:* Config file had a trailing space in its name (`api.conf␣`), so Nginx ignored it.  
  - *Fix:* Renamed file to `api.conf` and reloaded Nginx.

---

## 2. File Permission Errors
- **Permission denied when saving config**  
  - *Error faced:* Couldn’t save `api.conf` in `/etc/nginx/conf.d/`.  
  - *Cause:* Directory owned by root.  
  - *Fix:* Used `sudo nano /etc/nginx/conf.d/api.conf` or created file in home directory and moved with `sudo mv`.

---

## 3. PM2 and Node.js Issues
- **`pm2: command not found` in GitHub Actions runner**  
  - *Cause:* PM2 installed under user environment (via NVM), runner didn’t see it.  
  - *Fix:* Installed PM2 globally (`npm install -g pm2`) or added NVM path to `$GITHUB_PATH`.

- **Error when installing PM2 with `sudo`**  
  - *Cause:* NVM paths not available to root.  
  - *Fix:* Installed PM2 without sudo as `ec2-user`.

- **Backend logs showed `Server is running on port undefined`**  
  - *Cause:* secrets weren’t injected correctly.  
  - *Fix:* Corrected GitHub Actions workflow to write secrets in `KEY=value` format:
    ```yaml
    echo "PORT=${{ secrets.PORT }}" >> .env
    ```

---

## 4. GitHub Actions Workflow Errors
- **Secrets syntax wrong**  
  - *Error faced:* `.env` contained literal `{{ secrets.prod }}` instead of actual secret.  
  - *Fix:* Used `${{ secrets.NAME }}` instead of `{{ secrets.NAME }}`.

- **Runner status “idle”**  
  - *Cause:* Self‑hosted runner only runs jobs when triggered; “idle” means waiting.  
  - *Fix:* Confirmed this is normal behavior.

---

## 5. Networking & Security Group Issues
- **Couldn’t access API via public IP**  
  - *Cause:* EC2 Security Group didn’t allow inbound HTTP traffic.  
  - *Fix:* Added inbound rule for port 80 (`HTTP`, source `0.0.0.0/0`).

---

# 🆚 Differences Between Ubuntu and Amazon Linux 2

| Feature | **Ubuntu** | **Amazon Linux 2** |
|---------|------------|---------------------|
| **Nginx config layout** | Uses `/etc/nginx/sites-available` + symlinks in `/etc/nginx/sites-enabled`. | Uses `/etc/nginx/conf.d/*.conf` included directly in `nginx.conf`. |
| **Default error pages** | Ubuntu’s Nginx shows a plain default 404. | Amazon Linux ships Fedora‑style branded error pages (`/usr/share/nginx/html/404.html`). |
| **Package manager** | `apt` | `yum` (based on CentOS/RHEL). |
| **Node.js installation** | Often via `apt` or NVM. | Typically via NVM or Amazon Linux Extras (`amazon-linux-extras install nodejs`). |
| **Service management** | `systemctl` (same on both). | `systemctl` (same on both). |
| **File permissions** | Editing configs often done with `sudo nano /etc/nginx/sites-available/...`. | Same, but configs live in `/etc/nginx/conf.d/`. |
| **Default user** | `ubuntu` | `ec2-user`. |
| **Default firewall** | UFW (can be enabled). | Relies on AWS Security Groups (no UFW by default). |

---

# ✅ Final Working Setup
- Backend running under PM2 (`pm2 list` shows `Backend` online).  
- Nginx proxy config in `/etc/nginx/conf.d/api.conf` forwarding `/api` to `localhost:8000`.  
- Security Group allows inbound HTTP traffic.  

---

