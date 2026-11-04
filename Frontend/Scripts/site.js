/* Loaded on every page: sound effects toggle, click cues, status cues and skip link focus. */
import { soundEnabled, setSoundEnabled, cues } from './sound.js';

/* ---------- Sound effects toggle (header button, and on Settings) ---------- */
const toggles = document.querySelectorAll('[data-sound-toggle]');

function syncToggles() {
    const on = soundEnabled();
    toggles.forEach((btn) => {
        btn.setAttribute('aria-pressed', String(on));
        const state = btn.querySelector('.toggle-state');
        if (state) state.textContent = on ? 'On' : 'Off';   // visible state, not color alone
    });
}
toggles.forEach((btn) => btn.addEventListener('click', () => setSoundEnabled(!soundEnabled())));
document.addEventListener('soundeffects-change', syncToggles);
syncToggles();

/* ---------- A short tap for every button press ---------- */
// Buttons with data-cue="own" play their own cue instead (see my_sounds.js).
document.addEventListener('click', (event) => {
    const el = event.target.closest('button, [role="button"], input[type="radio"], input[type="checkbox"]');
    if (!el || el.matches('[data-sound-toggle], [data-cue="own"]')) return;
    cues.tap();
});

/* ---------- A soft chime when a status message changes ---------- */
// Elements with data-cue="own" are skipped. At most one chime every 400 ms.
let lastNotice = 0;
const observer = new MutationObserver((records) => {
    const changed = records.some((r) => {
        const el = r.target.nodeType === 1 ? r.target : r.target.parentElement;
        const region = el?.closest('[role="status"], [aria-live]');
        return region && !region.matches('[data-cue="own"]') && region.textContent.trim();
    });
    const now = performance.now();
    if (changed && now - lastNotice > 400) {
        lastNotice = now;
        cues.notice();
    }
});
document.querySelectorAll('[role="status"], [aria-live]').forEach((region) => {
    observer.observe(region, { childList: true, characterData: true, subtree: true });
});

/* ---------- Skip link: move focus into main, not just scroll ---------- */
document.querySelectorAll('.skip-link:not(#skip-to-main)').forEach((link) => {
    link.addEventListener('click', (event) => {
        const target = document.querySelector(link.getAttribute('href'));
        if (!target) return;
        event.preventDefault();
        target.focus();
        target.scrollIntoView({ block: 'start' });
    });
});
