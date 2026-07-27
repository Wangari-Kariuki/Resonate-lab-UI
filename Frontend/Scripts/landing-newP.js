import { audioState, setSelectedAudioFile, setTrimRange, clearTrimSelection } from './audioState.js';
const uploadInput = document.getElementById("audio-input");
const previewPlayer = document.getElementById("preview-player");
const trimPlayer = document.getElementById("trim-player");
const fileInfo = document.getElementById("file-info");
const trimToggle = document.getElementById("toggle-trim");
const homebtn = document.getElementById("go-to-home");

if (homebtn) {
    homebtn.addEventListener("click", () => {
        window.location.href = "./landing_page.html";
    });
}

let trimmingMode = false;

// ── Section navigation ────────────────────────────────────────────────────────
// Returns focusable targets in top-to-bottom DOM order.
// Trim section stops are only included when that panel is visible.
function getNavigableSections() {
    const sections = [
        document.querySelector('h1'),                          // Page title
        document.querySelector('nav#side-navigation'),         // Sidebar nav
        document.getElementById('upload-heading'),             // "Upload audio project"
        document.getElementById('audio-input'),                // File picker
        document.getElementById('file-info'),                  // File info status
        document.getElementById('preview-player'),             // Audio preview player
        document.getElementById('action-row'),                 // Action row
        document.getElementById('save-audio'),                 // Save button
        document.getElementById('toggle-trim'),                // Trim button
    ];

    const trimmer = document.getElementById('audio-trimmer');
    if (trimmer && trimmer.style.display !== 'none') {
        sections.push(
            document.getElementById('trim-heading'),           // "Trim audio"
            document.getElementById('trim-guide'),             // Trim controls section
            document.getElementById('trim-guide-heading'),     // Trim controls heading
            document.getElementById('t'),                      // "Press T" instruction
            document.getElementById('e'),                      // "Press E" instruction
            document.querySelector('#trim-guide p:not([id])'), // Spacebar instruction
            document.getElementById('up'),                     // "Arrow up" instruction
            document.getElementById('down'),                   // "Arrow down" instruction
            document.getElementById('trim-player'),            // Trim audio player
            document.getElementById('trim-input-desc'),        // Input description
            document.getElementById('in01'),                   // Trim marker input
            document.querySelector('.time-display'),           // Time display
            document.getElementById('Start-time'),             // Start time value
            document.getElementById('End-time'),               // End time value
            document.getElementById('save-trim'),              // Save trimmed audio
        );
    }

    return sections.filter(Boolean);
}

let currentSectionIndex = 0;

function navigateSection(direction) {

    const sections = getNavigableSections();

    let currentIndex = sections.indexOf(document.activeElement);

    if (currentIndex === -1) {
        currentIndex = 0;
    }

    const nextIndex = Math.max(
        0,
        Math.min(sections.length - 1, currentIndex + direction)
    );

    const target = sections[nextIndex];

    target.focus();

    target.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}

// Tags that own arrow-key behaviour — don't intercept in these cases.
const INTERACTIVE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'AUDIO', 'VIDEO', 'A']);

function focusIsOnInteractiveElement() {
    const el = document.activeElement;
    return INTERACTIVE_TAGS.has(el.tagName);
}

const ARROW_NAV_OVERRIDE_IDS = new Set([
    'audio-input',
    'preview-player',
    'save-audio',
    'toggle-trim',
    'save-trim',
    'trim-player'
]);

// Decide whether the arrow key should trigger custom navigation.
// Return true if focus is not on an interactive element or if it's on an allowed control.
function shouldUseArrowNavigation() {
    const el = document.activeElement;
    return !focusIsOnInteractiveElement() || ARROW_NAV_OVERRIDE_IDS.has(el.id);
}
// ────────────────────────────────────────────────────────────────────────────

function loadAudioFile(file) {
    if (!file) {
        fileInfo.textContent = "No file selected yet";

        previewPlayer.src = "";
        trimPlayer.src = "";

        previewPlayer.load();
        trimPlayer.load();
        return;
    }

    const fileURL = URL.createObjectURL(file);

    previewPlayer.src = fileURL;
    trimPlayer.src = fileURL;

    previewPlayer.load();
    trimPlayer.load();

    fileInfo.innerHTML = `
        <strong>Audio uploaded successfully.</strong><br>
        File: ${file.name}<br>
        Size: ${Math.round(file.size / 1024)} KB
    `;
}

uploadInput.addEventListener("change", (event) => {
    const selectedFile = event.target.files[0];
    setSelectedAudioFile(selectedFile);
    clearTrimSelection();
    loadAudioFile(selectedFile);
    // Sync navigation index to the file input stop so Down arrow
    // moves to file-info next.
    // currentSectionIndex = getNavigableSections().findIndex(el => el === uploadInput);
});

function toggleSection() {
    const section = document.getElementById("audio-trimmer");

    trimmingMode = !trimmingMode;
    section.style.display = trimmingMode ? "block" : "none";

    if (trimToggle) {
        trimToggle.setAttribute("aria-expanded", String(trimmingMode));
        trimToggle.textContent = trimmingMode ? "Hide trim" : "Trim";
    }

    // Move focus into the newly revealed trim section so screen reader users
    // land there immediately without having to search for it.
    if (trimmingMode) {
        const trimHeading = document.getElementById('trim-heading');
        trimHeading.focus();
        // currentSectionIndex = getNavigableSections().length - 1;
    }
}

if (trimToggle) {
    trimToggle.addEventListener("click", toggleSection);
}

document.addEventListener("keydown", (event) => {
    const startTime = document.getElementById("Start-time");
    const endTime = document.getElementById("End-time");

    // Decide which player is active
    const activePlayer = trimmingMode ? trimPlayer : previewPlayer;

    // Play/Pause
    if (event.key === " ") {
        event.preventDefault();

        if (activePlayer.readyState >= 2) {
            if (activePlayer.paused) {
                activePlayer.play().catch(() => {});
            } else {
                activePlayer.pause();
            }
        }
    }
    // Stop
    if (event.key === "s" || event.key === "S") {
        activePlayer.pause();
        activePlayer.currentTime = 0;
    }

    // Arrow keys: on trim-player they scrub audio. Otherwise they navigate
    // through the configured section stops when allowed.
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (trimmingMode && document.activeElement === trimPlayer) {
            // Audio scrubbing — existing behaviour
            if (event.key === "ArrowUp") {
                trimPlayer.currentTime = Math.min(trimPlayer.duration, trimPlayer.currentTime + 5);
            } else {
                trimPlayer.currentTime = Math.max(0, trimPlayer.currentTime - 5);
            }
        } else if (shouldUseArrowNavigation()) {
            // Section navigation
            event.preventDefault();
            navigateSection(event.key === "ArrowDown" ? 1 : -1);
        }
        return;
    }

    // Everything below only works in trim mode
    if (!trimmingMode) return;

    // Mark and store start as trimStart variable
    if (event.key === "t" || event.key === "T") {
        const start = trimPlayer.currentTime;
        setTrimRange(start, audioState.trimEnd);
        startTime.textContent = `${start.toFixed(2)} seconds`;
    }

    // Mark and store end as trimEnd variable
    if (event.key === "e" || event.key === "E") {
        const end = trimPlayer.currentTime;
        setTrimRange(audioState.trimStart, end);
        endTime.textContent = `${end.toFixed(2)} seconds`;
    }

});
