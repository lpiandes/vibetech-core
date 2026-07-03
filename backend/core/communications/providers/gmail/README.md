# Gmail Communication Provider Adapter (Epic 13 Sprint 5)

## Purpose
`GmailCommunicationProvider` adapts a canonical `CommunicationMessage` into a Gmail outbound email send request.

It answers:
**“How does Gmail execute an outbound email communication?”**

## Ownership boundaries
- `CommunicationRuntime` owns communication state.
- The provider only executes external delivery.
- It does not mutate `CommunicationRuntime`.
- It does not decide whether to send.
- It does not draft content.

## Configuration
The provider uses these environment variables for OAuth:
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REDIRECT_URI`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_SENDER_EMAIL`

If any are missing:
- `health` reports `not_configured`
- `send(...)` fails deterministically with a clear error

## Testing
Tests must not send real emails. The Gmail client is mocked/injected.

