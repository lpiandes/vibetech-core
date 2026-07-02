# Communication Rendering Framework (Epic 13 Sprint 3)

## Responsibilities
- Render an immutable `CommunicationViewModel` deterministically.
- Present executive-ready communications: summary, queues, threads, messages, attention, and recommended actions.

## Rendering Rules
- React is presentation only.
- Components must not access `CommunicationRuntime`, `WorkRuntime`, `TeamRuntime`, or any providers.
- Components must not draft or send messages.

## Relationships
- `CommunicationViewModel` is the canonical input for the entire rendering framework.

## Future Extensions (out of scope for this sprint)
- Providers (Gmail/Twilio/etc.)
- AI drafting and message composition
- Approvals and approval routing
- Mission Control integration

