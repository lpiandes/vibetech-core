# VIBETech Production Deployment Checklist

Target app host: `https://app.vtechdevelopment.com`
Do **not** migrate the marketing website in this train.

## Required environment variables

Copy from `docs/env.production.example`.

| Variable | Purpose |
|----------|---------|
| `AUTH_SECRET` | NextAuth JWT signing |
| `DATABASE_URL` | Postgres connection |
| `NEXTAUTH_URL` | `https://app.vtechdevelopment.com` |
| `APP_URL` | Same public app URL |
| `INVITATION_EMAIL_FROM` | From-address for invites |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Invitation email delivery (or `RESEND_API_KEY`) |
| `INVITATION_DELIVERY_ENCRYPTION_KEY` | Encrypt invite tokens at rest |
| `KNOWLEDGE_STORAGE_ROOT` | Durable volume for knowledge + Architect uploads |
| `IMPORT_STORAGE_ROOT` | Durable volume for CRM import artifacts |
| `NODE_ENV` | `production` |

Optional: `OBJECT_STORAGE_ROOT` (alias for knowledge root), `CORS_ORIGIN`, `PORT`.

## Database (empty database → production)

```bash
# Apply all migrations from an empty database
DATABASE_URL=postgresql://USER:PASS@HOST:5432/DB npm run db:migrate

# Verify empty-DB migrate in CI/local
npm run db:test:setup
```

Migration files live in `backend/database/migrations/*.sql` (forward-only).
Never edit applied migrations; add a new numbered file.

## Startup

```bash
cd frontend
npm run build:prod
NEXTAUTH_URL=https://app.vtechdevelopment.com \
APP_URL=https://app.vtechdevelopment.com \
NEXT_DIST_DIR=.next-prod \
npx next start -p 3000
```

## Bootstrap platform admin

```bash
npm run platform:bootstrap-admin
```

## Health check

`GET https://app.vtechdevelopment.com/api/health` → `{ ok, database, status }`
Expect HTTP 200 when DB is reachable; 503 when degraded.

## Auth

- Credentials provider via NextAuth
- `trustHost: true` for reverse proxies
- Set `NEXTAUTH_URL` to the public app URL

## Email

- Prefer Resend (`RESEND_API_KEY`) or SMTP (`SMTP_HOST`…)
- In production without either, invites are saved but email reports `email_not_configured` (copyable link still available in admin/dev flows)
- Configure SMTP/Resend before first customer owner invites

## Object storage (uploads)

- V1 uses durable local filesystem object storage (knowledge + import + Architect upload bytes)
- Mount persistent volumes at `KNOWLEDGE_STORAGE_ROOT` and `IMPORT_STORAGE_ROOT`
- Architect discovery uploads store bytes when provided (`contentBase64`) and keep session evidence in Postgres

## Access requests

- Durable in Postgres table `business_access_requests` (survives process restart)
- Approvals can update membership roles via existing membership APIs

## Backup / rollback

- Nightly Postgres backups (full + WAL if available)
- Backup storage volumes with the database
- Rollback: redeploy previous app image; DB roll-forward only
- Keep last known-good `AUTH_SECRET` and DB snapshot

## Post-deploy smoke

1. `GET /api/health`
2. Login as platform admin → `/admin`
3. Open `/architect` → start session → upload a small text file → resume after refresh
4. Install → `/b/{id}/home` Mission Control
5. Invite owner (confirm SMTP delivery) → accept invite
6. Employee access request → owner approve → role/module grant persists after restart
7. Support enter/exit from `/admin/support` and in-shell Exit
8. Recommendation → Preview → Dry Run → Approve → Install
