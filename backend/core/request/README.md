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

