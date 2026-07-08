# Universal Industry Package System

Industry packages turn VIBETech Core into industry-specific Business Operating Systems through **configuration and installation** — not Core code changes.

## Contract

- `IndustryPackage` — frozen package definition (terminology, capabilities, automations, knowledge, etc.)
- `IndustryPackageInstaller` — orchestrates bounded installers; does not own canonical state
- `IndustryPackageInstallationRuntime` — in-memory installation facts (future: durable persistence)

## Installation flow

```
IndustryPackage
  → validate
  → install capabilities (CapabilityRuntime.applyEvent)
  → install knowledge categories (CompanyWorkspaceRuntime.applyEvent)
  → install automations (AutomationTemplateInstaller → AutomationRuntime.applyEvent)
  → record installation fingerprint
```

## Packages

- `industries/property-management/` — Property Management V1
- `industries/fixtures/` — minimal universality proof packages

Core remains empty of vertical behavior until a package is installed.
