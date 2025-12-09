
# 🚀 Automate Node.js Deployment to AWS EC2 using GitHub Actions CI/CD

## 📦 1. Create and Push Node.js Project
- Initialize a Node.js project.
- Add a valid `start` script in `package.json`.
- Push the project to a GitHub repository.

---

## 🖥️ 2. Launch EC2 Instance
- Launch an EC2 instance with **Ubuntu**.
- Generate and download a key pair (`.pem` file).
- Configure Security Group:
  - Allow SSH (port 22).
  - Allow HTTP (port 80).

---

## 🔗 3. Connect to EC2
Open terminal in the folder containing your `.pem` file and connect:

```bash
ssh -i "your-key.pem" ubuntu@your-ec2-public-ip
```

---

## ⚙️ 4. Set Up GitHub Actions Workflow
- Go to GitHub → Actions tab → Select Node.js CI.
- Modify workflow:
  - Trigger only on `push` to `main`.
  - Remove `npm build` and `npm test` if not needed.
  - Set `runs-on: self-hosted`.
- Commit changes.

---

## 🧑‍💻 5. Configure Self-Hosted Runner on EC2
On GitHub: Settings → Actions → Runners → Add self-hosted runner → Linux.  
On EC2 terminal:

```bash
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64-2.329.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.329.0/actions-runner-linux-x64-2.329.0.tar.gz
echo "<hash>  actions-runner-linux-x64-2.329.0.tar.gz" | shasum -a 256 -c
tar xzf actions-runner-linux-x64-2.329.0.tar.gz
./config.sh --url https://github.com/<your-username>/<your-repo> --token <your-token>
sudo ./svc.sh install
sudo ./svc.sh start
```

---

## 📁 6. Verify Project Files
Navigate to your project folder:

```bash
cd ~/actions-runner/_work/<your-project-folder>
ls -la
```

---

## 🛠️ 7. Install Dependencies
```bash
sudo apt update
sudo apt-get install -y nodejs npm nginx
sudo npm install -g pm2
```

---

## 🌐 8. Configure Nginx Reverse Proxy
Edit default config:

```bash
sudo nano /etc/nginx/sites-available/default
```

Add inside `location /` block:

```nginx
location /api {
    rewrite ^/api/(.*)$ /api/$1 break;
    proxy_pass http://localhost:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

Restart Nginx:

```bash
sudo systemctl restart nginx
```

---

## 🚀 9. Start Backend with PM2
```bash
pm2 start server.js --name="Backend"
```

---

## 🌍 10. Test Deployment
Visit:

```
http://<your-ec2-public-ip>/api/get
http://<your-ec2-public-ip>/api/home
```

You should see your API response.

---

## 🔄 11. Automate Deployment on Push
In `.github/workflows/node.js.yml`, add:

```yaml
- run: pm2 restart Backend
```

---

## 🔐 12. Handle Environment Variables
- Add `.env` to `.gitignore`.
- In GitHub → Settings → Secrets → Actions:
  - Create secret named `prod`.
  - Paste your `.env` content.
- In workflow file:

```yaml
- run: |
    touch .env
    echo "${{ secrets.prod }}" > .env
```

---

## ✅ Final Result
- Node.js app deployed to EC2.
- Every push to GitHub triggers automatic deployment.
- Environment variables securely managed.

---


