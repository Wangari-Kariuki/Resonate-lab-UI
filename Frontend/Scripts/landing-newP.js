import { audioState, setSelectedAudioFile, clearTrimSelection, selectActivePlayer, clearActivePlayer } from './audioState.js';
import { initTrimKeyboard, initNewTrimButton } from './navigating_trimmer.js';
export const uploadInput = document.getElementById("audio-input");
const uploadLabel = document.querySelector('label[for="audio-input"]');
const previewPlayer = document.getElementById("preview-player");
const trimPlayer = document.getElementById("trim-player");
const previewHint = document.getElementById("preview-hint");
const trimGuide = document.getElementById("trim-guide");
const srAnnouncer = document.getElementById("sr-announcer");
const fileInfo = document.getElementById("file-info");
const trimToggle = document.getElementById("toggle-trim");
const audioTrimmer = document.getElementById("audio-trimmer")
const trimmedAudioPlayer = document.getElementById("trim-preview");
const skipToMain = document.getElementById("skip-to-main");
const Main = document.getElementById("mid-container");

skipToMain?.addEventListener("click", (event) => {
    event.preventDefault();
    Main?.scrollIntoView({behavior: "smooth", block: "start"});
    Main?.focus();
});
function pausePlayer(player){
    if(!player) return;
    player.pause();
    player.currentTime = 0;
};

const audioPlayers = [previewPlayer, trimPlayer, trimmedAudioPlayer].filter(Boolean);

function setExclusivePlayback(activePlayer, activePlayerId) {
    for (const player of audioPlayers) {
        if (player !== activePlayer && !player.paused) {
            pausePlayer(player);
        }
    }
    selectActivePlayer(activePlayerId);
}

previewPlayer?.addEventListener("play", () => {
    setExclusivePlayback(previewPlayer, "preview-player");
});

trimPlayer?.addEventListener("play", () => {
    setExclusivePlayback(trimPlayer, "trim-player");
});

trimmedAudioPlayer?.addEventListener("play", () => {
    setExclusivePlayback(trimmedAudioPlayer, "trim-preview");
});

previewPlayer?.addEventListener("pause", () => {
    if (audioState.activePlayerID === "preview-player") clearActivePlayer();
});

trimPlayer?.addEventListener("pause", () =>{
    if (audioState.activePlayerID === "trim-player") clearActivePlayer();
});

trimmedAudioPlayer?.addEventListener("pause", ()=> {
    if(audioState.activePlayerID === "trim-preview") clearActivePlayer();
});
function announceFileStatus(message) {
    if (!fileInfo) return;

    // Reset first so assistive tech detects this as a fresh announcement.
    fileInfo.textContent = "";

    requestAnimationFrame(() => {
        fileInfo.textContent = message;
    });
}

function announceForScreenReader(message) {
    if (!srAnnouncer) return;

    srAnnouncer.textContent = "";
    requestAnimationFrame(() => {
        srAnnouncer.textContent = message;
    });
}


let trimmingMode = false;

export async function loadAudioFile(file) {
    if (!file) {
        announceFileStatus("No file selected yet.");

        previewPlayer.src = "";
        trimPlayer.src = "";

        previewPlayer.load();
        trimPlayer.load();
        return;
    }

    const fileURL = URL.createObjectURL(file);
    previewPlayer.src = fileURL;
    trimPlayer.src = fileURL;

    await new Promise((resolve) => {
        previewPlayer.addEventListener("loadedmetadata", resolve, {once: true});
    });
    const durationInSeconds = Math.floor(previewPlayer.duration || 0 );
    const minutes = Math.floor(durationInSeconds / 60);
    const remainingSeconds = durationInSeconds % 60;

    announceFileStatus(`Audio uploaded successfully. File: ${file.name}. Size: ${Math.round(file.size / 1024)} KB. Length: ${minutes}: ${remainingSeconds.toString().padStart(2, "0")} mm:ss. `);
}

function uploadFile(event){
    const selectedFile = event.target.files[0];
    setSelectedAudioFile(selectedFile);
    clearTrimSelection();
    loadAudioFile(selectedFile);
}

if (uploadInput) {
    // Process the file after the user confirms a selection.
    uploadInput.addEventListener("change", uploadFile);

    // Keep keyboard support explicit: Enter opens the picker.
    uploadInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            uploadInput.click();
        }
    });
}

if (uploadLabel && uploadInput) {
    uploadLabel.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            uploadInput.focus();
            uploadInput.click();
        }
    });
}

if (previewPlayer && previewHint) {
    previewPlayer.addEventListener("focus", () => {
        announceForScreenReader(previewHint.textContent.trim());
    });
}

if (trimPlayer && trimGuide) {
    trimPlayer.addEventListener("focus", () => {
        announceForScreenReader(trimGuide.textContent.trim());
    });
}


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
    trimToggle.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            toggleSection();
        }
    });
}
const startTime = document.getElementById("Start-time");
const endTime = document.getElementById("End-time");

initTrimKeyboard({
    audioTrimmer,
    trimPlayer,
    previewPlayer,
    trimmedAudioPlayer,
    getTrimmingMode: () => trimmingMode,
    startTimeEl: startTime,
    endTimeEl: endTime,
});

const newTrim = document.getElementById("new-trim");
initNewTrimButton({
    newTrimButton: newTrim,
    startTimeEl: startTime,
    endTimeEl: endTime,
});
