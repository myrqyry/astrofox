import Effect from 'core/Effect';
import OutlinePass from 'effects/passes/OutlinePass';

export default class OutlineEffect extends Effect {
  static config = {
    name: 'OutlineEffect',
    description: 'Outline effect.',
    type: 'effect',
    label: 'Outline',
    defaultProperties: {
      edgeStrength: 3.0,
      edgeGlow: 0.0,
      edgeThickness: 1.0,
      pulsePeriod: 0,
      visibleEdgeColor: '#ffffff',
      hiddenEdgeColor: '#190a05',
    },
    controls: {
      edgeStrength: {
        label: 'Edge Strength',
        type: 'number',
        min: 0,
        max: 10,
        step: 0.1,
        withRange: true,
        withReactor: true,
      },
      edgeGlow: {
        label: 'Edge Glow',
        type: 'number',
        min: 0,
        max: 1,
        step: 0.01,
        withRange: true,
        withReactor: true,
      },
      edgeThickness: {
        label: 'Edge Thickness',
        type: 'number',
        min: 0,
        max: 4,
        step: 0.01,
        withRange: true,
        withReactor: true,
      },
      pulsePeriod: {
        label: 'Pulse Period',
        type: 'number',
        min: 0,
        max: 5,
        step: 0.01,
        withRange: true,
        withReactor: true,
      },
      visibleEdgeColor: {
        label: 'Visible Edge Color',
        type: 'color',
      },
      hiddenEdgeColor: {
        label: 'Hidden Edge Color',
        type: 'color',
      },
    },
  };

  constructor(properties) {
    super(OutlineEffect, properties);
  }

  addToScene(scene, camera, renderer) {
    const { width, height } = renderer.getSize();
    this.pass = new OutlinePass(new THREE.Vector2(width, height), scene, camera);
    this.updatePass();
  }

  updatePass() {
    const {
      edgeStrength,
      edgeGlow,
      edgeThickness,
      pulsePeriod,
      visibleEdgeColor,
      hiddenEdgeColor,
    } = this.properties;

    this.pass.edgeStrength = edgeStrength;
    this.pass.edgeGlow = edgeGlow;
    this.pass.edgeThickness = edgeThickness;
    this.pass.pulsePeriod = pulsePeriod;
    this.pass.visibleEdgeColor.set(visibleEdgeColor);
    this.pass.hiddenEdgeColor.set(hiddenEdgeColor);
  }

  setSelectedObjects(objects) {
    this.pass.selectedObjects = objects;
  }
}
