import * as THREE from 'three';
import { loadProject } from './projectstore.js';
import { MODELS, BAND_HEIGHT, createRingScene } from './ringScene.js';
import { cues, soundEnabled, getAudioContext, playTone } from './sound.js';

/* ---------- Sounds saved in the current project (projectstore.js) ---------- */
// Trimmed first: it is the audio the printed torus is generated from (printing_options.js sends trimmedWav).
const SOUNDS = [
    { id: 'trimmed',  field: 'trimmedWav',    label: () => 'Trimmed audio',
      note: 'The sound your printed torus is made from.' },
    { id: 'original', field: 'originalAudio', label: (r) => `Original audio${r.fileName ? ` (${r.fileName})` : ''}`,
      note: 'The full file you uploaded, before trimming.' },
];

const TORUS = MODELS.select1;                              // the "Sound-Torus" option on Printing options
const RING = TORUS.defaults;
const REST_ANGLE = -Math.PI / 2;                           // turns the start marker to face the viewer
const FULL_TURN = 2 * Math.PI;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const loadingMsg = document.getElementById('sounds-loading');
const emptyMsg = document.getElementById('sounds-empty');
const soundList = document.getElementById('sound-list');
const explore = document.getElementById('explore');
const audio = document.getElementById('explore-audio');
const timeText = document.getElementById('explore-time-text');
const activateBtn = document.getElementById('explore-activate');
const restartBtn = document.getElementById('explore-restart');
const deactivateBtn = document.getElementById('explore-deactivate');
const stage = document.getElementById('explore-stage');
const canvas = document.getElementById('explore-canvas');
const canvasDesc = document.getElementById('explore-canvas-desc');
const announcer = document.getElementById('explore-announcer');
const shapeSection = document.getElementById('shape');
const shapeSlider = document.getElementById('shape-slider');
const shapeReadout = document.getElementById('shape-readout');
const shapePlayBtn = document.getElementById('shape-play');
const shapeSoundHint = document.getElementById('shape-sound-hint');
const SHAPE_PARTS = 16;

let active = false;
let restarting = false;   // stops the "play" event from announcing "Playing" on top of "Restarted"
let rafId = 0;
let objectUrl = null;
let ringData;             // undefined = ringScene's stand-in data
let shapeLevels = null;   // SHAPE_PARTS loudness values (0..1) in time order, for "Hear the shape"
let decodeToken = 0;
let mediaPanner = null;   // StereoPannerNode on the sound player, created only once sound effects are on

/* ---------- 3D torus (shared scene from ringScene.js) ---------- */
const { scene, controls, ringGroup, buildRing, render, resize } = createRingScene(canvas);
const ringRadius = RING.diameter / 2;
const markerRadius = ringRadius + RING.height + 3;

const startMat = new THREE.MeshStandardMaterial({ color: 0x2fae66, roughness: 0.4 });
const nowMat = new THREE.MeshStandardMaterial({ color: 0xf2a33a, roughness: 0.4, emissive: 0x5a3200 });

// Fixed pointer at the front of the ring (spin mode): whatever part of the ring is under it is "now".
const pointer = new THREE.Mesh(new THREE.ConeGeometry(2.5, 7, 24), nowMat);
pointer.rotation.x = -Math.PI / 2;                         // tip points at the ring
pointer.position.set(0, 0, markerRadius + 5);
scene.add(pointer);

let nowMarker = null;   // moving dot on the ring (reduced-motion mode)

function decorateRing() {
    // buildRing() clears ringGroup, so the markers are added again after every build
    const start = new THREE.Mesh(new THREE.BoxGeometry(2, BAND_HEIGHT * 1.8, 4), startMat);
    start.position.set(markerRadius - 1, 0, 0);            // angle 0 = start of the sound
    ringGroup.add(start);

    nowMarker = new THREE.Mesh(new THREE.SphereGeometry(2.4, 24, 16), nowMat);
    ringGroup.add(nowMarker);
}

function rebuildTorus() {
    buildRing(RING, TORUS, ringData);
    decorateRing();
    applyAngle();
}

