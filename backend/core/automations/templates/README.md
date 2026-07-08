# Automation Templates

Templates describe reusable automation behavior that can be installed into a business workspace.

Templates are **not** canonical runtime state. Installation produces an `AutomationDefinition` registered through `AutomationRuntime.applyEvent(AUTOMATION_REGISTERED)`.

## Install boundary

```
AutomationTemplate
  → validate + resolve configuration
  → canonical AutomationDefinition
  → AutomationRuntime.applyEvent(...)
```

Workspace/demo configuration uses `install/WorkspaceAutomationInstaller.js` to install templates without mutating Core defaults.

## Universal template

`tpl_outcome_creates_work` — when a configured canonical outcome matches, create work using constrained configuration keys (outcome, workType, stage, queue, etc.).

Value resolution for event/interaction fields happens at orchestration time via `AutomationValueResolver`.
