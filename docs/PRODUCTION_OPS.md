# VIBETech Pilot Production Operations

Target: `https://app.vtechdevelopment.com`  
Marketing site (`https://vtechdevelopment.com`) stays on Hostinger unchanged.

## Current infrastructure facts (validated 2026-07-11)

| Check | Result |
|-------|--------|
| `app.vtechdevelopment.com` DNS | **NXDOMAIN** — subdomain not created |
| `vtechdevelopment.com` | Resolves to Hostinger LiteSpeed `82.25.87.220` |
| SSH to Hostinger IP:22 | Timed out (shared hosting, not app VPS) |
| Local `.env.local` DB | `localhost:5432` only |
| SMTP / Resend | Not configured in local env |
| Neon account | Authenticated; **projects limit = 0** (cannot create prod DB from CLI) |
| Vercel | Logged in as `lpiandes`; no vibetech-core project yet |

## Required cutover (human + credentials)

Complete these before the app can go live on the target hostname:

1. **DNS** in Hostinger hPanel → Domains → DNS:
   - `A` or `CNAME` for `app` → your app host (Vercel CNAME or VPS IP)
2. **Postgres** (managed): Neon (upgrade plan), Supabase, RDS, or Hostinger VPS Postgres
3. **App host**: Vercel project for `frontend/` **or** Node VPS with systemd
4. **Secrets** (see `docs/env.production.example`)
5. **SMTP or Resend** for owner/employee invites
6. **Persistent volumes** for `KNOWLEDGE_STORAGE_ROOT` and `IMPORT_STORAGE_ROOT` (VPS) or accepted Vercel Blob follow-up

## Deploy sequence (once prerequisites exist)

```bash
# 0) Prerequisite gate
PILOT_BASE_URL=https://app.vtechdevelopment.com npm run pilot:gates

# 1) Migrate empty or existing production DB
DATABASE_URL='postgresql://…' npm run db:migrate

# 2) Bootstrap platform admin (once)
DATABASE_URL='postgresql://…' npm run platform:bootstrap-admin \
  -- --email admin@vtechdevelopment.com --password '…' --name 'VIBETech Admin'

# 3) Deploy app (Vercel example)
cd frontend
vercel link --yes --project vibetech-app
vercel env pull .env.production.local
# set all production env vars in Vercel dashboard
vercel --prod

# 4) Or VPS
cd frontend && npm run build:prod
NEXT_DIST_DIR=.next-prod npx next start -p 3000
```

## Verification checklist

- [ ] `https://app.vtechdevelopment.com` resolves + TLS certificate valid
- [ ] `GET /api/health` → 200 `{ ok: true, database: "ok" }`
- [ ] Login as platform admin → `/admin`
- [ ] Architect create → research → upload → propose → dry-run → approve → install
- [ ] Mission Control opens for installed business
- [ ] Invite owner → email delivered → accept → Mission Control
- [ ] Invite employee → login → limited modules → access request
- [ ] Owner approve → grant survives process restart
- [ ] Ask VIBETech → Preview → Dry Run → Approve → Install revision
- [ ] Tenant isolation: user A cannot open business B
- [ ] Storage write under knowledge/import roots persists after restart

## Daily operations

| Cadence | Action |
|---------|--------|
| Continuous | Uptime monitor on `/api/health` |
| Daily | Confirm invite email delivery (spot-check) |
| Daily | Disk usage on knowledge/import volumes |
| Nightly | Postgres backup + retain 7–30 days |
| Weekly | Review support-access audit events |
| Weekly | Confirm migrations applied = repo HEAD |

## Incident triage

1. Health 503 → database first (`DATABASE_URL`, connection limits)
2. Login loops → `NEXTAUTH_URL` / `AUTH_SECRET` / clock skew
3. Invites not arriving → Resend/SMTP credentials + spam folder + delivery audit
4. Upload failures → volume mount permissions / disk full
5. Partial install → Architect install status + support reference ID from product error banner
