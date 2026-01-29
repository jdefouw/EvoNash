# EvoNash Debian 13.3.0 Server Setup Guide

This guide covers the complete setup of EvoNash on a standalone Debian 13.3.0 server at `sf.defouw.ca`.

## Prerequisites

- Fresh Debian 13.3.0 (Trixie) installation
- Root or sudo access
- Domain `sf.defouw.ca` pointing to your server's IP address
- Open ports: 22 (SSH), 80 (HTTP), 443 (HTTPS)

---

## Part 1: System Preparation

### 1.1 Update System

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential
```

### 1.2 Create Application User

```bash
sudo useradd -m -s /bin/bash evonash
sudo mkdir -p /opt/evonash
sudo chown evonash:evonash /opt/evonash
```

---

## Part 2: PostgreSQL 16 Installation

### 2.1 Add PostgreSQL Repository

```bash
sudo apt install -y gnupg2 wget lsb-release

# Add PostgreSQL GPG key
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg

# Add repository
echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list
```

### 2.2 Install PostgreSQL

```bash
sudo apt update
sudo apt install -y postgresql-16 postgresql-contrib-16
```

### 2.3 Start and Enable PostgreSQL

```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
sudo systemctl status postgresql
```

### 2.4 Create Database and User

```bash
sudo -u postgres psql
```

Run these SQL commands (replace `your_secure_password` with a strong password):

```sql
-- Create user
CREATE USER evonash WITH PASSWORD 'your_secure_password';

-- Create database
CREATE DATABASE evonash OWNER evonash;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE evonash TO evonash;

-- Connect to the database
\c evonash

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO evonash;

-- Exit
\q
```

### 2.5 Configure PostgreSQL for Local Connections

Edit `/etc/postgresql/16/main/pg_hba.conf`:

```bash
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

Ensure this line exists for local connections:

```
local   evonash         evonash                                 md5
host    evonash         evonash         127.0.0.1/32            md5
```

Restart PostgreSQL:

```bash
sudo systemctl restart postgresql
```

### 2.6 Apply Database Schema

```bash
# Switch to evonash user
sudo -u evonash -i

# Navigate to project
cd /opt/evonash

# Apply schema (after cloning project)
psql -U evonash -d evonash -f web/lib/sql/schema_standalone.sql
```

---

## Part 3: Node.js 20 LTS Installation

### 3.1 Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 3.2 Verify Installation

```bash
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x
```

### 3.3 Install PM2 Globally

```bash
sudo npm install -g pm2
```

---

## Part 4: nginx Installation and Configuration

### 4.1 Install nginx

```bash
sudo apt install -y nginx
```

### 4.2 Create nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/evonash
```

Paste the following configuration:

```nginx
server {
    listen 80;
    server_name sf.defouw.ca;

    # Redirect HTTP to HTTPS (uncomment after SSL setup)
    # return 301 https://$server_name$request_uri;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings for long-running requests
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
        proxy_connect_timeout 60s;
        
        # Allow large payloads (checkpoints, results)
        client_max_body_size 50M;
    }
}
```

### 4.3 Enable Site and Test Configuration

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/evonash /etc/nginx/sites-enabled/

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
sudo systemctl enable nginx
```

---

## Part 5: SSL Certificate (Let's Encrypt)

### 5.1 Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 5.2 Obtain SSL Certificate

```bash
sudo certbot --nginx -d sf.defouw.ca
```

Follow the prompts:
- Enter email address for renewal notifications
- Agree to terms of service
- Choose whether to redirect HTTP to HTTPS (recommended: yes)

### 5.3 Verify Auto-Renewal

```bash
sudo certbot renew --dry-run
```

### 5.4 Updated nginx Configuration (After SSL)

Certbot will automatically update your nginx config. The final config should look like:

```nginx
server {
    listen 80;
    server_name sf.defouw.ca;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name sf.defouw.ca;

    ssl_certificate /etc/letsencrypt/live/sf.defouw.ca/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sf.defouw.ca/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
        proxy_connect_timeout 60s;
        client_max_body_size 50M;
    }
}
```

---

## Part 6: Application Deployment

### 6.1 Clone Repository

```bash
sudo -u evonash -i
cd /opt/evonash
git clone https://github.com/your-repo/EvoNash.git .
```

Or copy files from your local machine:

```bash
# From your local machine
scp -r ./web ./worker evonash@sf.defouw.ca:/opt/evonash/
```

### 6.2 Configure Environment Variables

