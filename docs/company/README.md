# Company Operating Model v1

VIBETech is evolving from “CRM-dependent software” into a **Company Operating System** for **Digital Employees**.

This document defines the **center of customization**: `Company`.

## Why `Company` is the center

Digital Employees should do work consistently because they have:
- a clear identity (who the company is)
- business memory (`Company Data`)
- reusable guidance (`Company Knowledge`)
- governance expectations (`Policies` + `Approval Rules`)
- optional tools (`Integrations`)

When these inputs live inside `Company`, the platform can support many industries without rewriting core runtime logic.

## Why CRM is optional

CRMs (including GoHighLevel, HubSpot, Salesforce, or custom CRMs) are treated as **optional tools**:
- they may store contact activity and history
- they may provide triggers for new inquiries

But CRMs should never be required for the platform’s value:
- work still starts from business inputs (e.g., website inquiry, phone intake, scheduled booking)
- employees interpret and respond using Company Data + Company Knowledge + Policies

## One platform, many industries

The platform supports multiple industries by keeping three boundaries stable:
1. **Employees declare capabilities and responsibilities**
2. **Runtime orchestrates execution and governance**
3. **UI + contracts map outputs into business workflows**

Industry variance comes from:
- the `Industry Template` selected during onboarding
- the shape of the `Company Data`
- the content in `Company Knowledge`
- the `Approval Rules` the company chooses

## How Digital Employees adapt through Company

Digital Employees do not depend on a vendor.
They adapt because:
- `Company Data` provides the business record types they need
- `Company Knowledge` provides language, policies, templates, scripts, and preferences
- `Integrations` optionally provide additional signals or delivery channels

The runtime/employee contract remains stable; only the company-configured business inputs change.

## How future code should follow this model

Future implementation must:
- keep `Company` as the primary customization object
- treat any external system (CRM, website, email, phone) as a **pluggable integration**
- ensure employees use capabilities and stable contracts, not vendor-specific logic
- keep governance consistent via `Policies` and `Approval Rules`

