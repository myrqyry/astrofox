import { WebGLRenderer, WebGLRenderTarget, BufferGeometry, BufferAttribute } from 'three';
import { MIN_CANVAS_DIMENSION } from 'view/constants';

let renderer = null;
let geometry = null;

/**
 * Detect whether an existing renderer's GL context is lost.
 * Returns true when we can probe the underlying GL context and it reports lost.
 */
function isRendererContextLost(r) {
  try {
    if (r && typeof r.getContext === 'function') {
      const ctx = r.getContext();
      if (ctx && typeof ctx.isContextLost === 'function') {
        return !!ctx.isContextLost();
      }
    }
  } catch (e) {
    // ignore failures when probing context
  }
  return false;
}

/**
 * Registry of listeners that want to be notified when a renderer's GL context
 * is lost or restored. Each listener receives two args: (eventType, renderer)
 * where eventType is one of: 'lost' | 'restored'.
 */
const _contextListeners = new Set();

/**
 * Add a listener that will be notified on context lost/restored.
 */
export function addContextRestoreListener(fn) {
  if (typeof fn === 'function') {
    _contextListeners.add(fn);
  }
}

/**
 * Remove a previously added listener.
 */
export function removeContextRestoreListener(fn) {
  if (typeof fn === 'function') {
    _contextListeners.delete(fn);
  }
}

/**
 * Notify all registered listeners of a context event.
 */
function notifyContextListeners(type, rendererArg) {
  _contextListeners.forEach(fn => {
    try {
      fn(type, rendererArg);
    } catch (e) {
      // Swallow listener errors to avoid cascading failures
      // eslint-disable-next-line no-console
      console.error('context listener error', e && (e.stack || e.message || e));
    }
  });
}

/**
 * Attach webglcontextlost / webglcontextrestored handlers to the canvas.
 * Uses the canvas element (renderer.domElement or provided canvas).
 */
function attachContextHandlers(canvasElement) {
  if (!canvasElement || typeof canvasElement.addEventListener !== 'function') return;

  // Avoid attaching multiple times
  if (canvasElement.__astrofoxContextHandlersAttached) return;
  canvasElement.__astrofoxContextHandlersAttached = true;

  const onLost = (evt) => {
    try {
      evt.preventDefault();
    } catch (e) {
      // ignore
    }

    // Try to best-effort log
    try {
      if (typeof window !== 'undefined' && window.__ASTROFOX__ && typeof window.__ASTROFOX__.log === 'function') {
        window.__ASTROFOX__.log('graphics', 'WebGL context lost on canvas %o', canvasElement);
      } else if (typeof console !== 'undefined') {
        console.warn('WebGL context lost on canvas', canvasElement);
      }
    } catch (e) {
      // ignore
    }

    // Mark current global renderer as lost (if probeable)
    if (renderer) {
      try {
        renderer.__contextLost = true;
      } catch (e) {
        // ignore
      }
    }

    // Swap to a lightweight software fallback so the app remains usable.
    try {
      renderer = createSoftwareFallbackRenderer(canvasElement);
    } catch (e) {
      // ignore
    }

    // Notify listeners
    notifyContextListeners('lost', null);
  };

  const onRestored = () => {
    // Attempt to recreate a fresh WebGLRenderer using the existing canvas.
    let newRenderer = null;

    try {
      // Try to create a WebGLRenderer again. Wrap in try/catch so failure falls back gracefully.
      // eslint-disable-next-line no-undef
      /* Using the same options as initial creation to keep behavior consistent */
      // Note: WebGLRenderer may be undefined in some test environments; guard with try.
      // Importing three at top ensures WebGLRenderer exists in runtime when available.
      newRenderer = new WebGLRenderer({
        canvas: canvasElement,
        antialias: false,
        premultipliedAlpha: true,
        alpha: false,
      });
      newRenderer.autoClear = false;
    } catch (err) {
      try {
        if (typeof window !== 'undefined' && window.__ASTROFOX__ && typeof window.__ASTROFOX__.log === 'function') {
          window.__ASTROFOX__.log('graphics', 'WebGLRenderer recreation failed on restore: %o', err && (err.stack || err.message || err));
        } else if (typeof console !== 'undefined') {
          console.error('WebGLRenderer recreation failed on restore:', err && (err.stack || err.message || err));
        }
      } catch (e) {
        // ignore logging errors
      }
      // If we couldn't recreate a WebGLRenderer, leave the fallback renderer active and notify listeners that restoration failed.
      notifyContextListeners('restored', null);
      return;
    }

    // Replace global renderer with the newly created one and reattach handlers.
    renderer = newRenderer;
    attachContextHandlers(renderer.domElement);

    try {
      if (typeof window !== 'undefined' && window.__ASTROFOX__ && typeof window.__ASTROFOX__.log === 'function') {
        window.__ASTROFOX__.log('graphics', 'WebGL context restored and renderer recreated');
      } else if (typeof console !== 'undefined') {
        console.info('WebGL context restored and renderer recreated');
      }
    } catch (e) {
      // ignore
    }

    notifyContextListeners('restored', renderer);
  };

  // Attach event listeners
  try {
    canvasElement.addEventListener('webglcontextlost', onLost, false);
    canvasElement.addEventListener('webglcontextrestored', onRestored, false);
  } catch (e) {
    // ignore
  }
}

