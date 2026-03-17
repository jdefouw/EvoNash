---
description: Git add, commit, and push changes (PowerShell on Windows)
---

# Git Add, Commit, Push

> **Environment:** Windows + PowerShell. Do NOT use `&&` to chain commands — PowerShell doesn't support it. Run each command separately.

// turbo
1. Stage all changes:
```powershell
git add -A
```

// turbo
2. Check what's staged:
```powershell
git status
```

3. Commit with a descriptive message:
```powershell
git commit -m "your commit message here"
```

4. Push to remote:
```powershell
git push
```

## Notes
- Working directory: `c:\Users\matt\Documents\Programming\EvoNash`
- Server deployment is separate — see `/build-and-deploy`
