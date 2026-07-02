# Request Runtime

## Purpose

The `Request Runtime` is the canonical ownership layer for every incoming business request entering VIBETech.

It answers exactly one business question:

**"What requests has the business received?"**

## Responsibilities

* Own immutable request state (`requests`) and derived immutable metrics (`metrics`)
* Enforce deterministic, event-driven mutations (runtime mutates ONLY through validated events)
* Provide immutable getters for downstream composition layers

## Ownership Boundaries

* `Request Runtime` owns: requests + request metrics
* `Work Runtime` owns: work items/stages/queues/assignments created later from some requests
* `Team Runtime` owns: workers and team-level availability signals
* No UI, CRM, lead management, qualification engine, automation, AI, or work creation is implemented here.

## Relationships

* **Mission Control**: consumes request intelligence later via future view adapters (not implemented in this sprint).
* **Work OS**: some requests may later become work, but that conversion logic is intentionally out of scope for this sprint.
* **Team OS**: assignment of work may later involve team members; assignment fields are present on the request model but the decision engine is out of scope.
* **Knowledge OS**: future request experiences can reference knowledge content, but this runtime remains storage/ownership only.

## Event Philosophy

Runtime state changes are applied through:

* `REQUEST_RECEIVED`
* `REQUEST_UPDATED`
* `REQUEST_QUALIFIED`
* `REQUEST_REJECTED`
* `REQUEST_CONVERTED`
* `REQUEST_CLOSED`

Events are treated as immutable records, and event application is deterministic.

# Request Runtime (Epic 9 Sprint 1)

## Purpose
`RequestRuntime` is the universal backend ownership layer for every incoming business request.

It answers exactly one question: **what requests has the business received?**

## Responsibilities
- Own immutable in-memory state (`requests` and derived `metrics`)
- Expose read-only getters
- Mutate state only via `applyEvent()`
- Compute runtime metrics deterministically from request state

## What this sprint does NOT build
- No UI
- No CRM/Lead Management/Customer Intake
- No qualification engine
- No automation
- No conversion into Work

## Relationships (future integration)
- Work OS: conversion may later map requests to work (handled in `REQUEST_CONVERTED` via fields only)
- Team OS: assignments may later map requests to workers (handled in `REQUEST_CONVERTED` via fields only)
- Mission Control OS: consumes request intelligence later (not composed in this sprint)

## Event philosophy
- Events are immutable records
- Event application is deterministic
- Applying an event produces a deep-frozen next runtime state

