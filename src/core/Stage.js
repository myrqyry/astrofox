import { Color } from 'three';
import cloneDeep from 'lodash/cloneDeep';
import Scene from 'core/Scene';
import Entity from 'core/Entity';
import EntityList from 'core/EntityList';
import Composer from 'graphics/Composer';
import CanvasBuffer from 'graphics/CanvasBuffer';
import WebGLBuffer from 'graphics/WebGLBuffer';
import {
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_BGCOLOR,
} from 'view/constants';
import { isDefined } from 'utils/array';
import { getRenderer } from 'graphics/common';
import Logger from 'core/Logger';
import { addContextRestoreListener, removeContextRestoreListener } from 'graphics/common';

export default class Stage extends Entity {
  static defaultProperties = {
    width: DEFAULT_CANVAS_WIDTH,
    height: DEFAULT_CANVAS_HEIGHT,
    backgroundColor: DEFAULT_CANVAS_BGCOLOR,
    zoom: 1,
  };

  constructor(properties) {
    super('Stage', { ...Stage.defaultProperties, ...properties });

    this.scenes = new EntityList();
    // Logger for Stage to report context loss/restore events
    this.logger = new Logger('Stage');
    // Flag when GL context is lost
    this._contextLost = false;
    // Bound handler for context events
    this._contextHandler = this._onContextEvent.bind(this);
  }

  init(canvas) {
    // If we're re-initializing, destroy existing resources first to prevent leaks
    if (this.renderer) {
      this.destroy();
    }

    const { width, height, backgroundColor } = this.properties;

    this.renderer = getRenderer(canvas);
    // Keep a reference to the canvas element for recreation
    this.canvas = (this.renderer && this.renderer.domElement) || canvas;
    this.renderer.setSize(width, height);

    this.composer = new Composer(this.renderer);

    this.canvasBuffer = new CanvasBuffer(width, height);
    this.webglBuffer = new WebGLBuffer(this.renderer);

    this.backgroundColor = new Color(backgroundColor);

    // Register for context lost/restored notifications so Stage can reinitialize GL resources.
    try {
      addContextRestoreListener(this._contextHandler);
    } catch (e) {
      // Best-effort: log but do not throw
      this.logger.warn('Failed to register context restore listener', e && (e.stack || e.message || e));
    }
  }

  update(properties) {
    const { width, height, backgroundColor } = properties;
    const changed = super.update(properties);

    if (changed) {
      if (isDefined(width, height)) {
        this.setSize(width, height);
      }

      if (backgroundColor !== undefined) {
        this.backgroundColor.set(backgroundColor);
      }
    }

    return changed;
  }

  getImage(format) {
    return this.composer.getImage(format);
  }

  getPixels() {
    return this.composer.getPixels();
  }

  getSize() {
    if (this.composer) {
      return this.composer.getSize();
    }

    return { width: 0, height: 0 };
  }

  setSize(width, height) {
    this.scenes.forEach(scene => {
      scene.setSize(width, height);
    });

    this.composer.setSize(width, height);

    this.canvasBuffer.setSize(width, height);
    this.webglBuffer.setSize(width, height);
  }

  getSceneById(id) {
    return this.scenes.getElementById(id);
  }

  getStageElementById(id) {
    return this.scenes.reduce((element, scene) => {
      if (!element) {
        element = scene.getElementById(id);
      }
      return element;
    }, this.getSceneById(id));
  }

  removeStageElement(obj) {
    if (obj instanceof Scene) {
      this.removeScene(obj);
    } else {
      const scene = this.getSceneById(obj.scene.id);
      if (scene) {
        scene.removeElement(obj);
      }
    }
  }

  shiftStageElement(obj, spaces) {
    if (obj instanceof Scene) {
      return this.scenes.shiftElement(obj, spaces);
    }

    const scene = this.getSceneById(obj.scene.id);

    if (scene) {
      return scene.shiftElement(obj, spaces);
    }

    return false;
  }

  addScene(scene = new Scene(), index) {
    this.scenes.addElement(scene, index);

    scene.stage = this;

    if (scene.addToStage) {
      scene.addToStage(this);
    }

    return scene;
  }

  removeScene(scene) {
    this.scenes.removeElement(scene);

    scene.stage = null;

    scene.removeFromStage(this);
  }

  clearScenes() {
    [...this.scenes].forEach(scene => this.removeScene(scene));
  }

  hasScenes() {
    return !this.scenes.isEmpty();
  }

  toJSON() {
    const { id, name, type, properties } = this;

    return {
      id,
      name,
      type,
      properties: cloneDeep(properties),
    };
  }

