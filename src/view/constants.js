// Backwards-compatible re-exports for the centralized config.
// Many modules import from "view/constants" historically — keep that surface but
// forward to the new centralized config definitions in src/config/constants.js.
//
// Consumers should prefer importing from 'config/constants' directly in new code:
// import { GRAPHICS, AUDIO } from 'config/constants';
//
// This file intentionally re-exports commonly-used legacy names (FFT_SIZE, SAMPLE_RATE,
// DEFAULT_CANVAS_WIDTH, etc.) so existing imports continue working without changes.

import defaults from 'config/constants';

const { GRAPHICS, AUDIO, UI, VALIDATION } = defaults;

// Graphics / canvas defaults
export const DEFAULT_CANVAS_WIDTH = GRAPHICS.DEFAULT_CANVAS_WIDTH;
export const DEFAULT_CANVAS_HEIGHT = GRAPHICS.DEFAULT_CANVAS_HEIGHT;
export const DEFAULT_CANVAS_BGCOLOR = GRAPHICS.DEFAULT_CANVAS_BGCOLOR;
export const DEFAULT_ZOOM = GRAPHICS.DEFAULT_ZOOM;
export const ZOOM_MIN = GRAPHICS.ZOOM_MIN;
export const ZOOM_MAX = GRAPHICS.ZOOM_MAX;
export const ZOOM_STEP = GRAPHICS.ZOOM_STEP;
export const MIN_CANVAS_DIMENSION = GRAPHICS.MIN_CANVAS_DIMENSION;
export const DEFAULT_PIXEL_RATIO = GRAPHICS.DEFAULT_PIXEL_RATIO;
export const FIT_VIEWPORT_PADDING_RATIO = UI.FIT_VIEWPORT_PADDING_RATIO;

// Audio defaults (legacy flat names used across the codebase)
export const FFT_SIZE = AUDIO.FFT_SIZE;
export const SAMPLE_RATE = AUDIO.SAMPLE_RATE;
export const FFT_SIZES = AUDIO.FFT_SIZES;
export const ANALYZER_DEFAULTS = AUDIO.ANALYZER_DEFAULTS;
export const MIN_BUFFER_LENGTH = AUDIO.MIN_BUFFER_LENGTH;

// UI helpers
export const DEFAULT_PANEL_PADDING = UI.DEFAULT_PANEL_PADDING;
export const DEFAULT_MARGIN = UI.DEFAULT_MARGIN;
export const DEFAULT_DEBOUNCE_MS = UI.DEFAULT_DEBOUNCE_MS;

// Validation helpers
export const VALIDATION_RULES = VALIDATION;

// Also export grouped objects for folks migrating to the new structure
export const GRAPHICS_CONFIG = GRAPHICS;
export const AUDIO_CONFIG = AUDIO;
export const UI_CONFIG = UI;

// Default export (for convenience)
export default {
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_BGCOLOR,
  DEFAULT_ZOOM,
  ZOOM_MIN,
  ZOOM_MAX,
  FFT_SIZE,
  SAMPLE_RATE,
  FFT_SIZES,
  ANALYZER_DEFAULTS,
  MIN_BUFFER_LENGTH,
  DEFAULT_PANEL_PADDING,
  DEFAULT_MARGIN,
  FIT_VIEWPORT_PADDING_RATIO,
  VALIDATION_RULES,
};
