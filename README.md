# BoardAI Whiteboard

Whiteboard platform (`frontend` + `backend`) used for `board.private-driver.ro`.

## API Token Management

Authenticated users can manage integration tokens from Dashboard (`API Token` button).

Endpoints:
- `POST /api/auth/token`
  - Creates a new API token.
  - Body: `{ "name"?: string, "expiresInDays"?: number }`
  - Returns token once (`token`, `tokenType`, `id`, `name`, `expiresInDays`, `expiresAt`).
  - Security: requests authenticated with an existing API token (`token_type: "api"`) are rejected (`403`).
- `GET /api/auth/tokens`
  - Returns token metadata list for the current user (`items`).
- `DELETE /api/auth/tokens/:tokenId`
  - Revokes an existing token by id.

Notes:
- Token values are shown only at creation time; keep them in a secure vault.
- Use `tools/VAULT_CAPTURE.md` for CLI ingest workflows.
