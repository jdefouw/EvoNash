---
description: How to build and deploy the EvoNash web application
---

# Build & Deploy

> **IMPORTANT**: There is NO local dev environment. Node/npm are not installed locally.
> The project only builds and runs on the remote server.
> Do NOT attempt `npm run build`, `npm run dev`, or any npm/node commands locally — they will fail.

## Verification Strategy

Since there is no local build environment:
- Rely on TypeScript type checking via IDE lint feedback to catch compile errors
- Push changes to the server for actual build verification
- Use the browser tool to verify the deployed dashboard visually
