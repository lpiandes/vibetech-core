# Universal Automation Engine (Epic 15)

This folder implements the backend deterministic foundation for Universal Automations:

- `AutomationRuntime`: owns canonical automation definitions + run history + deterministic metrics
- `AutomationRuleEngine`: read-only deterministic evaluation of platform events against automation definitions
- `AutomationEventSubscriber`: thin PlatformEvent bus subscriber that delegates to orchestration
- `AutomationOrchestrationService`: bounded orchestration that creates runs, plans actions, and executes supported bounded executors
