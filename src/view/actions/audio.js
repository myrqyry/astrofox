import { createSlice } from './rootStore';
import { api, analyzer, logger, player } from 'global';
import { loadAudioData } from 'utils/audio';
import { trimChars } from 'utils/string';
import appStore from './app';
import configStore from './config';
import { raiseError, withErrorHandler, wrapAsync } from './error';

export const initialState = {
  file: '',
  duration: 0,
  loading: false,
  tags: null,
  error: null,
};

const audioStore = createSlice('audio');

export const loadAudioFile = withErrorHandler(async (file, play) => {
  audioStore.setState({ loading: true });

  // Stop any existing playback before loading new file (best-effort)
  try {
    player.stop();
  } catch (e) {
    logger.warn('player.stop() failed while loading new file', e && (e.stack || e.message || e));
  }

  logger.time('audio-file-load');

  try {
    // Read file (may throw) - wrapAsync will surface to raiseError if rejected
    const data = await wrapAsync(api.readAudioFile(file), 'Failed to read audio file');

    // decode and construct audio object (may throw)
    const audio = await loadAudioData(data);
    const duration = audio.getDuration();

    // Attach to player and analyzer
    player.load(audio);
    try {
      audio.addNode(analyzer.analyzer);
    } catch (e) {
      logger.warn('audio.addNode failed', e && (e.stack || e.message || e));
    }

    // Respect configured autoplay behavior
    if (!play) {
      play = configStore.getState().autoPlayAudio;
    }

    if (play) {
      try {
        player.play();
      } catch (e) {
        // Surface playback errors but continue to set state
        raiseError('Failed to start playback', e);
      }
    }

    logger.timeEnd('audio-file-load', 'Audio file loaded:', file);

    // Load tags (best-effort)
    let tags = null;
    try {
      tags = await wrapAsync(api.loadAudioTags(file), 'Failed to load audio tags');
    } catch (e) {
      // already reported by wrapAsync; continue without tags
      tags = null;
    }

    if (tags) {
      const { artist, title } = tags;
      appStore.setState({ statusText: trimChars(`${artist} - ${title}`) });
    } else {
      appStore.setState({ statusText: trimChars(file) });
    }

    audioStore.setState({ file, duration, tags, loading: false });
    return { file, duration, tags };
  } finally {
    // Ensure loading flag is cleared even if an error is thrown
    audioStore.setState(state => ({ ...state, loading: false }));
  }
}, 'Failed to load audio file');

export const openAudioFile = withErrorHandler(async (play) => {
  try {
    const { filePaths, canceled } = await wrapAsync(
      api.showOpenDialog({
        filters: [
          {
            name: 'audio files',
            extensions: ['aac', 'flac', 'mp3', 'm4a', 'opus', 'ogg', 'wav'],
          },
        ],
      }),
      'Failed to open file dialog'
    );

    if (!canceled && filePaths && filePaths[0]) {
      if (!play) {
        play = configStore.getState().autoPlayAudio;
      }

      // Let loadAudioFile handle its own errors (it is wrapped)
      await loadAudioFile(filePaths[0], play);
    }
  } catch (e) {
    // withErrorHandler will have already raised the error; swallow here to avoid double-reporting
    throw e;
  }
}, 'Failed to open audio file');

export default audioStore;
