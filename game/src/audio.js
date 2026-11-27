// All sound is synthesised with WebAudio: no audio files, no network. A
// cheerful little banjo-ish loop under the run, and one short cue per event —
// gobble, jump, pickup, stumble, caught, escaped. Created on the first user
// gesture, so autoplay rules never block it; screenshots stay silent.

export function createAudio() {
  let context = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  // A bouncy 8-step loop in C major pentatonic, plucked, very quiet.
  const MELODY = [523, 659, 784, 659, 587, 784, 880, 784];
  const BASS = [131, 131, 175, 131, 196, 175, 131, 98];

  function ensure() {
    if (context) return context;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    context = new AudioContext();
    return context;
  }

  function tone(freq, at, length, type, volume) {
    if (!context || muted) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + length);
    osc.connect(gain).connect(context.destination);
    osc.start(at);
    osc.stop(at + length + 0.02);
  }

  function startMusic() {
    if (musicTimer !== null || !context) return;
    musicTimer = window.setInterval(() => {
      if (muted || !context) return;
      const at = context.currentTime + 0.05;
      tone(MELODY[musicStep % MELODY.length], at, 0.22, 'triangle', 0.05);
      tone(BASS[musicStep % BASS.length], at, 0.3, 'sine', 0.07);
      musicStep += 1;
    }, 240);
  }

  return {
    /** Call from any user gesture; unlocks audio and starts the music. */
    unlock() {
      const ctx = ensure();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();
      startMusic();
    },
    setMuted(value) {
      muted = value;
    },
    isMuted() {
      return muted;
    },
    gobble() {
      if (!ensure()) return;
      const at = context.currentTime;
      [660, 520, 620, 440].forEach((freq, i) => tone(freq, at + i * 0.07, 0.09, 'sawtooth', 0.06));
    },
    jump() {
      if (!ensure()) return;
      const at = context.currentTime;
      tone(300, at, 0.14, 'sine', 0.09);
      tone(520, at + 0.06, 0.12, 'sine', 0.07);
    },
    pickup() {
      if (!ensure()) return;
      const at = context.currentTime;
      tone(880, at, 0.1, 'triangle', 0.09);
      tone(1318, at + 0.08, 0.14, 'triangle', 0.09);
    },
    feather() {
      if (!ensure()) return;
      const at = context.currentTime;
      [784, 988, 1175, 1568].forEach((freq, i) => tone(freq, at + i * 0.07, 0.14, 'triangle', 0.08));
    },
    stumble() {
      if (!ensure()) return;
      const at = context.currentTime;
      tone(160, at, 0.2, 'square', 0.1);
      tone(90, at + 0.08, 0.25, 'square', 0.1);
    },
    caught() {
      if (!ensure()) return;
      const at = context.currentTime;
      [392, 370, 349, 311].forEach((freq, i) => tone(freq, at + i * 0.16, 0.22, 'sawtooth', 0.08));
    },
    escaped() {
      if (!ensure()) return;
      const at = context.currentTime;
      [523, 659, 784, 1046, 1318].forEach((freq, i) => tone(freq, at + i * 0.09, 0.2, 'triangle', 0.09));
    },
  };
}
