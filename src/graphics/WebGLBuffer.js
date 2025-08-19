import { Scene, Camera } from 'three';
import { WEBGL_BUFFER_SAMPLES } from 'view/constants';
import { createRenderTarget } from './common';
import CopyPass from './CopyPass';

export default class WebGLBuffer {
  constructor(renderer) {
    this.renderer = renderer;

    this.buffer = createRenderTarget({ samples: WEBGL_BUFFER_SAMPLES });

    this.pass = new CopyPass(this.buffer);
    this.pass.copyFromBuffer = true;
    this.pass.clearBuffer = false;

    this.scene = new Scene();
    this.camera = new Camera();

    // Disposal flag to prevent double-dispose
    this._disposed = false;
  }

  setSize(width, height) {
    this.buffer.setSize(width, height);
  }

  dispose() {
    // Prevent double-dispose
    if (this._disposed) return;
    this._disposed = true;

    // Dispose pass (which may dispose the buffer as well)
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

    // Dispose of the underlying render target if possible
    try {
      if (this.buffer && typeof this.buffer.dispose === 'function') {
        try {
          this.buffer.dispose();
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // ignore
    } finally {
      this.buffer = null;
    }

    // Null renderer/scene/camera references to allow GC
    try {
      this.renderer = null;
      if (this.scene && this.scene.children && this.scene.children.length) {
        // attempt to dispose children geometry/materials defensively
        this.scene.children.forEach(child => {
          try {
            if (child.geometry && typeof child.geometry.dispose === 'function') {
              child.geometry.dispose();
            }
          } catch (e) {
            // ignore
          }
          try {
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(m => {
                  try { if (m.map) m.map = null; } catch (e) {}
                  try { if (typeof m.dispose === 'function') m.dispose(); } catch (e) {}
                });
              } else {
                try { if (child.material.map) child.material.map = null; } catch (e) {}
                try { if (typeof child.material.dispose === 'function') child.material.dispose(); } catch (e) {}
              }
            }
          } catch (e) {
            // ignore
          }
        });
      }
    } catch (e) {
      // ignore
    } finally {
      this.scene = null;
      this.camera = null;
    }
  }

  clear() {
    const { renderer, buffer } = this;

    renderer.setRenderTarget(buffer);
    renderer.clear();
  }

  render(scene, camera) {
    const { renderer, buffer } = this;

    renderer.setRenderTarget(buffer);
    renderer.render(scene, camera);
  }
}
