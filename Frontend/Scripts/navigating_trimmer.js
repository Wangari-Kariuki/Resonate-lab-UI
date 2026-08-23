import { audioState, setTrimRange } from './audioState.js';

// Returns focusable targets in top-to-bottom DOM order.
function getNavigableSections() {
    const sections = [
        document.querySelector('h1'),
        document.querySelector('nav#side-navigation'),
        document.getElementById('upload-heading'),
        document.getElementById('audio-input'),
        document.getElementById('file-info'),
        document.getElementById('preview-player'),
        document.getElementById('action-row'),
        document.getElementById('save-audio'),
        document.getElementById('toggle-trim'),
    ];

    const trimmer = document.getElementById('audio-trimmer');
    if (trimmer && trimmer.style.display !== 'none') {
        sections.push(
            document.getElementById('trim-heading'),
            document.getElementById('trim-guide'),
            document.getElementById('trim-guide-heading'),
            document.getElementById('t'),
            document.getElementById('e'),
            document.querySelector('#trim-guide p:not([id])'),
            document.getElementById('up'),
            document.getElementById('down'),
            document.getElementById('skip-trim-guide'),
            document.getElementById('trim-player'),
            document.getElementById('trim-input-desc'),
            document.getElementById('trim-time-input'),
            document.querySelector('#time-display'),
            document.getElementById('Start-time'),
            document.getElementById('End-time'),
            document.getElementById('save-trim'),
        );
    }

    return sections.filter(Boolean);
}

export function navigateSection(direction) {
    const sections = getNavigableSections();
    let currentIndex = sections.indexOf(document.activeElement);

    if (currentIndex === -1) {
        currentIndex = 0;
    }

    const nextIndex = Math.max(0, Math.min(sections.length - 1, currentIndex + direction));
    const target = sections[nextIndex];

    target.focus();
    target.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
    });
}
const TEXT_ENTRY_TAGS = new Set(['INPUT', 'TEXTAREA']);
const INTERACTIVE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'AUDIO', 'VIDEO', 'A']);

function announceForScreenReader(message) {
    const srAnnouncer = document.getElementById('sr-announcer');
    if (!srAnnouncer) return;

    srAnnouncer.textContent = '';
    requestAnimationFrame(() => {
        srAnnouncer.textContent = message;
    });
}

function isTypingContext(target) {
    return TEXT_ENTRY_TAGS.has(target.tagName);
}

const ARROW_NAV_OVERRIDE_IDS = new Set([
    'audio-input',
    'preview-player',
    'save-audio',
    'toggle-trim',
    'save-trim',
    'trim-player',
]);

function focusIsOnInteractiveElement() {
    const el = document.activeElement;
    return !!el && INTERACTIVE_TAGS.has(el.tagName);
}

export function shouldUseArrowNavigation() {
    const el = document.activeElement;
    return !focusIsOnInteractiveElement() || (el && ARROW_NAV_OVERRIDE_IDS.has(el.id));
}

