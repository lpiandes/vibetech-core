# Property Management Package V1

Product definition for Property Management as an installable industry package.

**This is not Core.** Install via `IndustryPackageInstaller` with `PROPERTY_MANAGEMENT_PACKAGE`.

## Contents

- Terminology (Property, Unit, Resident, Owner, etc.)
- 12 capabilities (lead response, maintenance coordination, etc.)
- 5 automation configurations (prospect follow-up, showing, maintenance, owner approval, vendor)
- 12 knowledge categories + readiness requirements
- 3 digital employee definitions
- Request types: PROSPECT_INQUIRY, MAINTENANCE_REQUEST, OWNER_REQUEST
- Interaction outcomes and communication intents
- Onboarding schema + connected system requirements

## Demo configuration

`demo/HorizonPropertiesDemoConfig.js` — deterministic demo company (separate from package default).

## Scenarios

See `backend/core/integration/PropertyManagementConnectedScenarios.test.js`
