# Windows + Codex quick start

1. Install Node.js 22, Python 3.11+ and Git (if not installed). Open the unzipped **knowbridge-codex-starter** folder in VS Code or your preferred Codex-connected editor. Alternatively run Codex CLI from the folder.
2. Run in PowerShell:

```powershell
cd .\knowbridge-codex-starter
py -3 scripts\verify_seed.py
npm install
npm test
npm run dev
```

3. Open `http://localhost:3000` and check `http://localhost:3000/api/health` (will truthfully report `aiEnabled:false`).
4. In Codex, ask it to read and follow **`prompts/00-START-HERE.md`**. The root `AGENTS.md` is automatically available to compatible Codex workflows.
5. Let Codex implement the stages in order, testing after each. Do not switch to P1 Workspace OAuth until core retrieval and Decision Brief are real and stable.
6. Optional: publish to a new GitHub repository (ensure `.env.local`/keys are ignored). Connect the Google Cloud project with Google Cloud CLI when you reach deployment.

If `npm install` is blocked by your company proxy/firewall, fix package registry connectivity before asking Codex to debug application code. The provided starter was not fully tested by npm install in the package-generation environment.
