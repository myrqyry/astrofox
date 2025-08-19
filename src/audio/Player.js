import EventEmitter from 'core/EventEmitter';

const UPDATE_INTERVAL = 200;

export default class Player extends EventEmitter {
  constructor(context) {
    super();

    this.audioContext = context;
    this.nodes = [];
    this.audio = null;

    this.volume = this.audioContext.createGain();
    this.volume.connect(this.audioContext.destination);

    this.loop = false;
  }

  load(audio) {
    this.unload();

    this.audio = audio;
    this.audio.addNode(this.volume);

    this.emit('audio-load');
  }

  unload() {
    const { audio } = this;

    if (audio) {
      // Stop playback and ensure timers are cleared
      try {
        this.stop();
      } catch (e) {
        // ignore
      }

      // Let the Audio instance cleanup its own nodes/buffer
      try {
        if (typeof audio.unload === 'function') {
          audio.unload();
        }
      } catch (e) {
        // ignore
      }

      // Remove reference to audio so it can be garbage collected
      this.audio = null;

      this.emit('audio-unload');
    }
  }

  play() {
    const { audio } = this;

    if (audio) {
      if (audio.playing) {
        this.pause();
      } else {
        audio.play();

        this.timer = setInterval(() => {
          if (!audio.repeat && audio.getPosition() >= 1.0) {
            if (this.loop) {
              this.seek(0);
            } else {
              this.stop();
            }
          }

          this.emit('tick');
        }, UPDATE_INTERVAL);

        this.emit('play');
        this.emit('playback-change');
      }
    }
  }

  pause() {
    const { audio } = this;

    if (audio) {
      audio.pause();

      clearInterval(this.timer);

      this.emit('pause');
      this.emit('playback-change');
    }
  }

  stop() {
    const { audio } = this;

    if (audio) {
      audio.stop();
      clearInterval(this.timer);
      this.emit('stop');
      this.emit('playback-change');
    }
  }

  seek(val) {
    const { audio } = this;

    if (audio) {
      audio.seek(val);
      this.emit('seek');
    }
  }

  getAudio() {
    return this.audio;
  }

  hasAudio() {
    return !!this.getAudio();
  }

  setVolume(val) {
    if (this.volume) {
      this.volume.gain.value = val;
    }
  }

  getVolume() {
    return this.volume.gain.value;
  }

  getCurrentTime() {
    const { audio } = this;

    if (audio) {
      return audio.getCurrentTime();
    }
    return 0;
  }

  getDuration() {
    const { audio } = this;

    if (audio) {
      return audio.getDuration();
    }

    return 0;
  }

  getPosition() {
    const { audio } = this;

    if (audio) {
      return audio.getPosition();
    }

    return 0;
  }

  setLoop(val) {
    this.loop = val;
  }

  isPlaying() {
    return !!(this.audio && this.audio.playing);
  }

  isLooping() {
    return !!this.loop;
  }

  /**
   * Dispose player resources: stop playback, clear timers, disconnect volume node and
   * release references. Does NOT close the shared AudioContext.
   */
  dispose() {
    try {
      this.stop();
    } catch (e) {
      // ignore
    }

    try {
      clearInterval(this.timer);
    } catch (e) {
      // ignore
    }

    try {
      if (this.volume) {
        try {
          this.volume.disconnect();
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // ignore
    } finally {
      this.volume = null;
    }

    // Clear audio reference
    this.audio = null;
    this.nodes = [];
  }
}
