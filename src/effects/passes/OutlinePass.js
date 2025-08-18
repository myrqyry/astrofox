import {
  Color,
  Matrix4,
  MeshDepthMaterial,
  NearestFilter,
  NoBlending,
  RGBADepthPacking,
  ShaderMaterial,
  UniformsUtils,
  Vector2,
  WebGLRenderTarget,
  DepthTexture,
  UnsignedShortType,
  DoubleSide,
} from 'three';
import Pass from 'graphics/Pass';
import { FullScreenQuad } from 'graphics/Composer';
import CopyShader from 'shaders/CopyShader';

export default class OutlinePass extends Pass {
  constructor(resolution, scene, camera, selectedObjects) {
    super();

    this.renderScene = scene;
    this.renderCamera = camera;
    this.selectedObjects = selectedObjects !== undefined ? selectedObjects : [];
    this.visibleEdgeColor = new Color(1, 1, 1);
    this.hiddenEdgeColor = new Color(0.1, 0.04, 0.02);
    this.edgeGlow = 0.0;
    this.usePatternTexture = false;
    this.edgeThickness = 1.0;
    this.edgeStrength = 3.0;
    this.downSampleRatio = 2;
    this.pulsePeriod = 0;

    this.resolution = resolution !== undefined ? new Vector2(resolution.x, resolution.y) : new Vector2(256, 256);

    const pars = {
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      format: 'RGBAFormat',
    };

    const depthTexture = new DepthTexture();
    depthTexture.type = UnsignedShortType;

    this.renderTargetMaskBuffer = new WebGLRenderTarget(this.resolution.x, this.resolution.y, pars);
    this.renderTargetMaskBuffer.texture.name = 'OutlinePass.mask';
    this.renderTargetMaskBuffer.depthTexture = depthTexture;

    this.depthMaterial = new MeshDepthMaterial();
    this.depthMaterial.side = DoubleSide;
    this.depthMaterial.depthPacking = RGBADepthPacking;
    this.depthMaterial.blending = NoBlending;

    this.prepareMaskMaterial = this.getPrepareMaskMaterial();
    this.prepareMaskMaterial.side = DoubleSide;
    this.prepareMaskMaterial.fragmentShader = replaceDepthToViewZ(
      this.prepareMaskMaterial.fragmentShader,
      this.renderCamera,
    );

    this.renderTargetDepthBuffer = new WebGLRenderTarget(this.resolution.x, this.resolution.y, pars);
    this.renderTargetDepthBuffer.texture.name = 'OutlinePass.depth';
    this.renderTargetDepthBuffer.depthTexture = depthTexture;

    this.renderTargetMaskDownSampleBuffer = new WebGLRenderTarget(
      this.resolution.x / this.downSampleRatio,
      this.resolution.y / this.downSampleRatio,
      pars,
    );
    this.renderTargetBlurBuffer1 = new WebGLRenderTarget(
      this.resolution.x / this.downSampleRatio,
      this.resolution.y / this.downSampleRatio,
      pars,
    );
    this.renderTargetBlurBuffer2 = new WebGLRenderTarget(
      this.resolution.x / this.downSampleRatio,
      this.resolution.y / this.downSampleRatio,
      pars,
    );

    this.edgeDetectionMaterial = this.getEdgeDetectionMaterial();
    this.renderTargetEdgeBuffer1 = new WebGLRenderTarget(
      this.resolution.x / this.downSampleRatio,
      this.resolution.y / this.downSampleRatio,
      pars,
    );
    this.renderTargetEdgeBuffer2 = new WebGLRenderTarget(
      this.resolution.x / this.downSampleRatio,
      this.resolution.y / this.downSampleRatio,
      pars,
    );

    const MAX_EDGE_THICKNESS = 4;
    const MAX_EDGE_GLOW = 4;

    this.separableBlurMaterial1 = this.getSeperableBlurMaterial(MAX_EDGE_THICKNESS);
    this.separableBlurMaterial1.uniforms.texSize.value.set(
      this.resolution.x / this.downSampleRatio,
      this.resolution.y / this.downSampleRatio,
    );
    this.separableBlurMaterial1.uniforms.kernelRadius.value = 1;
    this.separableBlurMaterial2 = this.getSeperableBlurMaterial(MAX_EDGE_GLOW);
    this.separableBlurMaterial2.uniforms.texSize.value.set(
      this.resolution.x / this.downSampleRatio,
      this.resolution.y / this.downSampleRatio,
    );
    this.separableBlurMaterial2.uniforms.kernelRadius.value = 1;

    this.overlayMaterial = this.getOverlayMaterial();

    if (CopyShader === undefined) {
      console.error('THREE.OutlinePass relies on CopyShader');
    }

    const copyShader = CopyShader;

    this.copyUniforms = UniformsUtils.clone(copyShader.uniforms);
    this.copyUniforms.opacity.value = 1.0;

    this.materialCopy = new ShaderMaterial({
      uniforms: this.copyUniforms,
      vertexShader: copyShader.vertexShader,
      fragmentShader: copyShader.fragmentShader,
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });

    this.enabled = true;
    this.needsSwap = false;

    this.fsQuad = new FullScreenQuad(null);

    this.tempPulseColor1 = new Color();
    this.tempPulseColor2 = new Color();
    this.textureMatrix = new Matrix4();

    function replaceDepthToViewZ(string, camera) {
      const type = camera.isPerspectiveCamera ? 'perspective' : 'orthographic';

      return string.replace(/DEPTH_TO_VIEW_Z/g, `${type}DepthToViewZ`);
    }
  }

