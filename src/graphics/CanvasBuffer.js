import { Texture } from 'three';
import TexturePass from './TexturePass';

export default class CanvasBuffer {
  constructor(width, height) {
    // Prefer OffscreenCanvas when available; fall back to an in-DOM canvas for environments without OffscreenCanvas.
    this.canvas = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(width, height) : (typeof document !== 'undefined' ? document.createElement('canvas') : null);

    // Three.Texture can take a Canvas/OffscreenCanvas as its source.
    this.texture = new Texture(this.canvas);

    this.pass = new TexturePass(this.texture);
    this.pass.alwaysUpdateTexture = true;

    this.context = (this.canvas && typeof this.canvas.getContext === 'function') ? this.canvas.getContext('2d') : null;

    // Disposal flag to prevent double-dispose
    this._disposed = false;

    this.setSize(width, height);
  }

  getContext() {
    return this.context;
  }

  setSize(width, height) {
    try {
      if (this.canvas) {
        // Ensure at least 1x1 to avoid 0-sized canvases which some code assumes are valid.
        this.canvas.width = width || 1;
        this.canvas.height = height || 1;
      }
    } catch (e) {
      // swallow sizing errors
    }
  }

  clear() {
    try {
      if (this.context && this.canvas) {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    } catch (e) {
      // ignore
    }
  }

  /**
   * Dispose of canvas-backed resources so they can be GC'd.
   * - Prevents repeated disposal.
   * - Disposes Three.Texture if available.
   * - Calls dispose on the TexturePass so associated materials/geometries are released.
   * - Clears and zeroes the canvas to help browsers reclaim memory.
   * - Nulls references to allow garbage collection.
   */
  dispose() {
    if (this._disposed) return;
    this._disposed = true;

    // Dispose of the pass (may release Mesh/Material resources)
    try {
      if (this.pass && typeof this.pass.dispose === 'function') {
        try {
          this.pass.dispose();
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // ignore
    } finally {
      this.pass = null;
    }

    // Dispose of Three texture
    try {
      if (this.texture && typeof this.texture.dispose === 'function') {
        try {
          this.texture.dispose();
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // ignore
    } finally {
      this.texture = null;
    }

    // Clear 2D context drawing buffer where possible
    try {
      if (this.context && this.canvas) {
        try {
          this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // ignore
    }

    // Shrink canvas to 0x0 where possible to allow browsers to free backing store
    try {
      if (this.canvas) {
        try {
          this.canvas.width = 0;
          this.canvas.height = 0;
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // ignore
    }

    // Null remaining references
    try {
      this.context = null;
      this.canvas = null;
    } catch (e) {
      // ignore
    }
  }
}
