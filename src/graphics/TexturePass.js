import { MeshBasicMaterial } from 'three';
import Pass from './Pass';

export default class TexturePass extends Pass {
  constructor(texture) {
    super();

    this.texture = texture;

    this.material = new MeshBasicMaterial({
      map: texture,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });

    this.setFullscreen(this.material);
  }

  render(renderer, inputBuffer) {
    const { scene, camera, texture, alwaysUpdateTexture } = this;

    if (alwaysUpdateTexture) {
      texture.needsUpdate = true;
    }

    super.render(renderer, scene, camera, inputBuffer);
  }

  /**
   * Dispose of resources created by this pass.
   * - Disposes material and clears references to the texture.
   * - Attempts to dispose geometry/materials on any meshes in the pass scene.
   * - Nulls scene/camera references so GC can reclaim them.
   */
  dispose() {
    try {
      // If the scene contains a fullscreen mesh, try to dispose its geometry/materials.
      if (this.scene && this.scene.children && this.scene.children.length) {
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
              // material may be an array
              if (Array.isArray(child.material)) {
                child.material.forEach(mat => {
                  try {
                    if (mat.map) mat.map = null;
                  } catch (e) {}
                  try {
                    if (typeof mat.dispose === 'function') mat.dispose();
                  } catch (e) {}
                });
              } else {
                try {
                  if (child.material.map) child.material.map = null;
                } catch (e) {}
                try {
                  if (typeof child.material.dispose === 'function') child.material.dispose();
                } catch (e) {}
              }
            }
          } catch (e) {
            // ignore
          }
        });
      }
    } catch (e) {
      // ignore
    }

    // Dispose our material if present (the material references the texture)
    try {
      if (this.material) {
        try {
          if (this.material.map) this.material.map = null;
        } catch (e) {
          // ignore
        }
        try {
          if (typeof this.material.dispose === 'function') this.material.dispose();
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // ignore
    } finally {
      this.material = null;
    }

    // Clear the texture reference (texture disposal should be handled by owner)
    try {
      if (this.texture) {
        try {
          this.texture = null;
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // ignore
    }

    // Null scene/camera so GC can reclaim
    try {
      this.scene = null;
      this.camera = null;
    } catch (e) {
      // ignore
    }
  }
}
