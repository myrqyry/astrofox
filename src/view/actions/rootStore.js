/**
 * Centralized Zustand root store and slice factory
 *
 * Purpose:
 * - Provide a single normalized store for the app while preserving the existing
 *   per-action-file publics (the hook + .getState/.setState/.subscribe API).
 * - Keep backward compatibility so existing modules that import default store
 *   hooks from action files (e.g. `import appStore from './app'`) continue to work.
 *
 * Usage:
 * - Import createSlice('app') in action files and export the returned hook as the
 *   default export. The returned value is a hook (function) that can be used
 *   as `useSlice(selector)` in components and also has `.getState`, `.setState`
 *   and `.subscribe` methods attached to it (matching the previous shape).
 *
 * Notes / Assumptions:
 * - This is intentionally conservative: it centralizes state but does not change
 *   existing action function semantics. Future refactors can converge action
 *   modules to operate directly against the centralized shapes.
 *
 * Implementation decisions:
 * - The root store keeps per-domain keys (app, audio, scenes, project, stage, ...).
 * - createSlice returns a hook function that delegates selection to the root store
 *   and exposes setState/getState/subscribe wrappers that operate on the slice.
 *
 * This file is a non-breaking improvement to begin normalizing state and is the
 * foundation for further selector and normalization work.
 */

// eslint-disable-next-line import/no-unresolved
import create from 'zustand';
// eslint-disable-next-line import/no-unresolved
import defaultAppConfig from 'config/app.json';
// Backwards-compatible legacy constants (re-exported from src/config/constants.js)
import {
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_BGCOLOR,
  DEFAULT_ZOOM,
} from 'view/constants';

/* Initial slice shapes taken from existing action modules to preserve defaults. */
// app
const appInitial = {
  statusText: '',
  showControlDock: true,
  showPlayer: true,
  showReactor: false,
  showWaveform: true,
  showOsc: false,
  activeReactorId: null,
  activeElementId: null,
};

// audio
const audioInitial = {
  file: '',
  duration: 0,
  loading: false,
  tags: null,
  error: null,
};

// error
const errorInitial = {
  error: null,
  message: null,
};

// scenes
const scenesInitial = {
  scenes: [],
};

// project
const projectInitial = {
  file: '',
  opened: 0,
  lastModified: 0,
};

// stage
const stageInitial = {
  width: DEFAULT_CANVAS_WIDTH,
  height: DEFAULT_CANVAS_HEIGHT,
  backgroundColor: DEFAULT_CANVAS_BGCOLOR,
  zoom: DEFAULT_ZOOM,
  loading: false,
};

// updates
const updatesInitial = {
  status: null,
  checked: false,
  hasUpdate: false,
  downloadComplete: false,
  downloadProgress: 0,
  lastCheck: 0,
  updateInfo: null,
};

// reactors
const reactorsInitial = {
  reactors: [],
};

// modals
const modalsInitial = {
  modals: [],
};

// video
const videoInitial = {
  active: false,
  finished: false,
  status: '',
  totalFrames: 0,
  currentFrame: 0,
  lastFrame: 0,
  startTime: 0,
};

/**
 * Root store - single source of truth for all view-level slices.
 * Keep the key names stable to make migration straightforward.
 */
const useRootStore = create(set => ({
  app: { ...appInitial },
  audio: { ...audioInitial },
  error: { ...errorInitial },
  scenes: { ...scenesInitial },
  project: { ...projectInitial },
  stage: { ...stageInitial },
  config: { ...defaultAppConfig },
  updates: { ...updatesInitial },
  reactors: { ...reactorsInitial },
  modals: { ...modalsInitial },
  video: { ...videoInitial },

  // Helpers for debugging / dev usage
  __resetAll() {
    set({
      app: { ...appInitial },
      audio: { ...audioInitial },
      error: { ...errorInitial },
      scenes: { ...scenesInitial },
      project: { ...projectInitial },
      stage: { ...stageInitial },
      config: { ...defaultAppConfig },
      updates: { ...updatesInitial },
      reactors: { ...reactorsInitial },
      modals: { ...modalsInitial },
      video: { ...videoInitial },
    });
  },
}));

/**
 * createSlice - returns a hook-like function compatible with the existing
 * per-action-file exports (the hook produced by `create()` from zustand).
 *
 * Returned API:
 * - default exported value (the hook): useSlice(selector, equalityFn)
 * - hook.getState(): returns the raw slice state
 * - hook.setState(partialOrUpdater): updates the slice (partial object merges or updater)
 * - hook.subscribe(listener): subscribe to slice changes, returns unsubscribe
 *
 * Implementation notes:
 * - setState accepts either a partial object or an updater function (like original)
 * - subscribe uses the root store's selector API so consumers get slice-level updates
 */
export function createSlice(key) {
  // hook function that delegates to root store
  const hook = (selector = s => s, equalityFn) =>
    useRootStore(rootState => selector(rootState[key]), equalityFn);

  // attach getState
  hook.getState = () => {
    const root = useRootStore.getState();
    return root[key];
  };

  // attach setState - supports updater function or partial object
  hook.setState = partialOrUpdater => {
    if (typeof partialOrUpdater === 'function') {
      useRootStore.setState(rootState => {
        const slice = rootState[key];
        // compute new slice and set
        const newSlice = partialOrUpdater(slice);
        return { [key]: { ...slice, ...(newSlice || {}) } };
      });
    } else {
      useRootStore.setState(rootState => {
        const slice = rootState[key];
        return { [key]: { ...slice, ...partialOrUpdater } };
      });
    }
  };

  // attach subscribe(listener) - listener receives the new slice value
  hook.subscribe = listener =>
    useRootStore.subscribe(
      rootState => rootState[key],
      listener
    );

  return hook;
}

/**
 * getSlice - convenient synchronous getter for a slice's current value.
 * Usage: const scenes = getSlice('scenes');
 */
export function getSlice(key) {
  return useRootStore.getState()[key];
}

/**
 * createDerivedSelector - create a small memoized selector for derived state
 * based on an entire slice. It performs a cheap reference-equality check on the
 * slice and only recomputes when the slice reference changes.
 *
 * Returns a function `selector()` which returns the memoized derived value when
 * called. Components can call this inside render or pass it to createSlice hooks.
 *
 * Example:
 *   const selectFlattened = createDerivedSelector('scenes', scenes => {
 *     // compute derived value
 *   });
 *   const flattened = selectFlattened();
 */
export function createDerivedSelector(sliceKey, computeFn) {
  let lastSlice = null;
  let lastResult = null;

  return function derived() {
    const slice = useRootStore.getState()[sliceKey];

    // If slice reference unchanged, return cached result
    if (slice === lastSlice) {
      return lastResult;
    }

    // compute and cache
    lastSlice = slice;
    lastResult = computeFn(slice);
    return lastResult;
  };
}

export default useRootStore;