// Audio at fraction p sits at ring angle -p * 2π, so the screen matches the print
// (audio_ring_to_stl.py runs counter-clockwise seen from above; three.js angles run the other way).
function ringAngleFor(p) { return -p * FULL_TURN; }

function progress() {
    const d = audio.duration;
    return Number.isFinite(d) && d > 0 ? Math.min(1, audio.currentTime / d) : 0;
}

// The angle always comes from audio.currentTime; requestAnimationFrame only decides when to redraw.
function applyAngle() {
    const p = progress();
    if (reducedMotion.matches) {
        ringGroup.rotation.y = REST_ANGLE;
        pointer.visible = false;
        if (nowMarker) {
            const a = ringAngleFor(p);
            nowMarker.visible = active;
            nowMarker.position.set(Math.cos(a) * markerRadius, BAND_HEIGHT * 0.75, Math.sin(a) * markerRadius);
        }
    } else {
        // rotation.y = θ moves ring angle a to a - θ; keep the current audio point at the front pointer
        ringGroup.rotation.y = active ? REST_ANGLE + ringAngleFor(p) : REST_ANGLE;
        pointer.visible = true;
        if (nowMarker) nowMarker.visible = false;
    }
    // Spatial sound: start of the torus in the left ear, end in the right ear
    if (mediaPanner) mediaPanner.pan.value = active && soundEnabled() ? panFor(p) : 0;
    render();
}

function panFor(p) { return (-1 + 2 * p) * 0.9; }

// Routes the player through a StereoPannerNode. Called only from a click or play,
// and only when sound effects are on, so nothing is created or played on page load.
function ensureMediaPanner() {
    if (mediaPanner || !soundEnabled()) return;
    try {
        const ctx = getAudioContext();
        mediaPanner = ctx.createStereoPanner();
        ctx.createMediaElementSource(audio).connect(mediaPanner).connect(ctx.destination);
    } catch (error) {
        console.error('Could not set up spatial sound:', error);
        mediaPanner = null;
    }
}

function tick() {
    applyAngle();
    rafId = requestAnimationFrame(tick);
}
function startLoop() { if (!rafId) rafId = requestAnimationFrame(tick); }
function stopLoop() { cancelAnimationFrame(rafId); rafId = 0; }

function describeCanvas() {
    const base = 'Your sound torus seen at an angle from above, with a green start marker.';
    const motion = reducedMotion.matches
        ? ' The torus stays still. While the sound plays, an orange dot moves around it to the part that matches what you hear.'
        : ' While the sound plays, the torus turns one full circle. The part under the orange pointer at the front matches what you hear.';
    const text = base + motion + ' Use the arrow keys to turn the view.';
    canvas.setAttribute('aria-label', `3D torus model. ${text}`);
    canvasDesc.textContent = text;
}

// One amplitude value (0.15..1) per ridge slot, from the decoded sound. Falls back to the stand-in on failure.
async function loadRingData(blob) {
    const token = ++decodeToken;
    try {
        const ctx = new OfflineAudioContext(1, 1, 44100);
        const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
        if (token !== decodeToken) return;                 // another sound was chosen meanwhile
        const samples = buffer.getChannelData(0);
        const n = RING.count;
        const size = Math.max(1, Math.floor(samples.length / n));
        const rms = Array.from({ length: n }, (_, i) => {
            let sum = 0;
            for (let j = i * size, end = Math.min(samples.length, j + size); j < end; j++) sum += samples[j] * samples[j];
            return Math.sqrt(sum / size);
        });
        const max = Math.max(...rms) || 1;
        // slot s is drawn at three.js angle s/n * 2π, which is audio fraction (n - s) / n
        ringData = rms.map((_, s) => 0.15 + 0.85 * (rms[(n - s) % n] / max));
        // average the slots into SHAPE_PARTS parts, in time order
        shapeLevels = Array.from({ length: SHAPE_PARTS }, (_, i) => {
            const from = Math.floor((i * n) / SHAPE_PARTS);
            const to = Math.max(from + 1, Math.floor(((i + 1) * n) / SHAPE_PARTS));
            const slice = rms.slice(from, to);
            return slice.reduce((a, b) => a + b, 0) / slice.length / max;
        });
    } catch (error) {
        if (token !== decodeToken) return;
        console.error('Could not read the sound for the torus preview:', error);
        ringData = undefined;
        shapeLevels = null;
    }
    rebuildTorus();
    setupShape();
}