/**
 * Minimal software-fallback renderer used when WebGL context creation fails.
 * Implements the subset of methods the app expects so the app can continue running
 * (visuals will degrade but the app remains usable).
 */
function createSoftwareFallbackRenderer(canvas) {
  const offscreen = canvas || (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(MIN_CANVAS_DIMENSION, MIN_CANVAS_DIMENSION) : null);
  const ctx2d = offscreen ? offscreen.getContext('2d') : null;
  const fallback = {
    domElement: offscreen || { width: MIN_CANVAS_DIMENSION, height: MIN_CANVAS_DIMENSION },
    autoClear: false,
    _pixelRatio: 1,
    setSize(width, height) {
      try {
        if (offscreen) {
          offscreen.width = width || MIN_CANVAS_DIMENSION;
          offscreen.height = height || MIN_CANVAS_DIMENSION;
        } else if (this.domElement) {
          this.domElement.width = width || MIN_CANVAS_DIMENSION;
          this.domElement.height = height || MIN_CANVAS_DIMENSION;
        }
      } catch (e) {
        // swallow
      }
    },
    setPixelRatio(r) {
      this._pixelRatio = r || 1;
    },
    getPixelRatio() {
      return this._pixelRatio;
    },
    getContext() {
      // Expose the underlying 2D context for code that inspects the context.
      return ctx2d || null;
    },
    render() {
      // No-op: WebGL rendering not available; keep app stable.
    },
    setRenderTarget() {
      // No-op
    },
    clear() {
      if (ctx2d && offscreen) {
        try {
          ctx2d.clearRect(0, 0, offscreen.width, offscreen.height);
        } catch (e) {
          // ignore
        }
      }
    },
    getClearColor(oldColor) {
      // Provide a consistent API; return black if requested
      if (oldColor && typeof oldColor.set === 'function') {
        oldColor.set(0x000000);
      }
      return { r: 0, g: 0, b: 0 };
    },
    setClearColor() {
      // No-op
    },
    getClearAlpha() {
      return 1;
    },
    readRenderTargetPixels(target, x, y, width, height, buffer) {
      // Fill buffer with zeros so readPixel consumers get deterministic data
      if (!buffer) return;
      for (let i = 0; i < buffer.length; i += 1) buffer[i] = 0;
      return true;
    },
    toDataURL(format) {
      // Try to fallback to data URL when possible
      try {
        if (offscreen && offscreen.convertToBlob) {
          // best-effort; synchronous API not available so return empty string
          return '';
        }
        if (this.domElement && this.domElement.toDataURL) {
          return this.domElement.toDataURL(format);
        }
      } catch (e) {
        // ignore
      }
      return '';
    },
    // Provide a getFPS shim used by StatusBar; returns 0 when fallback is active
    getFPS() {
      return 0;
    },
  };

  return fallback;
}

export function getRenderer(canvas) {
  if (!renderer || (canvas && renderer.domElement !== canvas)) {
    // Try to create a real WebGLRenderer. If it fails (context creation error or GL libs),
    // fall back to a software renderer so the app remains functional.
    try {
      // If an existing renderer appears to have a lost context, discard it so we recreate.
      if (isRendererContextLost(renderer)) {
        try {
          if (typeof window !== 'undefined' && window.__ASTROFOX__ && typeof window.__ASTROFOX__.log === 'function') {
            window.__ASTROFOX__.log('graphics', 'Existing renderer context appears lost, recreating renderer');
          } else if (typeof console !== 'undefined') {
            console.warn('Existing renderer context appears lost, recreating renderer');
          }
        } catch (e) {
          // ignore logging errors
        }

        renderer = null;
      }

      renderer = new WebGLRenderer({
        canvas,
        antialias: false,
        premultipliedAlpha: true,
        alpha: false,
      });

      // mark live GL renderer
      renderer.__contextLost = false;
      // Attach handlers so context lost/restored are handled centrally.
      try {
        attachContextHandlers(renderer.domElement);
      } catch (e) {
        // ignore attach failures
      }

      renderer.autoClear = false;
    } catch (err) {
      // Attempt to log to the app-level logger exposed via preload (best-effort).
      try {
        // window.__ASTROFOX__ is exposed in the preload script; it's not present in tests or SSR.
        if (typeof window !== 'undefined' && window.__ASTROFOX__ && typeof window.__ASTROFOX__.log === 'function') {
          window.__ASTROFOX__.log('graphics', 'WebGLRenderer creation failed: %o', err && (err.stack || err.message || err));
        } else if (typeof console !== 'undefined') {
          console.error('WebGLRenderer creation failed:', err && (err.stack || err.message || err));
        }
      } catch (logErr) {
        // Ignore logging errors
        // eslint-disable-next-line no-console
        console.error('Failed to log WebGLRenderer error', logErr);
      }

      // Create a graceful fallback renderer so the rest of the rendering pipeline can run.
      renderer = createSoftwareFallbackRenderer(canvas);
    }
  }

  return renderer;
}

