import { WebGLRenderer, WebGLRenderTarget, BufferGeometry, BufferAttribute } from 'three';

let renderer = null;
let geometry = null;

/**
 * Minimal software-fallback renderer used when WebGL context creation fails.
 * Implements the subset of methods the app expects so the app can continue running
 * (visuals will degrade but the app remains usable).
 */
function createSoftwareFallbackRenderer(canvas) {
  const offscreen = canvas || (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1) : null);
  const ctx2d = offscreen ? offscreen.getContext('2d') : null;
  const fallback = {
    domElement: offscreen || { width: 1, height: 1 },
    autoClear: false,
    _pixelRatio: 1,
    setSize(width, height) {
      try {
        if (offscreen) {
          offscreen.width = width || 1;
          offscreen.height = height || 1;
        } else if (this.domElement) {
          this.domElement.width = width || 1;
          this.domElement.height = height || 1;
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
      renderer = new WebGLRenderer({
        canvas,
        antialias: false,
        premultipliedAlpha: true,
        alpha: false,
      });

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
  constructor(width = 1, height = 1, options = {}) {
    this.width = width || 1;
    this.height = height || 1;
    this.texture = { width: this.width, height: this.height };
    this._options = options;
  }

  setSize(width, height) {
    this.width = width || 1;
    this.height = height || 1;
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
    const width = Math.max(1, Math.floor((context && context.canvas && context.canvas.width) / pixelRatio) || 1);
    const height = Math.max(1, Math.floor((context && context.canvas && context.canvas.height) / pixelRatio) || 1);

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
    return new FakeRenderTarget(1, 1, options);
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