/* ---------- Hear the shape (like a graph played as notes) ---------- */
function levelWord(level) {
    if (level < 0.34) return 'quiet';
    if (level < 0.67) return 'medium';
    return 'loud';
}
function shapeText(part) {
    const where = part === 1 ? ', at the start marker' : part === SHAPE_PARTS ? ', at the end' : '';
    const level = shapeLevels ? `: ${levelWord(shapeLevels[part - 1])}` : '';
    return `Part ${part} of ${SHAPE_PARTS}${where}${level}`;
}
// High note = loud, low note = quiet (220 Hz to 880 Hz). Left ear = start, right ear = end.
function playPart(part, delay = 0) {
    if (!shapeLevels) return;
    playTone({
        freq: 220 * 2 ** (shapeLevels[part - 1] * 2),
        pan: panFor((part - 1) / (SHAPE_PARTS - 1)),
        duration: 0.2,
        type: 'triangle',
        delay,
    });
}
function showPart(part) {
    const text = shapeText(part);
    shapeSlider.setAttribute('aria-valuetext', text);
    shapeReadout.textContent = text;
}
function syncShapeHint() { shapeSoundHint.hidden = soundEnabled(); }

function setupShape() {
    shapeSection.hidden = false;
    shapeSlider.disabled = !shapeLevels;
    shapePlayBtn.disabled = !shapeLevels;
    shapeSlider.value = 1;
    if (shapeLevels) {
        showPart(1);
    } else {
        shapeReadout.textContent = 'Sorry, we could not read the shape of this sound.';
    }
    syncShapeHint();
}

let shapeTimers = [];
function stopShapePlayback() {
    shapeTimers.forEach(clearTimeout);
    shapeTimers = [];
}

shapeSlider.addEventListener('input', () => {
    stopShapePlayback();
    const part = Number(shapeSlider.value);
    showPart(part);
    playPart(part);
});
shapePlayBtn.addEventListener('click', () => {
    if (!soundEnabled()) {
        announce('Sound effects are off. Turn them on at the top of the page to hear the notes.');
        return;
    }
    stopShapePlayback();
    const step = 0.28;
    for (let part = 1; part <= SHAPE_PARTS; part++) {
        playPart(part, (part - 1) * step);
        // move the slider and text along with the notes (not a live region, so nothing is read out each step)
        shapeTimers.push(setTimeout(() => { shapeSlider.value = part; showPart(part); }, (part - 1) * step * 1000));
    }
});
document.addEventListener('soundeffects-change', () => {
    syncShapeHint();
    if (soundEnabled() && active) ensureMediaPanner();     // the toggle click counts as a user action
    applyAngle();
});

/* ---------- Time text and announcements ---------- */
function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
    const s = Math.floor(seconds);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function updateTime() {
    timeText.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
}
function announce(message) {
    // clear first so the same message twice in a row is still read
    announcer.textContent = '';
    setTimeout(() => { announcer.textContent = message; }, 50);
}

/* ---------- Mode ---------- */
function showActiveButtons(isActive) {
    activateBtn.hidden = isActive;
    restartBtn.hidden = !isActive;
    deactivateBtn.hidden = !isActive;
    stage.hidden = !isActive;
}

function activate() {
    if (!audio.src) return;
    active = true;
    ensureMediaPanner();
    cues.on();
    showActiveButtons(true);
    resize();                                              // canvas had no size while hidden
    applyAngle();
    if (!audio.paused) startLoop();
    restartBtn.focus();                                    // the Activate button just disappeared
    announce('Activated. Choose Restart to play from the beginning.');
}

