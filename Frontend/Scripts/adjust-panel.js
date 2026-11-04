import { MODELS, createRingScene } from './ringScene.js';

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

/* ---------- Three.js scene (shared, see ringScene.js) ---------- */
const { buildRing, render, resize } = createRingScene(canvas);

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