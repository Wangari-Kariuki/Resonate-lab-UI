import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* Defaults per option. `shape` changes how ridge height is spread around the ring. */
const MODELS = {
    select1: { name: 'Cylindrical ring', shape: 'groove',       fill: 0.7,  defaults: { diameter: 60, height: 3,   count: 64 } },
    select2: { name: 'Concentrated ring', shape: 'concentrated', fill: 0.85, defaults: { diameter: 56, height: 4,   count: 110 } },
    select3: { name: 'Spread out ring',   shape: 'spread',       fill: 0.45, defaults: { diameter: 66, height: 2.5, count: 40 } },
};
const BAND_HEIGHT = 8; // mm, vertical size of the ring band

const column = document.getElementById('adjust-column');
const panel = document.getElementById('adjust-panel');
const emptyMsg = document.getElementById('adjust-empty');
const canvas = document.getElementById('adjust-canvas');
const summary = document.getElementById('adjust-summary');
const modelName = document.getElementById('adjust-model-name');
const resetBtn = document.getElementById('adjust-reset');

const ctl = {
    diameter: document.getElementById('ctl-diameter'),
    height: document.getElementById('ctl-height'),
    count: document.getElementById('ctl-count'),
};
const out = {
    diameter: document.getElementById('out-diameter'),
    height: document.getElementById('out-height'),
    count: document.getElementById('out-count'),
};

let current = null;

/* ---------- Three.js scene ---------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x15171c);
const camera = new THREE.PerspectiveCamera(40, 1, 1, 1000);
camera.position.set(0, 90, 130);

scene.add(new THREE.HemisphereLight(0xffffff, 0x333344, 1.1));
const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(60, 100, 80);
scene.add(key);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = false;      // render on demand, no continuous loop
controls.minDistance = 60;
controls.maxDistance = 300;
controls.listenToKeyEvents(canvas);  // arrow keys rotate when canvas is focused
controls.addEventListener('change', render);

const material = new THREE.MeshStandardMaterial({ color: 0xb9bcc4, roughness: 0.55, metalness: 0.15, side: THREE.DoubleSide });
const ringGroup = new THREE.Group();
scene.add(ringGroup);

/* Stand-in for spectrogram data: a fixed pattern of values between 0.15 and 1. */
const audio = Array.from({ length: 160 }, (_, i) => {
    const v = 0.5 + 0.28 * Math.sin(i * 0.37) + 0.22 * Math.sin(i * 0.11 + 1.3) + 0.12 * Math.sin(i * 1.7);
    return Math.min(1, Math.max(0.15, v));
});

/* Matches audio_ring_to_stl.py: the quietest point is 35% of the ridge height and the
   loudest is the full height (min-max normalised). No extra core or contrast curve. */
const BASE_FRACTION = 0.35;
const AUDIO_LO = Math.min(...audio);
const AUDIO_HI = Math.max(...audio);

function ridgeAmount(i) {
    const span = (audio[i % audio.length] - AUDIO_LO) / (AUDIO_HI - AUDIO_LO);
    return BASE_FRACTION + (1 - BASE_FRACTION) * span;
}
function weight(shape, t) {
    // t runs 0..1 around the ring
    if (shape === 'concentrated') {
        const d = Math.min(Math.abs(t - 0.25), 1 - Math.abs(t - 0.25));
        return 0.35 + 0.65 * Math.exp(-(d * d) / 0.02);
    }
    return 1;
}

function buildRing({ diameter, height, count }, model) {
    ringGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    ringGroup.clear();

    // Same construction as the STL converter: a circular tube swept around the ring, one profile
    // point per ridge (count), with the tube radius set by the audio amplitude at that point.
    const R = diameter / 2;
    const SIDES = 32;                        // tube cross-section resolution
    const n = count;

    const positions = new Float32Array(n * SIDES * 3);
    for (let i = 0; i < n; i++) {
        const tubeR = height * ridgeAmount(i) * weight(model.shape, i / n);
        const theta = (i / n) * 2 * Math.PI;
        const c = Math.cos(theta), s = Math.sin(theta);
        for (let j = 0; j < SIDES; j++) {
            const phi = (j / SIDES) * 2 * Math.PI;
            const radial = R + tubeR * Math.cos(phi);
            const o = (i * SIDES + j) * 3;
            positions[o] = radial * c;
            positions[o + 1] = tubeR * Math.sin(phi);
            positions[o + 2] = radial * s;
        }
    }

    const index = [];
    for (let i = 0; i < n; i++) {
        const i2 = (i + 1) % n;                                // wrap so the ring closes
        for (let j = 0; j < SIDES; j++) {
            const j2 = (j + 1) % SIDES;
            const a = i * SIDES + j, b = i * SIDES + j2, c2 = i2 * SIDES + j2, d = i2 * SIDES + j;
            index.push(a, d, b, b, d, c2);
        }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
    ringGroup.add(new THREE.Mesh(geo, material));
}

function render() { renderer.render(scene, camera); }

function resize() {
    const w = canvas.clientWidth;
    if (!w) return;
    renderer.setSize(w, w, false);
    camera.aspect = 1;
    camera.updateProjectionMatrix();
    render();
}
new ResizeObserver(resize).observe(canvas);

/* ---------- Panel behavior ---------- */
function values() {
    return { diameter: +ctl.diameter.value, height: +ctl.height.value, count: +ctl.count.value };
}

function update() {
    if (!current) return;
    const v = values();
    out.diameter.textContent = `${v.diameter} mm`;
    out.height.textContent = `${v.height.toFixed(1)} mm`;
    out.count.textContent = v.count;
    buildRing(v, current);
    render();
    summary.textContent = `${current.name}: ${v.diameter} mm wide, ${v.count} ridges up to ${v.height.toFixed(1)} mm tall.`;
}

function setDefaults(model) {
    ctl.diameter.value = model.defaults.diameter;
    ctl.height.value = model.defaults.height;
    ctl.count.value = model.defaults.count;
}

function selectModel(id) {
    const wasHidden = panel.hidden;
    current = MODELS[id];
    modelName.textContent = current.name;
    setDefaults(current);
    emptyMsg.hidden = true;
    panel.hidden = false;
    resize();
    update();
    // Move focus to the panel on first reveal so keyboard and screen reader users land on it
    if (wasHidden) panel.focus();
}

Object.keys(MODELS).forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => selectModel(id));
});
Object.values(ctl).forEach(el => el.addEventListener('input', update));
resetBtn.addEventListener('click', () => { setDefaults(current); update(); });