async function restart() {
    if (!active) return;
    restarting = true;
    ensureMediaPanner();
    cues.start();
    audio.currentTime = 0;
    applyAngle();
    updateTime();
    try {
        await audio.play();
        announce('Restarted. Playing from 0:00.');
    } catch (error) {
        console.error('Could not play the sound:', error);
        announce('Restarted, but the sound could not start. Use the play button in the sound player.');
    } finally {
        restarting = false;
    }
}

// Stops audio and rotation, resets the torus and returns to the pre-activation state.
function deactivate({ moveFocus = true, message = 'Deactivated.' } = {}) {
    const wasActive = active;
    active = false;
    stopLoop();
    audio.pause();
    if (audio.src) audio.currentTime = 0;
    controls.reset();                                      // undo any view changes made with drag or arrow keys
    showActiveButtons(false);
    applyAngle();
    updateTime();
    if (moveFocus && wasActive) activateBtn.focus();
    if (wasActive && message) {
        cues.off();
        announce(message);
    }
}

activateBtn.addEventListener('click', activate);
restartBtn.addEventListener('click', restart);
deactivateBtn.addEventListener('click', () => deactivate());

audio.addEventListener('play', () => {
    if (mediaPanner) getAudioContext();                    // make sure the routed sound is not stuck on a paused context
    if (!active) return;
    ensureMediaPanner();
    startLoop();
    if (!restarting) announce('Playing.');
});
audio.addEventListener('pause', () => {
    stopLoop();
    applyAngle();
    // "pause" also fires when the sound ends; "ended" announces that case
    if (active && !audio.ended) announce('Paused.');
});
audio.addEventListener('ended', () => {
    stopLoop();
    applyAngle();
    if (active) {
        cues.finish();
        announce('Finished. Choose Restart to listen again, or Deactivate mode.');
    }
});
['timeupdate', 'durationchange', 'loadedmetadata', 'seeked'].forEach((type) => {
    audio.addEventListener(type, () => {
        updateTime();
        if (active && audio.paused) applyAngle();          // follow seeks made while paused
    });
});

reducedMotion.addEventListener('change', () => { describeCanvas(); applyAngle(); });

// Leaving the page stops everything (also covers the back/forward cache).
window.addEventListener('pagehide', () => deactivate({ moveFocus: false, message: '' }));

/* ---------- Sound list ---------- */
function selectSound(sound, record) {
    const wasActive = active;
    stopShapePlayback();
    deactivate({ moveFocus: false, message: '' });         // focus stays on the chosen radio button
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(record[sound.field]);
    audio.src = objectUrl;
    updateTime();
    if (wasActive) announce(`Deactivated. ${sound.label(record)} selected.`);
    loadRingData(record[sound.field]);
}

function renderSoundList(record, sounds) {
    sounds.forEach((sound, index) => {
        const id = `sound-${sound.id}`;
        const row = document.createElement('div');
        row.className = 'sound-option';

        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'sound';
        input.id = id;
        input.value = sound.id;
        input.checked = index === 0;
        input.setAttribute('aria-describedby', `${id}-note`);
        input.addEventListener('change', () => { if (input.checked) selectSound(sound, record); });

        const label = document.createElement('label');
        label.htmlFor = id;
        label.textContent = sound.label(record);
        const note = document.createElement('span');
        note.className = 'sound-note';
        note.id = `${id}-note`;
        note.textContent = sound.note;
        label.appendChild(note);

        row.append(input, label);
        soundList.appendChild(row);
    });
}

async function init() {
    describeCanvas();
    rebuildTorus();
    let record = null;
    try {
        record = await loadProject();
    } catch (error) {
        console.error('Could not load saved project:', error);
    }
    loadingMsg.hidden = true;

    const sounds = SOUNDS.filter((sound) => record?.[sound.field]);
    if (!sounds.length) {
        emptyMsg.hidden = false;
        return;
    }
    renderSoundList(record, sounds);
    soundList.hidden = false;
    explore.hidden = false;
    selectSound(sounds[0], record);
}

init();
