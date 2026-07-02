# CompanyProfile (Sprint 3)

## Responsibilities
`CompanyProfile` is the canonical company configuration object owned by `CompanyWorkspaceRuntime`.

It contains deterministic, immutable sections describing branding, communications, and operational defaults.

## Ownership
`CompanyWorkspaceRuntime` creates and owns:
- the stored `companyProfile` instance
- derived immutable getters (e.g. `getCompanyProfile()`)

No other module stores company profile state.

## Derived values
`CompanyProfileBuilder` deterministically derives values where possible (examples: initials, sender display name, default footer/signature).

Derived values must live inside the builder to avoid duplicated logic across the platform.

## Validation
`CompanyProfileValidator` performs deterministic validation:
- validates formats (website/email)
- validates structure (time zone string pattern, business hours shape)
- computes completion percentage and validation status

Validation is read-only and does not mutate the profile.

## Relationship to Capability Engine
The Business Capability Engine evaluates the `Company Identity` capability using the validation and completion results stored in the profile metadata.

## Future consumers
Communication Engine, Workspace Views, website widgets, knowledge ingestion/document generation, digital employees, and analytics will consume this canonical object.

