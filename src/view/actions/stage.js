import { createSlice } from './rootStore';
import { stage } from 'view/global';
import {
  DEFAULT_CANVAS_BGCOLOR,
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_ZOOM,
  ZOOM_MIN,
  ZOOM_MAX,
  FIT_VIEWPORT_PADDING_RATIO,
  ZOOM_STEP,
} from 'view/constants';
import { clamp } from 'utils/math';
import { touchProject } from './project';

const initialState = {
  width: DEFAULT_CANVAS_WIDTH,
  height: DEFAULT_CANVAS_HEIGHT,
  backgroundColor: DEFAULT_CANVAS_BGCOLOR,
  zoom: DEFAULT_ZOOM,
  loading: false,
};

const stageStore = createSlice('stage');

export function updateStage(props) {
  stageStore.setState(props);

  stage.update(props);
}

export function updateCanvas(width, height, backgroundColor) {
  updateStage({ width, height, backgroundColor });

  touchProject();
}

export function setZoom(value) {
  updateStage({ zoom: clamp(value, ZOOM_MIN, ZOOM_MAX) });
}

export function zoomIn() {
  const { zoom } = stageStore.getState();

  const newValue = clamp(zoom - ZOOM_STEP, ZOOM_MIN, ZOOM_MAX);

  updateStage({ zoom: newValue });
}

export function zoomOut() {
  const { zoom } = stageStore.getState();

  const newValue = clamp(zoom + ZOOM_STEP, ZOOM_MIN, ZOOM_MAX);

  updateStage({ zoom: newValue });
}

export function fitToScreen() {
  const viewport = document.getElementById('viewport');
  const { width, height, zoom } = stageStore.getState();

  const newWidth = clamp((viewport.clientWidth * FIT_VIEWPORT_PADDING_RATIO) / width, ZOOM_MIN, ZOOM_MAX);
  const newHeight = clamp((viewport.clientHeight * FIT_VIEWPORT_PADDING_RATIO) / height, ZOOM_MIN, ZOOM_MAX);

  updateStage({ zoom: Math.min(newWidth, newHeight) });
}

export default stageStore;
