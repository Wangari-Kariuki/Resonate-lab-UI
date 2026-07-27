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
        document.getElementById('preview-player'),             // Audio preview player
        document.getElementById('save-audio'),                 // Save button
        document.getElementById('toggle-trim'),                // Trim button
    ];

    const trimmer = document.getElementById('audio-trimmer');
    if (trimmer && trimmer.style.display !== 'none') {
        sections.push(
            document.getElementById('trim-heading'),           // "Trim audio"
            document.getElementById('trim-player'),            // Trim audio player
            document.getElementById('in01'),                   // Trim marker input
            document.getElementById('save-trim'),              // Save trimmed audio
        );
    }

    return sections;
}

let currentSectionIndex = 0;

function navigateSection(direction) {
    const sections = getNavigableSections();
    currentSectionIndex = Math.max(0, Math.min(sections.length - 1, currentSectionIndex + direction));
    const target = sections[currentSectionIndex];
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.focus();
}

// Tags that own arrow-key behaviour — don't intercept in these cases.
const INTERACTIVE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'AUDIO', 'VIDEO', 'A']);

function focusIsOnInteractiveElement() {
    return INTERACTIVE_TAGS.has(document.activeElement.tagName);
}
// ─────────────────────────────────────────────────────────────────────────────

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
        currentSectionIndex = getNavigableSections().length - 1;
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
    if (event.code === "Space") {
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

    // Arrow keys: in trim mode they scrub the audio; outside trim mode they
    // navigate between page sections (only when no interactive element is focused).
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (trimmingMode) {
            // Audio scrubbing — existing behaviour
            if (event.key === "ArrowUp") {
                trimPlayer.currentTime = Math.min(trimPlayer.duration, trimPlayer.currentTime + 5);
            } else {
                trimPlayer.currentTime = Math.max(0, trimPlayer.currentTime - 5);
            }
        } else if (!focusIsOnInteractiveElement()) {
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

