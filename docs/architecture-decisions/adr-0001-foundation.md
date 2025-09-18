# ADR 0001: Scorer Foundation Stack

## Context

We are building a modular scoring platform that targets mobile-first usage with future web and desktop options. Requirements include sport-specific rule enforcement, detailed event auditing, and support for dual-scorer synchronisation. We need a stack that enables rapid iteration, shared logic across clients, and clean division between UI and domain rules.

## Decision

- Use a Yarn workspaces monorepo managed by Turbo to host apps (`apps/*`) and shared packages (`packages/*`).
- Scaffold the initial mobile experience with Expo, React Native, and TypeScript to reach iOS and Android quickly while keeping web compatibility in reach.
- Centralise sport-agnostic schemas in `@scorer/schema` and sport-specific rule helpers in `@scorer/rules-netball`.
- Prepare a shared `@scorer/ui` package for reusable interface elements across clients.
- Adopt an event-sourcing data model where every scoring interaction emits a typed `MatchEvent` persisted locally and synced to the backend.

## Status

Accepted.

## Consequences

- All workspaces share TypeScript configuration for consistency; projects can add their own overrides.
- Turbo orchestrates dev, lint, test, and build pipelines, smoothing future CI adoption.
- Expo toolchain provides OTA updates, cross-platform APIs, and developer ergonomics at the cost of a slightly larger bundle size.
- Event-sourced design requires well-defined projections but gives us full auditing, undo capability, and conflict resolution between scorers.
