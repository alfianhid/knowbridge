# Windows + Codex quick start

1. Install Node.js **22.18+**, Python **3.11+** and Git. Open the cloned **KnowBridge repository root**, containing `package.json`, in your editor and PowerShell.
2. Run in PowerShell:

```powershell
Set-Location C:\Users\User\KnowBridge # Replace with your clone's absolute path.
python scripts/verify_seed.py
npm.cmd ci
$env:KNOWBRIDGE_STORE="file"
$env:KNOWBRIDGE_RETRIEVAL="local"
npm.cmd run ingest:local
npm.cmd test
npm.cmd run dev
```

3. Open `http://localhost:3000`. The default Harbour import contains 18 fictional sources. Before ingestion, a new file store shows an empty catalog. Keep both mode variables set in the same shell: they override any existing cloud `.env`, so ingestion and app reads use the same local store. `ingest:local` alone does not select a backend.

4. Check `http://localhost:3000/api/health`: file/local mode reports `aiEnabled:false`. Valid Vertex/Firestore configuration reports `aiEnabled:true`; `connectivityVerified:false` means health does not test service connectivity. Invalid configuration returns 503. Cloud setup is separate: follow [retrieval](RETRIEVAL.md) and [deployment](DEPLOYMENT.md), including explicit `node --env-file=.env` CLI commands. Use a fresh shell or set both modes explicitly when switching.

If `python` cannot locate Python 3.11+, use `py -3.11 scripts/verify_seed.py` or the installed interpreter path. The known per-user installation is:

```powershell
& "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe" scripts/verify_seed.py
```

Use `npm.cmd` and `npx.cmd` to avoid PowerShell's `npm.ps1` script-policy restriction. For browser checks, build and ingest first, then run `npx.cmd playwright install chromium` and `npm.cmd run test:e2e`.
5. Follow the staged prompts from **`prompts/00-START-HERE.md`**. Core retrieval and Decision Brief gates precede P1 OAuth. [Current readiness](READINESS.md) links dated verification and open requirements.

If installation is blocked, resolve registry connectivity first. Historical implementation runs are recorded in [Phase 2 results](PHASE2-RESULTS.md); later cloud smoke checks are in [cloud results](CLOUD-PHASE2-RESULTS.md). These reports do not establish complete semantic accuracy or deployed write/review readiness.