export function initTrimKeyboard({
    audioTrimmer,
    trimPlayer,
    trimmedAudioPlayer,
    previewPlayer,
    getTrimmingMode,
    startTimeEl,
    endTimeEl,
    updateTrimDuration,
}) {
    if (!audioTrimmer || !trimPlayer || !previewPlayer) return;

    function shiftTrimWindow(deltaSeconds) {
        const duration = Number(trimPlayer.duration || 0);
        const start = Number(audioState.trimStart);
        const end = Number(audioState.trimEnd);

        if (!Number.isFinite(duration) || duration <= 0) {
            announceForScreenReader('Audio duration is not available yet.');
            return;
        }

        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
            announceForScreenReader('Mark both start and end times before moving the trim window.');
            return;
        }

        const windowSize = end - start;
        const maxStart = Math.max(0, duration - windowSize);
        const nextStart = Math.min(Math.max(0, start + deltaSeconds), maxStart);
        const nextEnd = Math.min(duration, nextStart + windowSize);

        setTrimRange(nextStart, nextEnd);

        if (startTimeEl) startTimeEl.textContent = `${nextStart.toFixed(2)} seconds`;
        if (endTimeEl) endTimeEl.textContent = `${nextEnd.toFixed(2)} seconds`;

        trimPlayer.currentTime = Math.min(
            duration,
            Math.max(0, trimPlayer.currentTime + (nextStart - start))
        );

        updateTrimDuration?.();
        announceForScreenReader(
            `Trim window moved to start ${nextStart.toFixed(2)} seconds and end ${nextEnd.toFixed(2)} seconds.`
        );
    }

    audioTrimmer.addEventListener('keydown', (event) => {
        const trimmingMode = getTrimmingMode();
        const activePlayer = trimmingMode ? trimPlayer : previewPlayer;

        // Let the native audio controls handle Space for play and pause.
        if (event.target === trimPlayer && event.code === 'Space') {
            return;
        }

        const isSpace = event.key === ' ';
        const isCtrlSpace = event.ctrlKey && event.code === 'Space';

        if (isSpace || isCtrlSpace) {
            event.preventDefault();

            if (isSpace || isCtrlSpace ) {
                event.preventDefault();
                if (activePlayer.paused){
                    activePlayer.play().catch(() => {});
                }else {
                    activePlayer.pause();
                }
            }
        }

        if (event.key === 's' || event.key === 'S') {
            activePlayer.pause();
            activePlayer.currentTime = 0;
        }

        if (trimmingMode && document.activeElement === trimPlayer && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
            event.preventDefault();
            shiftTrimWindow(event.key === 'ArrowRight' ? 5 : -5);
            return;
        }

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (trimmingMode && document.activeElement === trimPlayer) {
                if (event.key === 'ArrowUp') {
                    trimPlayer.currentTime = Math.min(trimPlayer.duration, trimPlayer.currentTime + 5);
                } else {
                    trimPlayer.currentTime = Math.max(0, trimPlayer.currentTime - 5);
                }
            } else if (shouldUseArrowNavigation()) {
                event.preventDefault();
                navigateSection(event.key === 'ArrowDown' ? 1 : -1);
            }
            return;
        }
        function getTimeSource() {
        if (audioState.activePlayerID === 'trim-preview') return trimmedAudioPlayer;
        return trimPlayer;
    }
        if (!trimmingMode) return;
        const isPlainT = event.key === 't' || event.key === 'T';
        const isCtrlT = event.ctrlKey && (event.key === 't' || event.key === 'T');

        if ((isPlainT || isCtrlT) && !isTypingContext(event.target)) {
            event.preventDefault();
            const source = getTimeSource();
            const start = source.currentTime;
            setTrimRange(start, audioState.trimEnd);
            startTimeEl.textContent = `${start.toFixed(2)} seconds`;
            updateTrimDuration?.();
            announceForScreenReader(`Start time marked at ${start.toFixed(2)} seconds.`);
            };

            if ((event.key === 'e' || event.key === 'E') && !isTypingContext(event.target)) {
             event.preventDefault();
            const source = getTimeSource();
            const end = source.currentTime;
            setTrimRange(audioState.trimStart, end);
            endTimeEl.textContent = `${end.toFixed(2)} seconds`;
            updateTrimDuration?.();
            announceForScreenReader(`End time marked at ${end.toFixed(2)} seconds.`);
            }

    });
}

export function initNewTrimButton({ newTrimButton, startTimeEl, endTimeEl, durationTimeEl, updateTrimDuration }) {
    if (!newTrimButton) return;

    newTrimButton.addEventListener('click', () => {
        if (startTimeEl) startTimeEl.textContent = null;
        if (endTimeEl) endTimeEl.textContent = null;
        if (durationTimeEl) durationTimeEl.textContent = null;
        updateTrimDuration?.();
    });
}
