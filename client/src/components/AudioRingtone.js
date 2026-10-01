/**
 * Synthesizes a soft, premium monochrome chime ringtone via Web Audio API.
 * Guarantees crisp zero-latency playback with no external asset dependency.
 */

class AudioRingtone {
  constructor() {
    this.audioCtx = null;
    this.intervalId = null;
    this.isPlaying = false;
  }

  init() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playTone(frequency, duration, delay = 0) {
    if (!this.audioCtx) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, this.audioCtx.currentTime + delay);

    gain.gain.setValueAtTime(0, this.audioCtx.currentTime + delay);
    gain.gain.linearRampToValueAtTime(0.2, this.audioCtx.currentTime + delay + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + delay + duration);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(this.audioCtx.currentTime + delay);
    osc.stop(this.audioCtx.currentTime + delay + duration);
  }

  start() {
    if (this.isPlaying) return;
    this.init();
    this.isPlaying = true;

    const playPattern = () => {
      // Elegant minimal two-tone chime
      this.playTone(880, 0.4, 0);       // A5
      this.playTone(1174.66, 0.6, 0.2); // D6
    };

    playPattern();
    this.intervalId = setInterval(playPattern, 2000);
  }

  stop() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const ringtone = new AudioRingtone();