```bash
cd /opt/evonash/web
cp .env.example .env
nano .env
```

Edit `.env` with your settings:

```bash
DATABASE_URL=postgresql://evonash:your_secure_password@localhost:5432/evonash
NODE_ENV=production
PORT=3000
```

### 6.3 Install Dependencies

```bash
cd /opt/evonash/web
npm install
```

### 6.4 Build Application

```bash
npm run build
```

### 6.5 Apply Database Schema

```bash
cd /opt/evonash/web/lib/sql
psql -U evonash -d evonash -f schema_standalone.sql
```

### 6.6 Start Application with PM2

```bash
cd /opt/evonash/web
pm2 start ecosystem.config.js
pm2 save
```

### 6.7 Configure PM2 Startup

```bash
pm2 startup systemd -u evonash --hp /home/evonash
# Run the command it outputs
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u evonash --hp /home/evonash
```

---

## Part 7: Systemd Service (Alternative to PM2)

If you prefer systemd over PM2:

### 7.1 Create Service File

```bash
sudo nano /etc/systemd/system/evonash.service
```

```ini
[Unit]
Description=EvoNash Web Application
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=evonash
Group=evonash
WorkingDirectory=/opt/evonash/web
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node .next/standalone/server.js
Restart=on-failure
RestartSec=10

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=evonash

[Install]
WantedBy=multi-user.target
```

### 7.2 Enable and Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable evonash
sudo systemctl start evonash
sudo systemctl status evonash
```

---

## Part 8: Firewall Configuration

### 8.1 Configure UFW

```bash
sudo apt install -y ufw

# Allow SSH
sudo ufw allow ssh

# Allow HTTP and HTTPS
sudo ufw allow 'Nginx Full'

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## Part 9: Monitoring and Logs

### 9.1 View Application Logs

```bash
# PM2 logs
pm2 logs evonash

# Or systemd logs
sudo journalctl -u evonash -f
```

### 9.2 View nginx Logs

```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 9.3 View PostgreSQL Logs

```bash
sudo tail -f /var/log/postgresql/postgresql-16-main.log
```

---

## Part 10: Maintenance

### 10.1 Update Application

```bash
cd /opt/evonash
git pull

cd web
npm install
npm run build

pm2 restart evonash
# Or: sudo systemctl restart evonash
```

### 10.2 Database Backup

```bash
# Create backup
pg_dump -U evonash evonash > /opt/evonash/backups/evonash_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
psql -U evonash evonash < backup_file.sql
```

### 10.3 SSL Certificate Renewal

Certbot automatically renews certificates. To manually renew:

```bash
sudo certbot renew
sudo systemctl reload nginx
```

---

## Troubleshooting

### Application Won't Start

```bash
# Check PM2 status
pm2 status
pm2 logs evonash --lines 50

# Check if port 3000 is in use
sudo lsof -i :3000

# Check Node.js can connect to PostgreSQL
cd /opt/evonash/web
node -e "const { Pool } = require('pg'); const p = new Pool({connectionString: process.env.DATABASE_URL}); p.query('SELECT 1').then(() => console.log('OK')).catch(console.error)"
```

### nginx Returns 502 Bad Gateway

```bash
# Check if application is running
pm2 status

# Check nginx error log
sudo tail -f /var/log/nginx/error.log

# Verify proxy configuration
sudo nginx -t
```

### Database Connection Issues

```bash
# Test connection
psql -U evonash -d evonash -c "SELECT 1;"

# Check PostgreSQL is running
sudo systemctl status postgresql

# Check pg_hba.conf
sudo cat /etc/postgresql/16/main/pg_hba.conf | grep evonash
```

---

## Quick Reference

| Service | Command |
|---------|---------|
| Start app | `pm2 start evonash` or `sudo systemctl start evonash` |
| Stop app | `pm2 stop evonash` or `sudo systemctl stop evonash` |
| Restart app | `pm2 restart evonash` or `sudo systemctl restart evonash` |
| View logs | `pm2 logs evonash` or `sudo journalctl -u evonash -f` |
| Start nginx | `sudo systemctl start nginx` |
| Reload nginx | `sudo systemctl reload nginx` |
| Start PostgreSQL | `sudo systemctl start postgresql` |

---

## Server Specifications

- **Hostname:** sf.defouw.ca
- **Database:** PostgreSQL 16
- **Runtime:** Node.js 20 LTS
- **Process Manager:** PM2
- **Reverse Proxy:** nginx
- **SSL:** Let's Encrypt (Certbot)
