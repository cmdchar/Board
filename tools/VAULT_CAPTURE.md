# Vault Capture (global command)

Use this helper to push credentials/secrets from any IDE terminal directly into `board.private-driver.ro` vault.

## 1) Install global command

```powershell
powershell -ExecutionPolicy Bypass -File tools\install-vault-capture.ps1
. $PROFILE
```

This installs:
- `vault-capture`
- alias `vault-add`

## 2) Save connection once

```powershell
vault-capture --save-config --server https://board.private-driver.ro --email you@example.com --password yourPassword --source codex
```

Config is stored at:
- `%USERPROFILE%\.boardai-vault\config.json`

Validate saved auth:

```powershell
vault-capture --check-auth
```

Tip:
- You can generate a token directly from Board UI:
  - Dashboard -> `API Token` -> Generate -> Copy token.
- You can also review and revoke old tokens from the same modal (`Your API tokens` list).

## 3) Ingest examples

```powershell
vault-capture --project private-driver --text "OPENAI_API_KEY=sk-xxxx"
```

```powershell
@"
DB_USER=admin
DB_PASSWORD=SuperPass_123
API_URL=https://api.private-driver.ro
"@ | vault-capture --project private-driver
```

```powershell
vault-capture --project board --file .env
```

Explicit note/record mode (recommended for swarm run logs):

```powershell
vault-capture --project dracarys --scope project --category note --title "Swarm Run <run_id>" --notes "Prompt + final summary"
```

```powershell
vault-capture --project dracarys --scope project --category note --title "Swarm Run <run_id>" --notes-file .\run-note.txt
```

## Notes
- Endpoint used: `POST /api/vault/ingest`
- If project does not exist, ingest can auto-create it from project/workspace hint.
- Ingest uses upsert-by-natural-key (`scope + project + category + title`) to reduce duplicates.
