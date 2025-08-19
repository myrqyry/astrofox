// Centralized configuration and constants for Astrofox
// This file groups related defaults (audio, graphics, UI) into a single discoverable module.
// Consumers should import named constants they need, e.g.:
// import { AUDIO, GRAPHICS } from './config/constants';
//
// NOTE: These defaults are conservative and chosen to preserve existing behavior.
// If you want runtime overrides, use src/config/config.js (will be added in a subsequent change).

export const GRAPHICS = {
  // Canvas default dimensions used across the app
  DEFAULT_CANVAS_WIDTH: 800,
  DEFAULT_CANVAS_HEIGHT: 600,
  // Default background color used when creating new projects / canvases
  DEFAULT_CANVAS_BGCOLOR: '#000000',
  // Default zoom level & clamped ranges used by UI for zoom controls
  DEFAULT_ZOOM: 1,
  ZOOM_MIN: 0.1,
  ZOOM_MAX: 1,
  // Recommended step when increasing/decreasing zoom from UI controls
  ZOOM_STEP: 0.1,

  // Minimum allowed canvas size for safe operations (used where code currently uses "1")
  MIN_CANVAS_DIMENSION: 1,

  // Pixel ratio fallback when renderer doesn't provide one
  DEFAULT_PIXEL_RATIO: 1,
};

export const AUDIO = {
  // Typical WebAudio sample rate. Meyda / AudioContext will usually use system sample rate;
  // this default is used when code needs an explicit value.
  SAMPLE_RATE: 44100,

  // Default FFT size used for analyzers (must be power of two)
  FFT_SIZE: 1024,
  // Common alternative FFT sizes
  FFT_SIZES: [256, 512, 1024, 2048, 4096],

  // Analyzer / Spectrum defaults (these mirror existing hard-coded values in the codebase)
  ANALYZER_DEFAULTS: {
    MIN_DECIBELS: -100,
    MAX_DECIBELS: 0,
    SMOOTHING_TIME_CONSTANT: 0,
  },

  // Safety: default buffer min length when creating arrays
  MIN_BUFFER_LENGTH: 1,
};

export const UI = {
  // UI timing / thresholds — keep here so components don't hardcode them
  // Example: panels, animation timeouts, tooltip delays, etc.
  DEFAULT_PANEL_PADDING: 8,
  DEFAULT_MARGIN: 8,

  // Viewport fit clamp behavior (mirrors existing clamp usage)
  FIT_VIEWPORT_PADDING_RATIO: 0.8,

  // Spinner / debounce defaults
  DEFAULT_DEBOUNCE_MS: 200,
};

export const VALIDATION = {
  // Simple validation limits for configuration values (used by config utilities)
  MIN_FFT_SIZE: 16,
  MAX_FFT_SIZE: 65536,
  MIN_SAMPLE_RATE: 8000,
  MAX_SAMPLE_RATE: 192000,
};

export default {
  GRAPHICS,
  AUDIO,
  UI,
  VALIDATION,
};