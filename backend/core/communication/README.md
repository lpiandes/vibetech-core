# Digital Communication System v1

## Goal
Introduce outbound communications as **first-class business objects** in the Company Workspace.

This sprint implements the complete in-memory flow:
- create draft communication
- approve/reject communication
- simulate provider transitions (Sent, Delivered, Opened, Replied)

There are **no real providers** (no Gmail, no SMS).

## Key objects
- `Communication`: immutable business record for a single outbound communication.
- `CommunicationEngine`: creates drafts, updates status, logs communication activities, and updates the `CompanyWorkspaceRuntime`.

## Why employees create Communications (not send directly)
In the future, Digital Employees will:
1. produce the communication content (channel, subject, body, recipient)
2. mark the communication as requiring governance review
3. let the system transition the communication through provider steps

Providers (Gmail/SMS/etc.) will later plug in only at the final execution layer by calling the `CommunicationEngine` transition methods.

## Provider plug-in model
Future providers should:
- accept a `communicationId` / communication payload
- execute the external send/delivery/open/reply steps
- call `CommunicationEngine` to advance statuses

That keeps governance and business state centralized in the `CommunicationEngine`.