export function getFullscreenGeometry() {
  if (!geometry) {
    const vertices = new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]);
    const uvs = new Float32Array([0, 0, 2, 0, 0, 2]);

    geometry = new BufferGeometry();

    geometry.setAttribute('position', new BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  }

  return geometry;
}

/**
 * FakeRenderTarget - minimal fallback when WebGLRenderTarget is unavailable.
 * Provides the small API our code expects: width, height, texture, setSize, clone, dispose.
 */
class FakeRenderTarget {
  constructor(width = MIN_CANVAS_DIMENSION, height = MIN_CANVAS_DIMENSION, options = {}) {
    this.width = width || MIN_CANVAS_DIMENSION;
    this.height = height || MIN_CANVAS_DIMENSION;
    this.texture = { width: this.width, height: this.height };
    this._options = options;
  }

  setSize(width, height) {
    this.width = width || MIN_CANVAS_DIMENSION;
    this.height = height || MIN_CANVAS_DIMENSION;
    this.texture.width = this.width;
    this.texture.height = this.height;
  }

  clone() {
    return new FakeRenderTarget(this.width, this.height, this._options);
  }

  dispose() {
    // no-op for fallback
  }
}

/**
 * createRenderTarget - try to create a real WebGLRenderTarget; if that fails, return a FakeRenderTarget.
 */
export function createRenderTarget(options = {}) {
  try {
    const pixelRatio = renderer && typeof renderer.getPixelRatio === 'function' ? renderer.getPixelRatio() : 1;
    const context = renderer && typeof renderer.getContext === 'function' ? renderer.getContext() : null;
    const width = Math.max(MIN_CANVAS_DIMENSION, Math.floor((context && context.canvas && context.canvas.width) / pixelRatio) || MIN_CANVAS_DIMENSION);
    const height = Math.max(MIN_CANVAS_DIMENSION, Math.floor((context && context.canvas && context.canvas.height) / pixelRatio) || MIN_CANVAS_DIMENSION);

    // If the environment supports WebGLRenderTarget and we have a GL context, try to create it.
    if (typeof WebGLRenderTarget === 'function' && context) {
      try {
        return new WebGLRenderTarget(width, height, options);
      } catch (err) {
        // Best-effort logging; do not throw — fall back to software target.
        try {
          // eslint-disable-next-line no-console
          console.error('Failed to create WebGLRenderTarget, falling back to FakeRenderTarget:', err && (err.stack || err.message || err));
        } catch (e) {
          // ignore
        }
      }
    }

    // If we don't have a GL context or creation failed, return fallback.
    return new FakeRenderTarget(width, height, options);
  } catch (err) {
    // If anything else goes wrong, log and return a minimal fallback target.
    try {
      // eslint-disable-next-line no-console
      console.error('createRenderTarget unexpected error, returning FakeRenderTarget:', err && (err.stack || err.message || err));
    } catch (e) {
      // ignore
    }
    return new FakeRenderTarget(MIN_CANVAS_DIMENSION, MIN_CANVAS_DIMENSION, options);
  }
}

/**
 * clearRenderTarget - clear a render target safely. Works with real WebGLRenderTarget or FakeRenderTarget.
 */
export function clearRenderTarget(target) {
  try {
    if (!renderer || typeof renderer.setRenderTarget !== 'function' || typeof renderer.clear !== 'function') {
      return;
    }

    // renderer.setRenderTarget accepts the render target directly for Three.js; for FakeRenderTarget it's a no-op.
    renderer.setRenderTarget(target);
    renderer.clear();
  } catch (err) {
    try {
      // eslint-disable-next-line no-console
      console.error('clearRenderTarget failed:', err && (err.stack || err.message || err));
    } catch (e) {
      // ignore
    }
  }
}