  dispose() {
    this.renderTargetMaskBuffer.dispose();
    this.renderTargetDepthBuffer.dispose();
    this.renderTargetMaskDownSampleBuffer.dispose();
    this.renderTargetBlurBuffer1.dispose();
    this.renderTargetBlurBuffer2.dispose();
    this.renderTargetEdgeBuffer1.dispose();
    this.renderTargetEdgeBuffer2.dispose();
    this.depthMaterial.dispose();
    this.prepareMaskMaterial.dispose();
    this.edgeDetectionMaterial.dispose();
    this.separableBlurMaterial1.dispose();
    this.separableBlurMaterial2.dispose();
    this.overlayMaterial.dispose();
    this.materialCopy.dispose();
    this.fsQuad.dispose();
  }

  setSize(width, height) {
    this.resolution.set(width, height);

    this.renderTargetMaskBuffer.setSize(width, height);

    const newWidth = Math.round(width / this.downSampleRatio);
    const newHeight = Math.round(height / this.downSampleRatio);

    this.renderTargetMaskDownSampleBuffer.setSize(newWidth, newHeight);
    this.renderTargetBlurBuffer1.setSize(newWidth, newHeight);
    this.renderTargetEdgeBuffer1.setSize(newWidth, newHeight);
    this.separableBlurMaterial1.uniforms.texSize.value.set(newWidth, newHeight);

    this.renderTargetBlurBuffer2.setSize(newWidth, newHeight);
    this.renderTargetEdgeBuffer2.setSize(newWidth, newHeight);
    this.separableBlurMaterial2.uniforms.texSize.value.set(newWidth, newHeight);
  }

  changeVisibilityOfSelectedObjects(bVisible) {
    this.selectedObjects.forEach(object => {
      object.visible = bVisible;
    });
  }

  changeVisibilityOfNonSelectedObjects(bVisible) {
    const selectedMeshes = [];

    this.selectedObjects.forEach(object => {
      selectedMeshes.push(object);
    });

    this.renderScene.traverse(child => {
      if (child.isMesh && selectedMeshes.indexOf(child) === -1) {
        child.visible = bVisible;
      }
    });
  }

  updateTextureMatrix() {
    this.textureMatrix.set(0.5, 0.0, 0.0, 0.5, 0.0, 0.5, 0.0, 0.5, 0.0, 0.0, 0.5, 0.5, 0.0, 0.0, 0.0, 1.0);
    this.textureMatrix.multiply(this.renderCamera.projectionMatrix);
    this.textureMatrix.multiply(this.renderCamera.matrixWorldInverse);
  }

