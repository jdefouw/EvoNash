---
description: How to build and deploy the EvoNash web application
---

# Build and Deploy EvoNash

> **Dev environment:** Windows + PowerShell (no local dev server)
> **Server:** Debian Linux at `/opt/evonash`

## Deploy to Server

SSH into the server and run:

```bash
git config --global --add safe.directory /opt/evonash; cd /opt/evonash && git pull && cd web && npm install && npm run build && nohup npm run start > /tmp/evonash.log 2>&1 &
```

### If the old process is still running:

```bash
pkill -f "next start" || true
cd /opt/evonash && git pull && cd web && npm install && npm run build && nohup npm run start > /tmp/evonash.log 2>&1 &
```

## Notes
- The live site is at https://sf.defouw.ca/
- There is **no local dev environment** — all testing happens on the server
- Git push from Windows first (`/git-commit`), then deploy on the server
