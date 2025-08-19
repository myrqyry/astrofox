# Performance optimizations applied (Controls & Layers panels)

Summary
- Identified excessive re-renders caused by unstable selectors and recreated arrays/objects in render paths.
- Stabilized selectors and handler references, and applied memoization to reduce unnecessary renders in panel components.
- Focused changes on the panels area to avoid altering core app logic.

Files changed
- [`ControlsPanel.js`](src/view/components/panels/ControlsPanel.js:1)
- [`LayersPanel.js`](src/view/components/panels/LayersPanel.js:1)
- [`SceneLayer.js`](src/view/components/panels/SceneLayer.js:1)
- [`Layer.js`](src/view/components/panels/Layer.js:1)

What was wrong
- The displays selector in [`ControlsPanel.js`](src/view/components/panels/ControlsPanel.js:1) built a new flattened array on every render from `stage.scenes`, which caused child components to receive new array/object references and re-render even when data didn't change.
- Several panel components created handler functions inline (unstable callbacks) or reconstructed arrays (e.g., reverse operations) directly in render paths, causing shallow comparisons to fail and components to re-render frequently.
- Child components such as `Layer` and `SceneLayer` were plain function components, so any parent prop reference changes triggered their renders.

What I changed (high level)
- ControlsPanel
  - Replaced the allocating selector that referenced `stage.scenes` with a stable useMemo that caches previous input and result. It performs a shallow identity check of scene entries and reuses the previous flattened array when scenes are unchanged.
  - Kept the same output shape but ensured identical array reference when no scene changed.
  - Wrapped the exported component with React.memo to avoid re-rendering when internal selectors/hooks produce same results.
  - See [`ControlsPanel.js`](src/view/components/panels/ControlsPanel.js:1).
- LayersPanel
  - Converted inline handler functions into stable callbacks using useCallback (handleAddControl, handleAddScene, handleLayerClick, handleLayerUpdate, handleMoveUp/Down, handleRemove, handleAddDisplay, handleAddEffect) so callbacks passed to children are stable references.
  - Exported the memoized component via React.memo to avoid unnecessary rerenders when the internal hooks' outputs are unchanged.
  - See [`LayersPanel.js`](src/view/components/panels/LayersPanel.js:1).
- SceneLayer and Layer
  - Memoized both components with React.memo.
  - SceneLayer: memoized derived lists (reverse results) with useMemo and stabilized child render function with useCallback so children receive stable props and handlers.
  - Layer: exported a React.memo wrapped component to avoid re-rendering when props are shallow-equal.
  - See [`SceneLayer.js`](src/view/components/panels/SceneLayer.js:1) and [`Layer.js`](src/view/components/panels/Layer.js:1).

Why these changes help
- React.memo prevents re-rendering a component if its props are shallow-equal (fast shallow check). By making selector outputs and callbacks stable, we avoid creating new references that would defeat memoization.
- useMemo caches derived values (like reversed arrays or flattened lists) so we don't allocate new arrays on every render.
- useCallback ensures function references passed down to children remain the same across renders unless their dependencies change.
- Together these reduce the number of components React must reconcile and paint, decreasing CPU usage and improving perceived responsiveness.

Implementation notes & tradeoffs
- The ControlsPanel selector caches by shallow identity of scenes array items. This assumes scene objects remain the same reference in the store when their internal content hasn't changed (common with immutable update patterns). If the store replaces scene objects on unrelated updates, a deeper comparison would be required (expensive) or the store should be adjusted to preserve identities.
- Kept behavior and data flow unchanged — only stabilized references and added memoization. No changes to core business logic.
- React.memo adds a shallow prop check; if a component needs deeper checks in the future, consider providing a custom comparison function as the second arg to React.memo.

Performance measurement suggestions
- Before/After profiling:
  - Use React DevTools Profiler to record a transaction while performing typical UI operations (e.g., toggling controls, selecting layers). Compare number of renders and time spent.
  - Place console.time/console.timeEnd around expensive render sections during development (temporary) to get quick timing.
- Quick assertions to add (dev-only):
  - Add a small performance flag or debug prop to log renders: e.g., use a console.count in Layer and SceneLayer to observe render frequency when interacting.
- Recommended test scenario:
  1. Start app and open the Control Dock.
  2. Toggle audio features or update unrelated global state that previously caused panel re-renders.
  3. In React Profiler, assert that Layer/SceneLayer/ControlsPanel render counts are significantly reduced.

Best-practice guidelines (for future development)
- Always avoid creating new object/array/function references in render if they are passed to children. Use:
  - useMemo for derived arrays/objects
  - useCallback for functions
  - React.useRef to hold mutable caches where appropriate
- Keep selectors (state => ...) in zustand or store consumers minimal and return primitives or stable references where possible.
- Prefer updating nested state immutably but preserve references for unchanged subtrees to enable cheap identity checks.
- Memoize presentational components that receive frequently-stable props (use React.memo).
- When memoizing, ensure dependencies lists are correct — missing deps can cause stale closures.
- Add onboarding notes for contributors in project docs pointing to this file and the above rules.

Files to review next (recommended)
- Other panels in the same directory (e.g., `ReactorPanel.js`, `RenderPanel.js`) to apply similar patterns where handler functions or selectors are unstable.
- Controls/inputs that receive callbacks from panels — ensure handlers are stable when passed through multiple layers.