  render(renderer, writeBuffer, readBuffer, deltaTime, maskActive) {
    if (this.selectedObjects.length > 0) {
      renderer.getClearColor(this.oldClearColor);
      this.oldClearAlpha = renderer.getClearAlpha();
      const oldAutoClear = renderer.autoClear;

      renderer.autoClear = false;

      if (maskActive) {
        renderer.state.buffers.stencil.setTest(false);
      }

      renderer.setClearColor(0xffffff, 1);

      this.changeVisibilityOfSelectedObjects(false);
      this.changeVisibilityOfNonSelectedObjects(true);

      this.renderScene.overrideMaterial = this.depthMaterial;
      renderer.setRenderTarget(this.renderTargetDepthBuffer);
      renderer.clear();
      renderer.render(this.renderScene, this.renderCamera);

      this.changeVisibilityOfSelectedObjects(true);

      this.updateTextureMatrix();

      this.changeVisibilityOfNonSelectedObjects(false);

      this.renderScene.overrideMaterial = this.prepareMaskMaterial;
      this.prepareMaskMaterial.uniforms.cameraNearFar.value.set(this.renderCamera.near, this.renderCamera.far);
      this.prepareMaskMaterial.uniforms.depthTexture.value = this.renderTargetDepthBuffer.texture;
      this.prepareMaskMaterial.uniforms.textureMatrix.value = this.textureMatrix;
      renderer.setRenderTarget(this.renderTargetMaskBuffer);
      renderer.clear();
      renderer.render(this.renderScene, this.renderCamera);
      this.renderScene.overrideMaterial = null;

      this.changeVisibilityOfNonSelectedObjects(true);

      renderer.setRenderTarget(this.renderTargetMaskDownSampleBuffer);
      renderer.clear();
      this.fsQuad.material = this.materialCopy;
      this.copyUniforms.tDiffuse.value = this.renderTargetMaskBuffer.texture;
      this.fsQuad.render(renderer);

      this.tempPulseColor1.copy(this.visibleEdgeColor);
      this.tempPulseColor2.copy(this.hiddenEdgeColor);

      if (this.pulsePeriod > 0) {
        const scalar = (1 + 0.25) / 2 + (Math.cos((performance.now() * 0.01) / this.pulsePeriod) * (1.0 - 0.25)) / 2;
        this.tempPulseColor1.multiplyScalar(scalar);
        this.tempPulseColor2.multiplyScalar(scalar);
      }

      renderer.setRenderTarget(this.renderTargetEdgeBuffer1);
      renderer.clear();
      this.fsQuad.material = this.edgeDetectionMaterial;
      this.edgeDetectionMaterial.uniforms.maskTexture.value = this.renderTargetMaskDownSampleBuffer.texture;
      this.edgeDetectionMaterial.uniforms.texSize.value.set(
        this.renderTargetMaskDownSampleBuffer.width,
        this.renderTargetMaskDownSampleBuffer.height,
      );
      this.edgeDetectionMaterial.uniforms.edgeStrength.value = this.edgeStrength;
      this.fsQuad.render(renderer);

      renderer.setRenderTarget(this.renderTargetBlurBuffer1);
      renderer.clear();
      this.fsQuad.material = this.separableBlurMaterial1;
      this.separableBlurMaterial1.uniforms.colorTexture.value = this.renderTargetEdgeBuffer1.texture;
      this.separableBlurMaterial1.uniforms.direction.value = OutlinePass.BlurDirectionX;
      this.separableBlurMaterial1.uniforms.kernelRadius.value = this.edgeThickness;
      this.fsQuad.render(renderer);
      renderer.setRenderTarget(this.renderTargetEdgeBuffer1);
      renderer.clear();
      this.fsQuad.material = this.separableBlurMaterial1;
      this.separableBlurMaterial1.uniforms.colorTexture.value = this.renderTargetBlurBuffer1.texture;
      this.separableBlurMaterial1.uniforms.direction.value = OutlinePass.BlurDirectionY;
      this.fsQuad.render(renderer);

      renderer.setRenderTarget(this.renderTargetEdgeBuffer2);
      renderer.clear();
      this.fsQuad.material = this.edgeDetectionMaterial;
      this.edgeDetectionMaterial.uniforms.maskTexture.value = this.renderTargetMaskDownSampleBuffer.texture;
      this.edgeDetectionMaterial.uniforms.texSize.value.set(
        this.renderTargetMaskDownSampleBuffer.width,
        this.renderTargetMaskDownSampleBuffer.height,
      );
      this.edgeDetectionMaterial.uniforms.edgeStrength.value = this.edgeStrength;
      this.fsQuad.render(renderer);

      renderer.setRenderTarget(this.renderTargetBlurBuffer2);
      renderer.clear();
      this.fsQuad.material = this.separableBlurMaterial2;
      this.separableBlurMaterial2.uniforms.colorTexture.value = this.renderTargetEdgeBuffer2.texture;
      this.separableBlurMaterial2.uniforms.direction.value = OutlinePass.BlurDirectionX;
      this.separableBlurMaterial2.uniforms.kernelRadius.value = this.edgeGlow;
      this.fsQuad.render(renderer);
      renderer.setRenderTarget(this.renderTargetEdgeBuffer2);
      renderer.clear();
      this.fsQuad.material = this.separableBlurMaterial2;
      this.separableBlurMaterial2.uniforms.colorTexture.value = this.renderTargetBlurBuffer2.texture;
      this.separableBlurMaterial2.uniforms.direction.value = OutlinePass.BlurDirectionY;
      this.fsQuad.render(renderer);

      renderer.setClearColor(this.oldClearColor, this.oldClearAlpha);

      renderer.setRenderTarget(readBuffer);
      this.fsQuad.material = this.overlayMaterial;
      this.overlayMaterial.uniforms.blend.value = 1.0;
      this.overlayMaterial.uniforms.edgeStrength.value = this.edgeStrength;
      this.overlayMaterial.uniforms.edgeGlow.value = this.edgeGlow;
      this.overlayMaterial.uniforms.usePatternTexture.value = this.usePatternTexture;
      this.overlayMaterial.uniforms.edgeColor.value = this.tempPulseColor1;
      this.overlayMaterial.uniforms.edgeColor2.value = this.tempPulseColor2;
      this.overlayMaterial.uniforms.patternTexture.value = this.patternTexture;
      this.overlayMaterial.uniforms.blurTexture1.value = this.renderTargetEdgeBuffer1.texture;
      this.overlayMaterial.uniforms.blurTexture2.value = this.renderTargetEdgeBuffer2.texture;
      this.fsQuad.render(renderer);

      renderer.autoClear = oldAutoClear;
    }

    if (this.renderToScreen) {
      this.fsQuad.material = this.materialCopy;
      this.copyUniforms.tDiffuse.value = readBuffer.texture;
      this.fsQuad.render(renderer);
    }
  }

