import Entity from 'core/Entity';
import fft from 'fourier-transform';
import blackman from 'window-function/blackman';
import { FFT_SIZE, ANALYZER_DEFAULTS } from 'view/constants';
import { mag2db, normalize } from 'utils/math';
import { downmix } from 'utils/audio';
import { updateExistingProps } from '../utils/object';

export default class SpectrumAnalyzer extends Entity {
  static defaultProperties = {
    fftSize: FFT_SIZE,
    minDecibels: ANALYZER_DEFAULTS.MIN_DECIBELS,
    maxDecibels: ANALYZER_DEFAULTS.MAX_DECIBELS,
    smoothingTimeConstant: ANALYZER_DEFAULTS.SMOOTHING_TIME_CONSTANT,
  };

  constructor(context, properties) {
    super('SpectrumAnalyzer', { ...SpectrumAnalyzer.defaultProperties, ...properties });

    this.audioContext = context;

    this.analyzer = Object.assign(context.createAnalyser(), this.properties);

    this.init();
  }

  update(properties) {
    const changed = super.update(properties);

    const { fftSize } = properties;

    if (changed) {
      updateExistingProps(this.analyzer, properties);

      if (fftSize !== undefined) {
        this.init();
      }
    }

    return changed;
  }

  init() {
    // Clean up existing resources before re-initializing
    this._disposeBuffers();

    const { audioContext, analyzer: { fftSize } } = this;

    this.fft = new Uint8Array(fftSize / 2);
    this.td = new Float32Array(fftSize);

    this.blackmanTable = new Float32Array(fftSize);

    for (let i = 0; i < fftSize; i++) {
      this.blackmanTable[i] = blackman(i, fftSize);
    }

    this.buffer = audioContext.createBuffer(1, fftSize, audioContext.sampleRate);

    this.smoothing = new Float32Array(fftSize / 2);
  }

  get gain() {
    const { fft } = this;
    return fft.reduce((a, b) => a + b) / fft.length;
  }

  getFloatTimeDomainData(array) {
    if (!this.buffer) {
      // If buffer has been released, fill with zeros to avoid errors
      array.fill(0);
      return;
    }

    array.set(this.buffer.getChannelData(0));
  }

  getFloatFrequencyData(array) {
    const { fftSize, smoothingTimeConstant } = this.analyzer;
    const waveform = new Float32Array(fftSize);

    // Get waveform from buffer
    this.getFloatTimeDomainData(waveform);

    // Apply blackman function
    for (let i = 0; i < fftSize; i++) {
      waveform[i] = waveform[i] * this.blackmanTable[i] || 0;
    }

    // Get FFT
    const spectrum = fft(waveform);

    for (let i = 0, n = fftSize / 2; i < n; i++) {
      let db = mag2db(spectrum[i]);

      if (smoothingTimeConstant) {
        this.smoothing[i] =
          spectrum[i] * smoothingTimeConstant * this.smoothing[i] + (1 - smoothingTimeConstant);

        db = mag2db(this.smoothing[i]);
      }

      array[i] = Number.isFinite(db) ? db : -Infinity;
    }
  }

  getByteTimeDomainData(array) {
    const { fftSize } = this.analyzer;
    const waveform = new Float32Array(fftSize);

    this.getFloatTimeDomainData(waveform);

    for (let i = 0, n = waveform.length; i < n; i++) {
      array[i] = Math.round(normalize(waveform[i], -1, 1) * 255);
    }
  }

  getByteFrequencyData(array) {
    const { minDecibels, maxDecibels, frequencyBinCount } = this.analyzer;
    const spectrum = new Float32Array(frequencyBinCount);

    this.getFloatFrequencyData(spectrum);

    for (let i = 0, n = spectrum.length; i < n; i++) {
      array[i] = Math.round(normalize(spectrum[i], minDecibels, maxDecibels) * 255);
    }
  }

  process(input) {
    if (input) {
      const data = downmix(input);
      this.buffer.copyToChannel(data, 0);
    }

    this.updateTimeData(input);
    this.updateFrequencyData(input);
  }

  updateFrequencyData(input) {
    if (input) {
      this.getByteFrequencyData(this.fft);
    } else {
      this.analyzer.getByteFrequencyData(this.fft);
    }
  }

  updateTimeData(input) {
    if (input) {
      this.getFloatTimeDomainData(this.td);
    } else {
      this.analyzer.getFloatTimeDomainData(this.td);
    }
  }

  reset() {
    this.fft.fill(0);
    this.td.fill(0);
    this.smoothing.fill(0);
  }

  /**
   * Disposes of internal buffers.
   * This is called automatically by init() to clean up before re-creating resources.
   */
  _disposeBuffers() {
    // Clear references to large arrays/buffers so garbage collector can reclaim memory
    try {
      if (this.fft) {
        this.fft = null;
      }
      if (this.td) {
        this.td = null;
      }
      if (this.smoothing) {
        this.smoothing = null;
      }
      if (this.blackmanTable) {
        this.blackmanTable = null;
      }
      if (this.buffer) {
        // Breaking references to allow GC. For AudioBuffer, this is often sufficient
        // as long as it's not connected to anything.
        this.buffer = null;
      }
    } catch (e) {
      // ignore
    }
  }

  /**
   * Dispose of internal buffers and disconnect any Web Audio nodes created by this analyzer.
   * Does NOT close the provided AudioContext (caller owns that).
   */
  destroy() {
    try {
      if (this.analyzer && typeof this.analyzer.disconnect === 'function') {
        try {
          this.analyzer.disconnect();
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // ignore
    }

    this._disposeBuffers();
  }
}
