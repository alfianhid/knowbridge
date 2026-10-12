# Populate **real Google Docs + Google Sheets** with fictional content

This optional seeding utility creates *native Workspace files* in a separate folder. It is not a service-account importer, and never requires real company files. The contents are the local synthetic dataset produced by `python scripts/generate_seed.py`.

1. Sign into a **dedicated Google account you control**. Do not use an employer's production account or a shared client drive.
2. Upload `seed/generated/seed_bundle.json` to this account's Google Drive. Use Share > Copy link, and extract the file ID from its URL.
3. Open `https://script.google.com` > New project. Paste `Code.gs`, replace `BUNDLE_FILE_ID`, save.
4. In the editor select `seedStart`, click Run, then explicitly grant requested script permissions. The script requires broad Drive/Docs/Sheets permissions *because it creates files in your own test account*. This is **separate from** KnowBridge's limited user-facing `drive.file` OAuth scope.
5. `seedStart()` writes the first batch and installs a temporary time-driven trigger (every minute). Use `seedStatus()` to see the processed count and folder link. It self-removes after 192 files; actual time depends on Google quotas. `seedStop()` removes the trigger. Running `seedStart()` again resumes after a partial run.
6. Open the created folder; Google Docs and Sheets now exist, with their source IDs at the start of each title (e.g. `[KB:HBR-DOC-04]`). Select a handful with Google Picker when implemented.

**Safety:** Run this only in an isolated test account. Apps Script triggers consume Google Workspace quotas and can need manual reauthorization. Before running, scan the script and confirm the Drive ID. The content is entirely synthetic; do not represent it as customer-collected evidence.

**Demo fallback:** If the script fails or the account has quotas, develop against the local `seed/generated/docs/*.txt` and `seed/generated/sheets/*.csv` exports. The production app's source adapter should support both, but honestly describe the active demo mode.

**Known limitation:** Newly created Docs and Sheets have current Google Drive creation/modification timestamps. The **historical recorded date inside each document** is the authoritative simulated date. Never confuse these with Drive metadata timestamps in the decision engine.
