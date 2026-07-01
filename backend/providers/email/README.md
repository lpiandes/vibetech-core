# Email Providers (First Execution Provider)

This folder contains the first real execution provider for outbound communications:

- `EmailProvider` (abstract interface)
- `GmailProvider` (Gmail implementation using OAuth)

## Provider contract (what providers do)
Providers only **execute outbound email**. They:
1. `connect()` to an external system (OAuth)
2. `send({ communication })`
3. `disconnect()`

They return provider execution details such as:
- `providerMessageId`
- `providerStatus`
- `sentTimestampISO`

## Provider contract (what providers must NOT do)
Providers must NOT update the Company Runtime directly.
All business state changes are owned by `CommunicationEngine`.

That keeps:
- governance truth centralized
- timeline/activity updates consistent
- future provider swaps safe

## Gmail configuration
The provider reads OAuth credentials from environment variables:
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REDIRECT_URI`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_SENDER_EMAIL`

Never hardcode secrets.

## Future providers
Implement the same `EmailProvider` interface:
- `connect()`
- `send({ communication })`
- `disconnect()`

Then `CommunicationEngine.sendCommunication(...)` can execute the new provider without changing business state ownership.

