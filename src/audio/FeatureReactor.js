import cloneDeep from 'lodash/cloneDeep';
import Entity from 'core/Entity';
import FeatureExtractor from 'audio/FeatureExtractor';
import { getDisplayName } from 'utils/controls';
import { FFT_SIZE, SAMPLE_RATE } from 'view/constants';

const featureOptions = ['rms', 'spectralCentroid', 'spectralRolloff', 'energy', 'spectralFlatness', 'spectralFlux'];

export default class FeatureReactor extends Entity {
  static config = {
    name: 'FeatureReactor',
    description: 'Audio feature reactor.',
    type: 'reactor',
    label: 'Feature Reactor',
    defaultProperties: {
      feature: 'rms',
    },
    controls: {
      feature: {
        label: 'Feature',
        type: 'select',
        items: featureOptions,
      },
    },
  };

  constructor(properties) {
    const {
      config: { name, label, defaultProperties },
    } = FeatureReactor;

    super(name, { ...defaultProperties, ...properties });

    this.extractor = new FeatureExtractor({
      fftSize: FFT_SIZE,
      sampleRate: SAMPLE_RATE,
      features: [this.properties.feature],
    });

    this.type = 'reactor';
    this.displayName = getDisplayName(label);
    this.enabled = true;
    this.result = { output: 0 };
  }

  update(properties = {}) {
    const { feature } = properties;

    if (feature) {
      this.extractor.update({ features: [feature] });
    }

    return super.update(properties);
  }

  getResult() {
    return this.result;
  }

  parse(data) {
    const { audioBuffer } = data;
    const { feature } = this.properties;

    if (audioBuffer) {
      const features = this.extractor.process(audioBuffer);
      if (features) {
        this.result.output = features[feature];
      }
    }

    return this.result;
  }

  toJSON() {
    const { id, name, type, displayName, enabled, properties } = this;

    return {
      id,
      name,
      type,
      displayName,
      enabled,
      properties: cloneDeep(properties),
    };
  }
}
