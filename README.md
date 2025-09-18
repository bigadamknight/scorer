# Scorer

Mobile-first sport scoring platform with event-sourced match logic and modular sport rule support.

## Structure

- `apps/mobile` – Expo + React Native app for on-device scoring.
- `packages/schema` – shared TypeScript definitions for match events, templates, and projections.
- `packages/rules-netball` – rule helpers and templates for netball variants.
- `packages/ui` – reusable UI primitives across clients.
- `docs/architecture-decisions` – accepted architecture decisions (ADRs).

## Getting Started

> Dependencies have not been installed yet. Run the commands below after confirming network access.

```bash
nvm install 20.19.4 # or use your version manager of choice
nvm use 20.19.4
yarn install
cd apps/mobile
yarn start
```

Expo CLI will guide you through launching the app on a simulator or device.

## Development Scripts

- `yarn dev` – run Turbo `dev` pipeline (configure per-package `dev` scripts).
- `yarn build` – build all packages.
- `yarn lint` – lint all workspaces.
- `yarn test` – run workspace tests.

## Next Tasks

1. Implement Yarn Berry or Classic install and ensure Expo CLI runs inside the monorepo (Metro watch list adjustments already scaffolded).
2. Flesh out the event projection layer and persistence (SQLite adapter in mobile app).
3. Add linting/testing configs (ESLint, Prettier, Jest/Vitest) and align scripts with Turbo.
4. Prototype dual-scorer pairing flow and background sync contract.
5. Iterate on the mobile UI with real scorers and integrate the rule validation helpers.
