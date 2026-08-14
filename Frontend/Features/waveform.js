import WaveSurfer from "https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/wavesurfer.esm.js";
import RegionsPlugin from "https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/plugins/regions.esm.js";
import { audioState, setTrimRange } from "../Scripts/audioState.js";

const waveformPanel = document.getElementById("waveform-panel");
const waveformContainer = document.getElementById("waveform-canvas");
const audioFileInput = document.getElementById("audio-input");
const playButton = document.getElementById("play-button");
const pauseButton = document.getElementById("pause-button");
const openWaveBtn = document.getElementById("open-waveform-btn");
const startTimeEl = document.getElementById("Start-time");
const endTimeEl = document.getElementById("End-time");

let isWaveformVisible = false;
let waveSurfer = null;
let regions = null;
let regionEventsBound = false;

function updateTimeLabels(start, end) {
    if (startTimeEl) startTimeEl.textContent = `${start.toFixed(2)} seconds`;
    if (endTimeEl) endTimeEl.textContent = `${end.toFixed(2)} seconds`;
}

function ensureWaveSurfer() {
    if (waveSurfer || !waveformContainer) return;

    waveSurfer = WaveSurfer.create({
        container: waveformContainer,
        height: 96,
        waveColor: "#8a8a8a",
        progressColor: "#ac3737",
        cursorColor: "#10b619",
        normalize: true,
    });

    regions = waveSurfer.registerPlugin(RegionsPlugin.create());

    if (!regionEventsBound && regions) {
        regions.on("region-updated", (region) => {
            setTrimRange(region.start, region.end);
            updateTimeLabels(region.start, region.end);
        });
        regionEventsBound = true;
    }

    waveSurfer.on("ready", () => {
        syncRegionFromState();
    });
}

function loadSelectedFileIntoWaveform() {
    if (!waveSurfer || !audioState.selectedAudioFile) return;

    const fileUrl = URL.createObjectURL(audioState.selectedAudioFile);
    const cleanupObjectUrl = () => URL.revokeObjectURL(fileUrl);

    waveSurfer.once("ready", cleanupObjectUrl);
    waveSurfer.once("error", cleanupObjectUrl);
    waveSurfer.load(fileUrl);
}

function syncRegionFromState() {
    if (!waveSurfer || !regions) return;

    const duration = waveSurfer.getDuration() || 0;
    if (duration <= 0) return;

    const start = Math.max(0, Number(audioState.trimStart ?? 0));
    const defaultEnd = Math.min(start + 1, duration);
    const endCandidate = Number(audioState.trimEnd ?? defaultEnd);
    const end = Math.max(start + 0.05, Math.min(endCandidate, duration));

    const existing = regions.getRegions()[0];
    if (existing) {
        existing.setOptions({ start, end });
    } else {
        regions.addRegion({
            id: "trim-range",
            start,
            end,
            drag: true,
            resize: true,
            color: "rgba(26,26,26,0.20)",
        });
    }

    setTrimRange(start, end);
    updateTimeLabels(start, end);
}

document.addEventListener("trim-range-changed", () => {
    if (!waveSurfer || !regions) return;

    // Only sync once audio is decoded; opening waveform later still syncs on "ready".
    if ((waveSurfer.getDuration() || 0) <= 0) return;
    syncRegionFromState();
});

function toggleWaveformDisplay() {
    if (!waveformPanel) return;

    isWaveformVisible = !isWaveformVisible;
    waveformPanel.style.display = isWaveformVisible ? "block" : "none";

    if (openWaveBtn) {
        openWaveBtn.setAttribute("aria-expanded", String(isWaveformVisible));
        openWaveBtn.textContent = isWaveformVisible ? "Hide waveform" : "Show waveform";
    }

    if (isWaveformVisible) {
        ensureWaveSurfer();
        loadSelectedFileIntoWaveform();
        waveformPanel.focus();
    }
}

if (openWaveBtn) {
    openWaveBtn.addEventListener("click", toggleWaveformDisplay);
    openWaveBtn.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleWaveformDisplay();
        }
    });
}

audioFileInput?.addEventListener("change", () => {
    if (!isWaveformVisible) return;
    ensureWaveSurfer();
    loadSelectedFileIntoWaveform();
});

playButton?.addEventListener("click", () => {
    if (!waveSurfer) return;
    waveSurfer.play();
});

pauseButton?.addEventListener("click", () => {
    if (!waveSurfer) return;
    waveSurfer.pause();
});

// activate_slider


//creating and updating region from existing start/end fucntions



//updating the start end regions while user drags 
// regions.on("region-updated", (region) => {
// setTrimRange(region.start, region.end);
// startTimeEl.textContent = region.start.toFixed(2) + " seconds";
// endTimeEl.textContent = region.end.toFixed(2) + " seconds";
// });