# Communications OS Executive Cockpit (Redesign)

## Responsibilities
- Render an immutable `CommunicationViewModel` deterministically into an executive cockpit.
- Present executive-ready relationship health signals only (no inbox UI): hero health, conversation health, customer attention, risks, recommendations, and calm executive empty states.

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

