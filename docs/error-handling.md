# Error handling standardization for Astrofox

## Purpose
This document describes the standardized error-handling approach implemented across the application to replace inconsistent patterns with a single, testable, and debuggable flow.

## Patterns Identified
- Mixed approaches present across the codebase: try/catch, promise .catch, callback-style error handling and some unhandled promise rejections.
- Notable issues:
  - Action flows sometimes swallow errors silently.
  - Missing finally/cleanup steps (e.g., loading flags left true when errors occur).
  - Rendering errors were logged locally but not fed into centralized reporting.

## Implemented standard
- Use async/await for asynchronous flows consistently.
- Provide central utilities:
  - `withErrorHandler(fn, message)` — wrap async functions to ensure errors are logged, surfaced to UI, and rethrown.
  - `wrapAsync(promise, message)` — attach centralized reporting to promises used in-place.
  - `AppError` — standardized error wrapper that preserves the original error.
- Central reporting function `raiseError(message, error)` logs with the existing Logger and updates a UI-visible error store; it also attempts to open the ErrorDialog modal safely.
- ErrorBoundary now reports rendering errors through the centralized system in addition to its local logging.

## New / Modified files
- [`src/view/actions/error.js`](src/view/actions/error.js:1) — Added `AppError`, `raiseError`, `withErrorHandler`, `wrapAsync`, and a small error store for UI components.
- [`src/view/actions/audio.js`](src/view/actions/audio.js:1) — Refactored to:
  - Use `withErrorHandler` for the exported async actions.
  - Use `wrapAsync` for promise-returning calls to ensure consistent reporting.
  - Ensure `loading` flag is cleared in a `finally` block.
  - Surface playback start errors via `raiseError`.
- [`src/view/actions/app.js`](src/view/actions/app.js:1) — Wrapped `initApp` with `withErrorHandler` and used `wrapAsync` for `api.saveImageFile`.
- [`src/view/components/common/ErrorBoundary.js`](src/view/components/common/ErrorBoundary.js:1) — Now calls `raiseError` when component errors are caught, linking render-time errors into the same reporting path.
- Documentation: [`docs/error-handling.md`](docs/error-handling.md:1) — this file.

## How to use (examples)
- Wrap top-level async actions:
  - const myAction = withErrorHandler(async (args) => { /* ... */ }, 'Failed to do X');
- Wrap an existing Promise:
  - await wrapAsync(api.somePromise(), 'Failed to fetch X');
- Throw domain errors:
  - throw new AppError('Invalid input', { code: 'E_INVALID', original: err });

## Integration details
- Logging uses the existing Logger implementation (see [`src/core/Logger.js`](src/core/Logger.js:1)). `raiseError` invokes `logger.error(...)` with stack when available.
- Error UI: `raiseError` updates the central error store and calls `showModal('ErrorDialog', ...)` safely (modal failures are logged but not thrown).
- ErrorBoundary retains local defensive logging but additionally calls `raiseError` to unify reporting.

## Migration notes & scope
- The current pass targets key action flows and the UI error path. The utilities are intentionally minimal so they can be adopted incrementally.
- Recommended next steps:
  - Wrap other important async actions with `withErrorHandler`.
  - Replace scattered `.catch` handlers that swallow errors with `wrapAsync` or explicit try/catch + raiseError.
  - Add tests around error propagation and ensure UI modals appear as expected.

## Benefits
- Consistent error messages and stacks in logs.
- Fewer silent failures and improved user feedback.
- Easier debugging and clearer error propagation from low-level async operations to UI.