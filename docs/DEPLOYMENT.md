# VIBETech Production Deployment Checklist

Target app host: `app.vtechdevelopment.com`  
Do **not** migrate the marketing website in this train.

## Required environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `AUTH_SECRET` | frontend / auth | NextAuth JWT signing |
| `DATABASE_URL` | frontend (via backend pool) | Postgres connection |
| `DATABASE_URL_TEST` | CI / local tests | Isolated test DB |
| `NEXTAUTH_URL` | frontend | Canonical app URL (e.g. `https://app.vtechdevelopment.com`) |
| `INVITATION_EMAIL_FROM` | backend | From-address for invites |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | backend | Invitation email delivery |
| `INVITATION_DELIVERY_ENCRYPTION_KEY` | backend | Encrypt invite tokens at rest (falls back carefully — set in prod) |
| `NODE_ENV` | both | `production` |

Optional:
- `CORS_ORIGIN` (backend)
- `PORT` (backend if used)

## Database

```bash
# Apply migrations (production)
DATABASE_URL=postgresql://USER:PASS@HOST:5432/DB npm run db:migrate

# Local test DB
npm run db:test:setup
```

Migration policy: forward-only SQL under `backend/core/platform/db/migrations`. Never edit applied migrations; add a new numbered file.

## Startup

```bash
# App (Next.js)
cd frontend && npm run build:prod && NEXT_DIST_DIR=.next-prod npx next start -p 3000

# Or use your process manager with:
# cwd=frontend, command=`npx next start`, env from secrets manager
```

## Bootstrap platform admin

```bash
npm run platform:bootstrap-admin
```

## Health check

`GET /api/health` → `{ ok, database, status }`  
Expect HTTP 200 when DB is reachable; 503 when degraded.

## Auth

- Credentials provider via NextAuth
- `trustHost: true` for reverse proxies
- Set `NEXTAUTH_URL` to the public app URL

## Email / storage

- Configure SMTP for invitation delivery before live owner invites
- Document uploads in Architect use session text previews today — configure durable object storage before heavy production document volume
- Access requests use the existing in-process AccessRequestService store (requests reset on process restart). Acceptable for controlled pilot; promote to durable store before broad production scale

## Backup / rollback

- Nightly Postgres backups (full + WAL if available)
- Rollback: redeploy previous app image; DB roll-forward only (no destructive down migrations)
- Keep last known-good `AUTH_SECRET` and DB snapshot

## Post-deploy smoke

1. `GET /api/health`
2. Login as platform admin → `/admin`
3. Open `/architect` → start session
4. Install → `/b/{id}/home` Mission Control
5. Invite owner → accept invite
6. Support enter/exit from `/admin/support` and in-shell Exit
