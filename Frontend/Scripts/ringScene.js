import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* Shared Three.js ring scene. Used by adjust-panel.js (Printing options) and my_sounds.js (My Sounds). */

/* Defaults per option. `shape` changes how ridge height is spread around the ring. */
export const MODELS = {
    select1: { name: 'Cylindrical ring', shape: 'groove',       fill: 0.7,  defaults: { diameter: 60, height: 3,   count: 64 } },
    select2: { name: 'Concentrated ring', shape: 'concentrated', fill: 0.85, defaults: { diameter: 56, height: 4,   count: 110 } },
    select3: { name: 'Spread out ring',   shape: 'spread',       fill: 0.45, defaults: { diameter: 66, height: 2.5, count: 40 } },
};
export const BAND_HEIGHT = 8; // mm, vertical size of the ring band

/* Stand-in for spectrogram data: a fixed pattern of values between 0.15 and 1. */
const STAND_IN_AUDIO = Array.from({ length: 160 }, (_, i) => {
    const v = 0.5 + 0.28 * Math.sin(i * 0.37) + 0.22 * Math.sin(i * 0.11 + 1.3) + 0.12 * Math.sin(i * 1.7);
    return Math.min(1, Math.max(0.15, v));
});

function weight(shape, t) {
    // t runs 0..1 around the ring
    if (shape === 'concentrated') {
        const d = Math.min(Math.abs(t - 0.25), 1 - Math.abs(t - 0.25));
        return 0.35 + 0.65 * Math.exp(-(d * d) / 0.02);
    }
    return 1;
}

export function createRingScene(canvas) {
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

    const material = new THREE.MeshStandardMaterial({ color: 0xb9bcc4, roughness: 0.55, metalness: 0.15 });
    const ringGroup = new THREE.Group();
    scene.add(ringGroup);

    // `data` is one value (0..1) per ridge slot; slot i sits at angle i / count * 2π
    function buildRing({ diameter, height, count }, model, data = STAND_IN_AUDIO) {
        ringGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
        ringGroup.clear();

        const r = diameter / 2;
        const band = new THREE.Mesh(new THREE.CylinderGeometry(r, r, BAND_HEIGHT, 128, 1, true), material.clone());
        band.material.side = THREE.DoubleSide;
        ringGroup.add(band);

        const ridges = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, count);
        const dummy = new THREE.Object3D();
        const slot = (2 * Math.PI * r) / count;
        for (let i = 0; i < count; i++) {
            const t = i / count;
            const a = t * 2 * Math.PI;
            const amp = Math.max(0.3, data[i % data.length] * height * weight(model.shape, t));
            dummy.position.set(Math.cos(a) * (r + amp / 2), 0, Math.sin(a) * (r + amp / 2));
            dummy.rotation.set(0, -a, 0);
            dummy.scale.set(amp, BAND_HEIGHT, slot * model.fill);
            dummy.updateMatrix();
            ridges.setMatrixAt(i, dummy.matrix);
        }
        ridges.instanceMatrix.needsUpdate = true;
        ringGroup.add(ridges);
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

    return { scene, camera, controls, ringGroup, buildRing, render, resize };
}