  getPrepareMaskMaterial() {
    return new ShaderMaterial({
      uniforms: {
        depthTexture: { value: null },
        cameraNearFar: { value: new Vector2(0.5, 0.5) },
        textureMatrix: { value: new Matrix4() },
      },

      vertexShader: [
        'varying vec4 projTexCoord;',
        'varying vec4 vPosition;',
        'uniform mat4 textureMatrix;',

        'void main() {',

        '	vPosition = modelViewMatrix * vec4( position, 1.0 );',
        '	vec4 worldPosition = modelMatrix * vec4( position, 1.0 );',
        '	projTexCoord = textureMatrix * worldPosition;',
        '	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',

        '}',
      ].join('\n'),

      fragmentShader: [
        '#include <packing>',
        'varying vec4 vPosition;',
        'varying vec4 projTexCoord;',
        'uniform sampler2D depthTexture;',
        'uniform vec2 cameraNearFar;',

        'void main() {',

        '	float depth = unpackRGBAToDepth(texture2DProj( depthTexture, projTexCoord ));',
        '	float viewZ = - DEPTH_TO_VIEW_Z( depth, cameraNearFar.x, cameraNearFar.y );',
        '	float diff = viewZ - vPosition.z;',
        '	if ( diff > 0.0 ) discard;',
        '	gl_FragColor = vec4(1.0);',

        '}',
      ].join('\n'),
    });
  }

  getEdgeDetectionMaterial() {
    return new ShaderMaterial({
      uniforms: {
        maskTexture: { value: null },
        texSize: { value: new Vector2(0.5, 0.5) },
        edgeStrength: { value: 1.0 },
      },

      vertexShader: [
        'varying vec2 vUv;',

        'void main() {',

        '	vUv = uv;',
        '	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',

        '}',
      ].join('\n'),

      fragmentShader: [
        'varying vec2 vUv;',
        'uniform sampler2D maskTexture;',
        'uniform vec2 texSize;',
        'uniform float edgeStrength;',

        'void main() {',

        '	vec2 invSize = 1.0 / texSize;',
        '	float a = texture2D(maskTexture, vUv).r;',
        '	float b = texture2D(maskTexture, vUv + vec2(invSize.x, 0.0)).r;',
        '	float c = texture2D(maskTexture, vUv + vec2(0.0, invSize.y)).r;',
        '	float d = texture2D(maskTexture, vUv + vec2(invSize.x, invSize.y)).r;',
        '	float e = texture2D(maskTexture, vUv + vec2(-invSize.x, 0.0)).r;',
        '	float f = texture2D(maskTexture, vUv + vec2(0.0, -invSize.y)).r;',
        '	float g = texture2D(maskTexture, vUv + vec2(-invSize.x, -invSize.y)).r;',
        '	float h = texture2D(maskTexture, vUv + vec2(invSize.x, -invSize.y)).r;',
        '	float i = texture2D(maskTexture, vUv + vec2(-invSize.x, invSize.y)).r;',

        '	float Gx = (c + 2.0 * f + i) - (a + 2.0 * b + e);',
        '	float Gy = (g + 2.0 * h + i) - (a + 2.0 * d + e);',

        '	float G = sqrt(Gx * Gx + Gy * Gy);',

        '	gl_FragColor = vec4(G * edgeStrength);',
        '	gl_FragColor.a = 1.0;',

        '}',
      ].join('\n'),
    });
  }

