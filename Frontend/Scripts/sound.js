/* Optional sound effects (Web Audio API). Off by default and never autoplay:
   the AudioContext is only created after the user turns sound effects on (a click). */

const STORAGE_KEY = 'resonate:soundEffects';
let enabled = readSetting();
let ctx = null;

function readSetting() {
    try { return localStorage.getItem(STORAGE_KEY) === 'on'; } catch { return false; }
}
function saveSetting(on) {
    try { localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off'); } catch { /* private mode: setting lasts for this page only */ }
}

export function soundEnabled() { return enabled; }

// Shared context, created lazily. Call only from a user action or while sound effects are on.
export function getAudioContext() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
}

export function setSoundEnabled(on) {
    if (on === enabled) return;
    if (!on) cues.off();                 // last cue plays before going quiet
    enabled = on;
    saveSetting(on);
    if (on) cues.on();
    document.dispatchEvent(new CustomEvent('soundeffects-change', { detail: { enabled: on } }));
}

/* One short note. pan: -1 = left ear, 0 = middle, 1 = right ear. */
export function playTone({ freq = 660, duration = 0.12, pan = 0, type = 'sine', delay = 0, volume = 0.16 } = {}) {
    if (!enabled) return;
    const c = getAudioContext();
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    const panner = c.createStereoPanner();
    osc.type = type;
    osc.frequency.value = freq;
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(panner).connect(c.destination);
    osc.start(t);
    osc.stop(t + duration + 0.03);
}

function sequence(freqs, step = 0.09, opts = {}) {
    freqs.forEach((freq, i) => playTone({ freq, delay: i * step, ...opts }));
}

/* Same sound always means the same thing, on every page. */
export const cues = {
    tap:     () => playTone({ freq: 700, duration: 0.05, volume: 0.1 }),          // any button press
    notice:  () => playTone({ freq: 988, duration: 0.09, type: 'triangle' }),     // a status message changed
    on:      () => sequence([523, 784]),                                          // something switched on
    off:     () => sequence([784, 523]),                                          // something switched off
    start:   () => sequence([392, 523, 659], 0.07),                               // playing from the beginning
    finish:  () => sequence([523, 659, 784, 1047], 0.1, { type: 'triangle' }),     // reached the end
};
