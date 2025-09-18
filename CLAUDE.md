# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Scorer is a mobile-first sport scoring platform built as a TypeScript monorepo. It implements an event-sourced architecture for match logic with modular sport rule support.

## Essential Commands

### Development
```bash
# Install dependencies (use --ignore-engines if Node version issues)
yarn install

# Start mobile app development
cd apps/mobile && yarn start

# Build all packages (required before running mobile app)
yarn build

# Run development mode for all packages
yarn dev
```

### Testing & Quality
```bash
# Run linting across all workspaces
yarn lint

# Run tests (Note: No tests currently implemented)
yarn test
```

## Architecture

### Monorepo Structure
- **apps/mobile**: Expo React Native app with scoring UI
- **packages/schema**: Core TypeScript types for event-sourced match data
- **packages/rules-netball**: Netball rule templates and validation logic
- **packages/ui**: Shared React Native UI components

### Event-Sourcing Pattern
All match state changes are captured as immutable events:
- Events have unique IDs, timestamps, and sequence numbers
- State is reconstructed by replaying events
- Enables undo/redo and conflict resolution between dual scorers
- Event types: `goal_scored`, `period_transition`, `substitution_made`, etc.

### Package Dependencies
```
apps/mobile → @scorer/schema, @scorer/rules-netball, @scorer/ui
packages/rules-netball → @scorer/schema
packages/ui → @scorer/schema
```

### Rule Template System
Sports are defined as `RuleTemplate` objects containing:
- Period definitions (quarters, halves, etc.)
- Scoring zones with point values
- Position restrictions for scoring
- Clock and substitution rules

Example: Netball has two templates - Standard (1-point goals) and Fast5 (1-3 point zones).

## Key Implementation Details

### TypeScript Configuration
- Shared base config at `/tsconfig.base.json`
- Package-specific configs extend the base
- Packages compile to `dist/` directories

### Mobile App State Flow
1. Setup screen: Team names and game type selection
2. Match creation: Generates `match_created` and initial `period_transition` events
3. Scoring: Position selection → Zone selection → Goal validation → Event creation
4. Period management: Tracks quarters/halves with transition events
5. End screen: Final scores and winner display

### Event Validation
The `validateGoalEvent` function in `rules-netball` ensures:
- Only allowed positions (GA/GS) can score
- Zone restrictions are enforced
- Point values match zone definitions

## Current Limitations & TODOs

- **No clock implementation**: `clockTimeSeconds` is hardcoded to 0
- **No persistence**: Events are only stored in React state
- **No sync**: Dual-scorer conflict resolution not implemented
- **No tests**: Test frameworks configured but no tests written
- **Node version**: Requires adjustment if Node < 20.18.0

## Common Issues & Solutions

### Node Version Incompatibility
If you encounter "engine node is incompatible" errors:
1. Edit root `package.json` to lower Node requirement
2. Use `yarn install --ignore-engines` as fallback

### Package Build Errors
Always run `yarn build` after modifying shared packages before starting the mobile app.

### Expo Port Conflicts
If port 8081 is in use, start with: `yarn start --port 19002`

## Future Architecture Plans
Per ADR-0001, the platform will expand to:
- Web and desktop clients sharing the same packages
- SQLite persistence with sync adapters
- Real-time WebSocket synchronization
- Additional sport rule packages