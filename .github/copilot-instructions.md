# AI Agent Instructions: Task Management Widget

## Overview
This project is a Webex Contact Center Desktop widget built with React, Redux Toolkit, and a Web Component wrapper.
Primary goals:
- Display and manage tasks (cases) assigned to the agent
- Integrate with backend APIs and JDS for data retrieval and updates
- Utilize Desktop SDK for agent context and actions
- Utilize AI services for hints and suggestions based on task data and agent activity
- Use case management data sources from mockapi.io

## Critical Patterns

### 1) All Async Operations Use Redux Thunks
All SDK and API calls must go through Redux thunks in store/slices.
Components should dispatch actions and selectors only.
Never call API or Desktop SDK directly from component lifecycle hooks or handlers.

### 2) API Layer Stays Pure
API module contains pure async functions only.
No Redux logic in API functions.
API functions return raw data and throw errors.
Thunk layer owns loading/status/error dispatch.

### 3) Demo Mode Must Work Without Desktop SDK
Local/dev environment may not have Desktop SDK.
Always guard SDK calls with availability checks.
If SDK is unavailable, initialize safe demo-mode defaults.

### 4) Translation Keys in State, Translate at Render
Store translation keys in Redux state, not rendered text.
Render text with i18n lookup in components.
Every new string must be added to all supported locales.
No fallback hardcoded text in components.

### 5) Web Component + Shadow DOM Requirements
Widget is mounted inside a Web Component.
Keep shadow-root CSS injection strategy.
Preserve compatibility with host desktop runtime constraints.

### 6) React Compatibility
Support both modern and legacy render paths when required by host environment.

### 7) Defensive Property Parsing
Desktop can pass structured props as JSON strings.
Safely parse and validate incoming values before use.

### 8) State Serialization Discipline
Redux state must remain serializable except explicitly approved SDK object references.
Do not store Sets, class instances, or non-serializable objects in slices unless intentionally configured.

### 9) MomentumUI Is Required
Use Momentum UI as the primary component/styling system for widget UI.
Do not replace existing Momentum components with plain HTML or another UI library unless explicitly requested.
Preserve Momentum CSS/font behavior in both dev and production bundles.

Momentum-specific guardrails:
- Keep `@momentum-ui/react`, `@momentum-ui/core`, and `@momentum-ui/icons` as first-class dependencies.
- Ensure icon/font assets remain resolvable in standalone bundle output.
- Prefer importing only required Momentum components (avoid broad imports that bloat bundle size).
- When adding custom styles, layer them on top of Momentum tokens/utilities instead of overriding base behavior aggressively.
- Verify visuals in both normal DOM and shadow-root host rendering paths.

## Build and Packaging Rules
Keep two build targets:
- Standard build for development/testing.
- Standalone self-contained build for desktop deployment.
Document expected output artifact names and verification steps.

## File Responsibilities
- index entry file: Web Component registration, mounting, CSS injection
- store and slices: all async orchestration and UI state
- api module: backend/JDS interactions only
- i18n module: translation resources and lookup logic
- components: pure UI rendering and dispatch/selector usage

## PR Quality Checklist
- No direct API calls from components
- No direct SDK calls from components
- All user-facing text is i18n key based
- Loading and error states handled in thunk flow
- Demo mode behavior tested
- Standalone build smoke-tested
- Momentum primitives are reused (avoid ad-hoc duplicate styling blocks)
- Momentum dependencies are unchanged unless migration is explicitly approved
- Icon/font assets still resolve in build output (including standalone bundle)
- Shadow-root rendering is visually verified for Momentum-based UI

## Out of Scope Defaults
Do not reintroduce business logic from prior customer journey/case/address implementations unless explicitly requested.
Reuse architecture patterns, not domain behavior.

## Debug Guidance
If widget appears empty:
- Verify standalone artifact loading and network responses
- Verify CSS injection path
- Verify SDK availability fallback path
- Verify props parsing and initial state flow

If you want, next I can produce a second version of this instructions template already pre-filled for your specific new widget idea, so you can paste it with minimal edits.