# VIBETech Production Rollback

## Principles

- Prefer **app rollback** over database rollback.
- Database migrations are **forward-only** (`backend/database/migrations/*.sql`).
- Never run destructive down-migrations in production.
- Keep the previous known-good app deployment and `AUTH_SECRET` available.

## App rollback (Vercel)

```bash
cd frontend
vercel ls
vercel rollback <DEPLOYMENT_URL_OR_ID> --yes
```

Or promote the previous production deployment from the Vercel dashboard.

## App rollback (VPS / Node)

```bash
# Keep previous build artifact
# e.g. .next-prod.previous from last deploy script
systemctl stop vibetech-app
rm -rf frontend/.next-prod
mv frontend/.next-prod.previous frontend/.next-prod
systemctl start vibetech-app
curl -fsS https://app.vtechdevelopment.com/api/health
```

## Database

| Situation | Action |
|-----------|--------|
| Bad app release, DB schema unchanged | App rollback only |
| Migration applied, app incompatible | **Forward-fix** with a new migration + hotfix deploy |
| Data corruption | Restore Postgres from last nightly backup into a **new** database, validate, then cut `DATABASE_URL` |

### Restore outline

1. Snapshot current DB (even if bad) for forensics.
2. Restore backup to `vibetech_restore_YYYYMMDD`.
3. Point a staging app at restore DB; run smoke matrix.
4. Maintenance window: swap `DATABASE_URL`, redeploy app.
5. Invalidate sessions if `AUTH_SECRET` rotated.

## Storage volumes

- Knowledge/import object files are **not** in Postgres.
- Restore volume snapshots alongside DB when recovering uploads/imports.
- If volume lost but DB intact: documents show metadata without bytes — re-upload.

## Auth / secrets rollback

- If `AUTH_SECRET` was rotated and must revert: redeploy previous secret **and** expect existing sessions to invalidate either way.
- Do not commit secrets; restore from secrets manager.

## Invite / email rollback

- Failed SMTP does not delete invitation rows.
- After fixing Resend/SMTP, use **Resend invite** in Team settings.
- Dev mailbox is never used in production.

## Decision tree

```
Issue after deploy?
├─ Health failing → check DB, then app logs; rollback app if new build only
├─ Feature broken, schema OK → vercel rollback / previous .next-prod
├─ Migration caused break → hotfix forward migration (do not down-migrate)
└─ Data loss suspected → stop writes, snapshot, restore from backup
```

## Post-rollback verification

1. `/api/health` = 200
2. Admin login
3. Open one installed business Mission Control
4. Create a throwaway Architect session (do not install) to confirm Builder
5. Send a test invite to an internal inbox
