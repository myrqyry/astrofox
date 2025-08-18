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

    this.analyzer = null;

    this.init();
  }

  init() {
    const { fftSize, sampleRate, features } = this.properties;

    this.analyzer = Meyda.createMeydaAnalyzer({
      audioContext: new (window.AudioContext || window.webkitAudioContext)(),
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
