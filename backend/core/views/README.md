# View Adapters

## Why View Adapters exist

VIBETech’s Runtime produces deterministic execution and governance outputs. The Workspace frontend, however, needs **business language** and **page-ready shapes** that match each screen’s contract.

A **View Adapter** is the contract transformer that bridges those layers:
- It **calls stable runtime/orchestration components** (e.g., `DraftGenerator`)
- It **translates runtime outputs into a screen-specific business contract**
- It **does not expose** internal runtime objects, prompts, pipelines, or provider details

This isolation keeps the frontend stable:
- Runtime internals can evolve without changing the Workspace’s contracts.
- View adapters become the only place where mapping logic lives.

## What a View Adapter is (and is not)

It is:
- a pure transformer / mapper layer
- page contract implementation glue
- deterministic mapping with placeholders when data is not yet available

It is not:
- a controller
- an API
- a router
- an HTTP endpoint
- a React component
- persistence / storage logic

## Pattern for future adapters

Future adapters (Dashboard, Work Queue, Digital Workforce) should follow the same structure:
1. Accept the minimum input needed to build the view
2. Call the smallest stable runtime component(s) required for that view
3. Transform runtime outputs into the documented business contract shape
4. Populate deterministic placeholders for any fields that runtime does not yet produce
5. Avoid leaking prompts, runtime internals, and provider/pipeline details

