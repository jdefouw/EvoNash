---
description: How to build and deploy the EvoNash web application
---

# Build and Deploy EvoNash

> **Dev environment:** Windows + PowerShell (no local dev server)
> **Server:** Debian Linux at `/opt/evonash`

## Deploy to Server

The web app runs under PM2 (see `web/ecosystem.config.js`). SSH into the server and run:

```bash
git config --global --add safe.directory /opt/evonash
cd /opt/evonash && git pull && cd web && npm install && npm run build && pm2 restart evonash
```

To watch the rolling logs:

```bash
pm2 logs evonash
```

## Notes
- The live site is at https://sf.defouw.ca/
- There is **no local dev environment** — all testing happens on the server
- Git push from Windows first (`/git-commit`), then deploy on the server
- PM2 process metadata: `~/.pm2/dump.pm2` — `pm2 save` after any topology change
