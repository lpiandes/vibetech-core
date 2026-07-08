# Interaction Runtime (Universal)

`InteractionRuntime` stores canonical business interaction history (meaning + notes + outcomes + follow-up commitments)
separately from `CommunicationRuntime` (thread/message delivery state).

Mutation happens only through `InteractionRuntime.applyEvent(...)`.
