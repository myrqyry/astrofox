export default class Audio {
  constructor(context) {
    this.audioContext = context;
    this.source = null;
    this.buffer = null;
    this.startTime = 0;
    this.stopTime = 0;
    this.nodes = [];
    this.playing = false;
    this.paused = false;
    this.repeat = false;
  }

  load(src) {
    if (typeof src === 'string') {
      return this.loadUrl(src);
    } else if (src instanceof ArrayBuffer) {
      return this.loadData(src);
    } else if (src instanceof AudioBuffer) {
      return this.loadBuffer(src);
    }

    throw new Error(`Invalid source: ${typeof src}`);
  }

  unload() {
    // Stop playback and remove audio resources.
    try {
      // Stop and disconnect source if present
      if (this.source) {
        try {
          if (this.playing) this.source.stop();
        } catch (e) {
          // Some implementations throw if source already stopped - ignore
        }
        try {
          this.source.disconnect();
        } catch (e) {
          // ignore
        }
        this.source = null;
      }

      // Disconnect/cleanup any attached nodes (gain, analysers, etc.)
      this.disconnectNodes();
      this.nodes = [];

      // Release buffer reference so it can be GC'd
      this.buffer = null;
    } catch (err) {
      // Best-effort cleanup; don't throw during unload
    }
  }

  // Loads a url via AJAX
  async loadUrl(url) {
    const response = await fetch(url);
    return this.loadData(response);
  }

  // Decodes an ArrayBuffer into an AudioBuffer
  async loadData(data) {
    const buffer = await this.audioContext.decodeAudioData(data);
    return this.loadBuffer(buffer);
  }

  // Loads an AudioBuffer
  loadBuffer(buffer) {
    this.buffer = buffer;
  }

  addNode(node) {
    if (this.nodes.indexOf(node) < 0) {
      this.nodes.push(node);
    }
  }

  removeNode(node) {
    const index = this.nodes.indexOf(node);

    if (index > -1) {
      this.nodes.splice(index, 1);
    }
  }

  reconnectNodes() {
    this.nodes.forEach(node => {
      this.source.connect(node);
    });
  }

  disconnectNodes() {
    this.nodes.forEach(node => {
      node.disconnect();
    });
  }

  initBuffer() {
    this.source = this.audioContext.createBufferSource();
    this.source.buffer = this.buffer;

    this.reconnectNodes();
  }

  play() {
    if (this.buffer) {
      this.initBuffer();

      this.startTime = this.audioContext.currentTime;
      this.source.start(0, this.getCurrentTime());
      this.playing = true;
      this.paused = false;
    }
  }

  pause() {
    if (this.source) {
      this.source.stop();
      this.source = null;
    }

    this.stopTime += this.audioContext.currentTime - this.startTime;
    this.playing = false;
    this.paused = true;
  }

  stop() {
    // Stop playback and safely disconnect source
    try {
      if (this.source) {
        try {
          if (this.playing) this.source.stop();
        } catch (e) {
          // ignore stop errors
        }
        try {
          this.source.disconnect();
        } catch (e) {
          // ignore disconnect errors
        }
        this.source = null;
      }
    } catch (err) {
      // ignore
    } finally {
      this.stopTime = 0;
      this.playing = false;
      this.paused = false;
    }
  }

  /**
   * Fully dispose of this Audio instance: stop playback, disconnect nodes,
   * release buffers and clear node references. Does NOT close the shared AudioContext.
   */
  dispose() {
    try {
      this.stop();
    } catch (e) {
      // ignore
    }

    try {
      this.disconnectNodes();
    } catch (e) {
      // ignore
    }

    // Clear nodes array and buffer reference to allow GC
    this.nodes = [];
    this.buffer = null;
    this.source = null;
  }

  seek(pos) {
    if (this.playing) {
      this.stop();
      this.updatePosition(pos);
      this.play();
    } else {
      this.updatePosition(pos);
    }
  }

  getCurrentTime() {
    return this.playing
      ? this.stopTime + (this.audioContext.currentTime - this.startTime)
      : this.stopTime;
  }

  getDuration() {
    return this.buffer ? this.buffer.duration : 0;
  }

  getBufferLength() {
    return this.buffer ? this.buffer.length : 0;
  }

  getPosition() {
    return this.getCurrentTime() / this.getDuration() || 0;
  }

  getBufferPosition(time) {
    const position = time ? time / this.getDuration() : this.getPosition();
    return ~~(position * this.buffer.length);
  }

  getAudioSlice(start, end) {
    const channels = this.buffer.numberOfChannels;
    const length = end - start;
    const output = this.audioContext.createBuffer(channels, length, this.audioContext.sampleRate);

    for (let i = 0; i < channels; i++) {
      const ch = output.getChannelData(i);
      const buffer = this.buffer.getChannelData(i);

      for (let j = start; j < end; j++) {
        ch[j - start] = buffer[j];
      }
    }

    return output;
  }

  updatePosition(pos) {
    this.stopTime = ~~(pos * this.buffer.duration);
  }
}