  getSeperableBlurMaterial(maxRadius) {
    return new ShaderMaterial({
      defines: {
        MAX_RADIUS: maxRadius,
      },

      uniforms: {
        colorTexture: { value: null },
        texSize: { value: new Vector2(0.5, 0.5) },
        direction: { value: new Vector2(0.5, 0.5) },
        kernelRadius: { value: 1.0 },
      },

      vertexShader: [
        'varying vec2 vUv;',

        'void main() {',

        '	vUv = uv;',
        '	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',

        '}',
      ].join('\n'),

      fragmentShader: [
        '#include <common>',
        'varying vec2 vUv;',
        'uniform sampler2D colorTexture;',
        'uniform vec2 texSize;',
        'uniform vec2 direction;',
        'uniform float kernelRadius;',

        'float gaussianPdf(in float x, in float sigma) {',
        '	return 0.39894 * exp( -0.5 * x * x/( sigma * sigma))/sigma;',
        '}',

        'void main() {',
        '	vec2 invSize = 1.0 / texSize;',
        '	float weightSum = gaussianPdf(0.0, kernelRadius);',
        '	vec4 diffuseSum = texture2D( colorTexture, vUv) * weightSum;',
        '	vec2 d = direction * invSize * kernelRadius/float(MAX_RADIUS);',
        '	for( int i = 1; i <= MAX_RADIUS; i ++ ) {',
        '		float x = float(i);',
        '		float w = gaussianPdf(x, kernelRadius);',
        '		vec2 uvOffset = d * x;',
        '		vec4 sample1 = texture2D( colorTexture, vUv + uvOffset);',
        '		vec4 sample2 = texture2D( colorTexture, vUv - uvOffset);',
        '		diffuseSum += (sample1 + sample2) * w;',
        '		weightSum += 2.0 * w;',
        '	}',
        '	gl_FragColor = diffuseSum/weightSum;',
        '}',
      ].join('\n'),
    });
  }

  getOverlayMaterial() {
    return new ShaderMaterial({
      uniforms: {
        blend: { value: 1.0 },
        edgeStrength: { value: 1.0 },
        edgeGlow: { value: 1.0 },
        usePatternTexture: { value: false },
        edgeColor: { value: new Color(0xffffff) },
        edgeColor2: { value: new Color(0xffffff) },
        patternTexture: { value: null },
        blurTexture1: { value: null },
        blurTexture2: { value: null },
      },

      vertexShader: [
        'varying vec2 vUv;',

        'void main() {',

        '	vUv = uv;',
        '	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',

        '}',
      ].join('\n'),

      fragmentShader: [
        'varying vec2 vUv;',
        'uniform float blend;',
        'uniform float edgeStrength;',
        'uniform float edgeGlow;',
        'uniform bool usePatternTexture;',
        'uniform vec3 edgeColor;',
        'uniform vec3 edgeColor2;',
        'uniform sampler2D patternTexture;',
        'uniform sampler2D blurTexture1;',
        'uniform sampler2D blurTexture2;',

        'vec2 GerstnerWave (vec2 p, vec2 D, float k, float a, float t) {',
        '	float g = 9.8;',
        '	float s = sqrt(g * k);',
        '	p.x += D.x * a * cos(k * dot(D, p) - s * t);',
        '	p.y += D.y * a * cos(k * dot(D, p) - s * t);',
        '	return p;',
        '}',

        'void main() {',
        '	vec4 edgeValue1 = texture2D(blurTexture1, vUv);',
        '	vec4 edgeValue2 = texture2D(blurTexture2, vUv);',
        '	vec4 patternColor = usePatternTexture ? texture2D(patternTexture, vUv) : vec4(0.0);',
        '	float visibilityFactor = 1.0 - edgeValue2.g > 0.0 ? 1.0 : 0.0;',
        '	vec3 finalColor = mix(edgeColor, edgeColor2, edgeValue1.g);',
        '	gl_FragColor = vec4(finalColor, visibilityFactor * mix(edgeValue2.g, 1.0, edgeGlow) * edgeValue1.g);',
        '}',
      ].join('\n'),
      transparent: true,
    });
  }
}

OutlinePass.BlurDirectionX = new Vector2(1.0, 0.0);
OutlinePass.BlurDirectionY = new Vector2(0.0, 1.0);

export { OutlinePass };
