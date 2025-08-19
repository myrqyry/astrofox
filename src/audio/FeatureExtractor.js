import Meyda from 'meyda';
import Entity from 'core/Entity';
import { FFT_SIZE, SAMPLE_RATE } from 'view/constants';
import { downmix } from 'utils/audio';

export default class FeatureExtractor extends Entity {
  static defaultProperties = {
    fftSize: FFT_SIZE,
    sampleRate: SAMPLE_RATE,
    features: ['rms', 'spectralCentroid', 'spectralRolloff'],
  };

  constructor(properties) {
    super('FeatureExtractor', { ...FeatureExtractor.defaultProperties, ...properties });

    // If an AudioContext is provided via properties, use it. Otherwise we'll create one and track ownership.
    this.analyzer = null;
    this.audioContext = this.properties.audioContext || null;
    this._ownsAudioContext = false;

    this.init();
  }

  init() {
    const { fftSize, sampleRate, features } = this.properties;

    // If analyzer already exists, stop and release it before re-initializing
    try {
      if (this.analyzer && typeof this.analyzer.stop === 'function') {
        this.analyzer.stop();
      }
    } catch (e) {
      // ignore
    }

    // Ensure we have an AudioContext to pass to Meyda. Reuse provided context when possible.
    if (!this.audioContext) {
      /* eslint-disable no-undef */
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      /* eslint-enable no-undef */
      this._ownsAudioContext = true;
    }

    this.analyzer = Meyda.createMeydaAnalyzer({
      audioContext: this.audioContext,
      sampleRate,
      bufferSize: fftSize,
      featureExtractors: features,
    });
  }

  update(properties) {
    const changed = super.update(properties);

    if (changed) {
      this.init();
    }

    return changed;
  }

  process(input) {
    if (input) {
      const data = downmix(input);
      return this.analyzer.get(data);
    }

    return null;
  }
}

// Add explicit cleanup so whoever creates FeatureExtractor can dispose of resources.
FeatureExtractor.prototype.dispose = function dispose() {
  try {
    if (this.analyzer && typeof this.analyzer.stop === 'function') {
      this.analyzer.stop();
    }
  } catch (e) {
    // ignore
  }

  this.analyzer = null;

  if (this._ownsAudioContext && this.audioContext) {
    try {
      // Close the AudioContext we created to release resources.
      if (typeof this.audioContext.close === 'function') {
        this.audioContext.close();
      }
    } catch (e) {
      // ignore
    } finally {
      this.audioContext = null;
      this._ownsAudioContext = false;
    }
  }
};
