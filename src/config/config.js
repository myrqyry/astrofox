// Central configuration runtime API for Astrofox.
//
// Purpose:
// - Provide a single programmatic API to read and override configuration at runtime.
// - Merge runtime overrides with compile-time defaults from src/config/constants.js.
// - Provide basic validation helpers for common config values (FFT size, sample rate).
//
// Usage examples:
// import config from 'config/config';
// const cfg = config.get(); // full merged config
// config.set({ AUDIO: { FFT_SIZE: 2048 } }); // merge overrides
// config.validate(); // throws on invalid values
//
// Notes:
// - This module keeps runtime overrides in-memory only; it does not persist to disk.
// - For persistent or environment-specific config, add a loader that merges with these defaults.

import cloneDeep from 'lodash/cloneDeep';
import {
  GRAPHICS,
  AUDIO,
  UI,
  VALIDATION,
} from './constants';

/**
 * The runtimeConfig starts as a deep clone of the compiled defaults and may be
 * mutated via set / reset APIs below.
 */
let runtimeConfig = {
  GRAPHICS: cloneDeep(GRAPHICS),
  AUDIO: cloneDeep(AUDIO),
  UI: cloneDeep(UI),
  VALIDATION: cloneDeep(VALIDATION),
};

/**
 * Validate the current runtime config. Throws an Error describing the first
 * validation failure encountered.
 *
 * Checks performed:
 * - FFT_SIZE within VALIDATION.MIN_FFT_SIZE .. VALIDATION.MAX_FFT_SIZE
 * - SAMPLE_RATE within VALIDATION.MIN_SAMPLE_RATE .. VALIDATION.MAX_SAMPLE_RATE
 *
 * You can call this before applying config that may come from untrusted sources.
 */
export function validate(cfg = runtimeConfig) {
  const errors = [];

  const fftSize = cfg.AUDIO && cfg.AUDIO.FFT_SIZE;
  if (typeof fftSize === 'number') {
    if (fftSize < cfg.VALIDATION.MIN_FFT_SIZE || fftSize > cfg.VALIDATION.MAX_FFT_SIZE) {
      errors.push(
        `AUDIO.FFT_SIZE (${fftSize}) must be between ${cfg.VALIDATION.MIN_FFT_SIZE} and ${cfg.VALIDATION.MAX_FFT_SIZE}`
      );
    } else if ((fftSize & (fftSize - 1)) !== 0) {
      // FFT_SIZE must be a power of two
      errors.push(`AUDIO.FFT_SIZE (${fftSize}) must be a power of two`);
    }
  }

  const sampleRate = cfg.AUDIO && cfg.AUDIO.SAMPLE_RATE;
  if (typeof sampleRate === 'number') {
    if (sampleRate < cfg.VALIDATION.MIN_SAMPLE_RATE || sampleRate > cfg.VALIDATION.MAX_SAMPLE_RATE) {
      errors.push(
        `AUDIO.SAMPLE_RATE (${sampleRate}) must be between ${cfg.VALIDATION.MIN_SAMPLE_RATE} and ${cfg.VALIDATION.MAX_SAMPLE_RATE}`
      );
    }
  }

  if (errors.length) {
    const err = new Error(`Config validation failed: ${errors.join('; ')}`);
    err.details = errors;
    throw err;
  }

  return true;
}

/**
 * Get a deep-cloned snapshot of the merged runtime configuration.
 * If a path function is provided, it will be called with the runtimeConfig and
 * its return value will be returned instead (convenience for selectors).
 *
 * Examples:
 *   get(); // returns full config object
 *   get(cfg => cfg.AUDIO.FFT_SIZE); // returns fft size only
 */
export function get(selector) {
  const snapshot = cloneDeep(runtimeConfig);
  if (typeof selector === 'function') {
    return selector(snapshot);
  }
  return snapshot;
}

/**
 * Merge a partial config object into the runtime config.
 * Performs shallow merges at the top-level groups (GRAPHICS, AUDIO, UI).
 * After merging, validate() is run and will throw if the combined config is invalid.
 *
 * Example:
 *   set({ AUDIO: { FFT_SIZE: 2048 } });
 */
export function set(partial) {
  if (!partial || typeof partial !== 'object') return runtimeConfig;

  const merged = cloneDeep(runtimeConfig);

  if (partial.GRAPHICS) merged.GRAPHICS = { ...merged.GRAPHICS, ...partial.GRAPHICS };
  if (partial.AUDIO) merged.AUDIO = { ...merged.AUDIO, ...partial.AUDIO };
  if (partial.UI) merged.UI = { ...merged.UI, ...partial.UI };
  if (partial.VALIDATION) merged.VALIDATION = { ...merged.VALIDATION, ...partial.VALIDATION };

  // Validate merged before applying to runtime
  validate(merged);

  runtimeConfig = merged;
  return get();
}

/**
 * Reset runtime overrides and return a fresh copy of the defaults.
 */
export function reset() {
  runtimeConfig = {
    GRAPHICS: cloneDeep(GRAPHICS),
    AUDIO: cloneDeep(AUDIO),
    UI: cloneDeep(UI),
    VALIDATION: cloneDeep(VALIDATION),
  };
  return get();
}

/**
 * Convenience default export that exposes the API in a compact form.
 */
const config = {
  get,
  set,
  reset,
  validate,
};

export default config;