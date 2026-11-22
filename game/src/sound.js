// Emberfall Duel — sound. No audio files: every blip is a small WebAudio oscillator, made
// on the spot, so the game still loads nothing over the network. Sound starts only after
// the player has clicked something, as browsers require.
let context = null;
let muted = false;

/** Create (or reuse) the audio context, once the player has interacted. */
function ensureContext() {
  if (context === null) {
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContext) return null;
    context = new AudioContext();
  }
  if (context.state === 'suspended') void context.resume();
  return context;
}

/** One short tone: frequency, length in seconds, shape and volume. */
function tone(freq, seconds, type = 'sine', volume = 0.12, when = 0) {
  if (muted) return;
  const ctx = ensureContext();
  if (!ctx) return;
  const start = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + seconds + 0.02);
}

/** The named game sounds, each a tiny phrase of tones. */
export const sounds = {
  click() { tone(660, 0.06, 'triangle', 0.08); },
  playCard() { tone(392, 0.1, 'triangle', 0.12); tone(523, 0.12, 'triangle', 0.1, 0.07); },
  attack() { tone(220, 0.12, 'sawtooth', 0.1); tone(110, 0.16, 'sawtooth', 0.1, 0.05); },
  hurt() { tone(180, 0.18, 'square', 0.07); },
  heal() { tone(523, 0.12, 'sine', 0.1); tone(784, 0.16, 'sine', 0.09, 0.09); },
  draw() { tone(880, 0.05, 'sine', 0.06); },
  turn() { tone(440, 0.09, 'triangle', 0.09); tone(587, 0.1, 'triangle', 0.08, 0.08); },
  win() {
    [523, 659, 784, 1047].forEach((freq, i) => tone(freq, 0.22, 'triangle', 0.12, i * 0.12));
  },
  lose() {
    [392, 330, 262, 196].forEach((freq, i) => tone(freq, 0.26, 'sine', 0.1, i * 0.15));
  },
};

/** Flip the mute; returns the new state. */
export function toggleMute() {
  muted = !muted;
  return muted;
}

/** Is sound currently off? */
export function isMuted() {
  return muted;
}
