# Launch Acceptance Matrix (browser-oriented)

Manual / smoke checklist for live pilot. Mark each PASS/FAIL.

| # | Journey | Steps | Expect |
|---|---------|-------|--------|
| 1 | Architect creation | `/architect` → describe business → Begin | Session opens; no raw errors |
| 2 | Discovery resume | Leave and reopen `/architect/{id}` | Conversation + understanding restored |
| 3 | Research fail | Bad URL → Review website | Friendly failure; can continue |
| 4 | Proposal | Show me the plan | Proposal studio; no JSON |
| 5 | Dry-run / install | Prepare to launch → approve → launch | Human checklist; Mission Control openHref |
| 6 | Mission Control | `/b/{id}/home` installed | Living-business sections; evidence-only metrics |
| 7 | Owner invite | Settings/Team → invite OWNER | Email/link; accept → Mission Control |
| 8 | Employee invite | Invite EMPLOYEE | Limited modules only |
| 9 | Access request | Settings → request module → owner approve/reject | Status updates; no silent grant |
| 10 | Admin support | `/admin/support` enter → business → Exit in sidebar | Audited; banner + exit |
| 11 | Improvement | Ask VIBETech / Preview in Architect | Improves existing OS; dry-run→approve→install |
| 12 | Install revision | Approve revision | Stale approval shows recovery copy |
| 13 | Tenant isolation | User A cannot open `/b/{B}/…` | Denied / redirect |
| 14 | Multi-business | User with 2 memberships hits `/` | `/businesses` chooser (not `/platform`) |
| 15 | Health | `GET /api/health` | 200 + database ok |

## Automated gates

```bash
npm run db:test:setup
npm run test:platform
npm run test:journey
npm --prefix frontend run build:prod
git diff --check
```
