import config from '../config/config';

const cfg = config.get();

// Use graphics defaults where appropriate, but preserve fallbacks so behavior doesn't change
export const WINDOW_WIDTH = cfg.GRAPHICS && cfg.GRAPHICS.DEFAULT_CANVAS_WIDTH ? cfg.GRAPHICS.DEFAULT_CANVAS_WIDTH : 1320;
export const WINDOW_HEIGHT = cfg.GRAPHICS && cfg.GRAPHICS.DEFAULT_CANVAS_HEIGHT ? cfg.GRAPHICS.DEFAULT_CANVAS_HEIGHT : 1200;
export const WINDOW_MINWIDTH = 200;
export const WINDOW_MINHEIGHT = 100;
export const WINDOW_BGCOLOR = cfg.GRAPHICS && cfg.GRAPHICS.DEFAULT_CANVAS_BGCOLOR ? cfg.GRAPHICS.DEFAULT_CANVAS_BGCOLOR : '#222222';