  /**
   * Handle graphics context events from graphics/common.
   * type: 'lost' | 'restored'
   * rendererArg: when restored, the newly created renderer may be provided
   */
  _onContextEvent(type, rendererArg) {
    try {
      if (type === 'lost') {
        this._contextLost = true;
        this.logger.warn('WebGL context lost — switching to fallback and preserving state');

        // Replace our renderer reference with the current renderer (common.getRenderer will return the fallback)
        try {
          this.renderer = getRenderer(this.canvas);
        } catch (e) {
          this.logger.error('Failed to obtain fallback renderer after context loss', e && (e.stack || e.message || e));
          // keep going — fallback may be undefined in test envs
        }

        // Dispose of GL-backed resources where possible and create safe fallbacks
        try {
          if (this.composer && typeof this.composer.dispose === 'function') {
            this.composer.dispose();
          }
        } catch (e) {
          this.logger.warn('Error disposing composer after context loss', e && (e.stack || e.message || e));
        }

        try {
          if (this.webglBuffer && typeof this.webglBuffer.dispose === 'function') {
            this.webglBuffer.dispose();
          }
        } catch (e) {
          this.logger.warn('Error disposing webglBuffer after context loss', e && (e.stack || e.message || e));
        }

        // Dispose canvas-backed resources (textures/offscreen canvases) to avoid leaks.
        try {
          if (this.canvasBuffer && typeof this.canvasBuffer.dispose === 'function') {
            this.canvasBuffer.dispose();
          }
        } catch (e) {
          this.logger.warn('Error disposing canvasBuffer after context loss', e && (e.stack || e.message || e));
        }

        // Recreate composer and webglBuffer using the (fallback) renderer so rendering still works (degraded).
        try {
          this.composer = new Composer(this.renderer);
          this.webglBuffer = new WebGLBuffer(this.renderer);
          // Recreate canvas buffer so texture sources are fresh for the new renderer context.
          try {
            this.canvasBuffer = new CanvasBuffer(this.properties.width, this.properties.height);
          } catch (e) {
            // If recreation fails, log and continue — some environments (tests/SSR) may not support OffscreenCanvas.
            this.logger.warn('Failed to recreate canvasBuffer after context loss', e && (e.stack || e.message || e));
          }
          // Re-apply size so new buffers match current stage size
          this.setSize(this.properties.width, this.properties.height);
        } catch (e) {
          this.logger.error('Failed to recreate fallback rendering resources after context loss', e && (e.stack || e.message || e));
        }
      } else if (type === 'restored') {
        this._contextLost = false;
        this.logger.info('WebGL context restored — reinitializing renderer resources');

        // If a new renderer object was provided by the notifier, use it; otherwise try to obtain one.
        const newRenderer = rendererArg || getRenderer(this.canvas);
        if (newRenderer) {
          this.renderer = newRenderer;
        }

        // Recreate composer and webglBuffer so shaders/textures are recompiled in the new GL context.
        try {
          if (this.composer && typeof this.composer.dispose === 'function') {
            this.composer.dispose();
          }
        } catch (e) {
          this.logger.warn('Error disposing composer during restore', e && (e.stack || e.message || e));
        }

        try {
          if (this.webglBuffer && typeof this.webglBuffer.dispose === 'function') {
            this.webglBuffer.dispose();
          }
        } catch (e) {
          this.logger.warn('Error disposing webglBuffer during restore', e && (e.stack || e.message || e));
        }

        // Dispose and recreate canvasBuffer so its associated Three.Texture is re-bound to the new GL context.
        try {
          if (this.canvasBuffer && typeof this.canvasBuffer.dispose === 'function') {
            this.canvasBuffer.dispose();
          }
        } catch (e) {
          this.logger.warn('Error disposing canvasBuffer during restore', e && (e.stack || e.message || e));
        }

        try {
          this.composer = new Composer(this.renderer);
          this.webglBuffer = new WebGLBuffer(this.renderer);
          try {
            this.canvasBuffer = new CanvasBuffer(this.properties.width, this.properties.height);
          } catch (e) {
            this.logger.warn('Failed to recreate canvasBuffer during restore', e && (e.stack || e.message || e));
          }
          this.setSize(this.properties.width, this.properties.height);
        } catch (e) {
          this.logger.error('Failed to recreate GL resources after context restore', e && (e.stack || e.message || e));
        }
      }
    } catch (e) {
      // Ensure the handler never throws
      this.logger.error('Unhandled error in _onContextEvent', e && (e.stack || e.message || e));
    }
  }

  /**
   * Unregister context listeners and dispose GL resources. Call when Stage is destroyed.
   */
  destroy() {
    try {
      removeContextRestoreListener(this._contextHandler);
    } catch (e) {
      // ignore
    }

    try {
      if (this.composer && typeof this.composer.dispose === 'function') {
        this.composer.dispose();
      }
    } catch (e) {
      // ignore
    }

    try {
      if (this.webglBuffer && typeof this.webglBuffer.dispose === 'function') {
        this.webglBuffer.dispose();
      }
    } catch (e) {
      // ignore
    }

    // Ensure canvas-backed resources are disposed to prevent OffscreenCanvas / Texture leaks.
    try {
      if (this.canvasBuffer && typeof this.canvasBuffer.dispose === 'function') {
        this.canvasBuffer.dispose();
      }
    } catch (e) {
      // ignore
    } finally {
      this.canvasBuffer = null;
    }
  }

  render(data) {
    const { composer, scenes, backgroundColor } = this;

    composer.clear(backgroundColor, 1);

    scenes.forEach(scene => {
      if (scene.enabled) {
        const buffer = scene.render(data);

        composer.blendBuffer(buffer, scene.properties);
      }
    });

    composer.renderToScreen();
  }
}
