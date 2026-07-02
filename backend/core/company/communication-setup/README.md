# Communication Setup (Sprint 5)

## Purpose
The **Communication Setup** capability layer provides deterministic readiness data for branded communications.

It derives communication identity, branding, default behaviors, quiet hours, and approval policy readiness from:
- `runtime.getCompanyProfile()` (Company Profile)
- `runtime.getBusinessProfile()` (Business Profile)
- `runtime.getApprovalRules()` (Company Runtime governance rules)

## Ownership
`CompanyWorkspaceRuntime` owns the derived snapshot.
It exposes it via `runtime.getCommunicationSetup()`.

The Capability Engine remains read-only and evaluates readiness from this snapshot.

## Compatibility with Communication Engine (future)
This setup prepares the fields that the existing `CommunicationEngine` will need:
- sender identity (`senderName`, `replyEmail`, `senderEmail`, `displayName`)
- email branding (`emailSignature`, `emailFooter`, colors, logo presence)
- SMS signature (`smsSignature`)
- quiet hours and approval policy defaults
- preferred channels and default tone/language

No sending occurs in this sprint.

