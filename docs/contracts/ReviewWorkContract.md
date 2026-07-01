# ReviewWorkContract.md

## Purpose
Provide the Review Work page with all context required for safe governance so the user can answer:
**“Can I confidently approve this?”**

## Consumer
Frontend Workspace page: `frontend/app/work-queue/[id]/page.tsx` and its Review Work components.

## Producer
Backend Runtime “Review Work view” adapter for a specific Work item.

## Input model
`ReviewWorkRequest`
- `workspaceId` (string)
- `viewerId` (string)
- `workItemId` (string)
- `nowISO` (string; ISO-8601 timestamp)

## Output model
`ReviewWorkResponse`
- `caseSummary` (object)
  - `clientName` (string)
  - `matterType` (string)
  - `priority` (`High` | `Medium` | `Low`)
  - `status` (`Needs Review` | `Approved` | `Completed`)
  - `assignedEmployeeName` (string)
  - `createdTimeISO` (string; ISO-8601 timestamp)
- `attorneyNote` (string)
- `employeeThinking` (string)
- `draft` (Draft; see `RuntimeModels.md`)
- `approval` (ApprovalRequest; see `RuntimeModels.md`)
- `communication` (CommunicationView; see `CommunicationTypes.md` in `backend/core/communication/` for first-class outbound communication)
- `activities` (Activity[]; optional; for future “audit-style” display)

### ApprovalRequest (portion of `ReviewWorkResponse`)
The UI expects to be able to represent:
- what type of approval is required
- current approval status label
- which primary governance action is appropriate

## Loading states
Use the reading-order skeleton:
1. Header
2. Case summary card placeholder
3. Attorney note placeholder
4. Employee thinking placeholder
5. Draft preview placeholder
6. Approval status + actions placeholder

## Empty states
Empty states should not suggest the work is missing silently.
Use explicit mappings:
- If `workItemId` is unknown:
  - show a “Not found / unavailable” empty-state style message
  - avoid showing partial governance context.

## Error states
- If the runtime cannot provide the full context:
  - show a clear error message for the affected sections
  - keep approval actions disabled unless `approval` is present and valid.

## Mock-to-runtime migration strategy
1. Define a mock `ReviewWorkResponse` that matches the output model exactly.
2. As runtime becomes available:
   - map runtime `WorkItem` + related context into `caseSummary`
   - map runtime-generated recommendation/thinking into `employeeThinking`
   - map the current draft content into `draft`
   - map governance outputs into `approval`
3. Keep mock placeholders only for any fields not supported by runtime yet; never change the overall response shape.

