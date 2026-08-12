import WaveSurfer from "https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/wavesurfer.esm.js";
import { audioState } from "../Scripts/audioState.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";

const waveformPanel = document.getElementById("waveform-panel");
const waveformContainer = document.getElementById("waveform-canvas");
const audioFileInput = document.getElementById("audio-input");
const playButton = document.getElementById("play-button");
const pauseButton = document.getElementById("pause-button");
const openWaveBtn = document.getElementById("open-waveform-btn");

let isWaveformVisible = false;
let waveSurfer = null;

function ensureWaveSurfer() {
    if (waveSurfer || !waveformContainer) return;

    let regions;
    waveSurfer = WaveSurfer.create({
        container: waveformContainer,
        height: 96,
        waveColor: "#8a8a8a",
        progressColor: "#1a1a1a",
        cursorColor: "#1a1a1a",
        normalize: true,
    });
    regions = waveSurfer.registerPlugin(RegionsPlugin.create());
}

function loadSelectedFileIntoWaveform() {
    if (!waveSurfer || !audioState.selectedAudioFile) return;

    const fileUrl = URL.createObjectURL(audioState.selectedAudioFile);
    const cleanupObjectUrl = () => URL.revokeObjectURL(fileUrl);

    waveSurfer.once("ready", cleanupObjectUrl);
    waveSurfer.once("error", cleanupObjectUrl);
    waveSurfer.load(fileUrl);
}

function toggleWaveformDisplay() {
    if (!waveformPanel) return;

    isWaveformVisible = !isWaveformVisible;
    waveformPanel.style.display = isWaveformVisible ? "block" : "none";

    if (openWaveBtn) {
        openWaveBtn.setAttribute("aria-expanded", String(isWaveformVisible));
        openWaveBtn.textContent = isWaveformVisible ? "Hide waveform" : "Show waveform";
    }

    if (isWaveformVisible) {
        // Initialize only after the panel is visible so width calculations are correct.
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

function syncRegionFromState(){
    if(!waveSurfer || !regions) return;
    const duration = waveSurfer.getDuration() ||0;
    const start = Math.max(0,
        Number(audioState.trimStart ?? 0)
    );
    const endCandidate = Number(audioState.trimEnd ??
        Math.min(start + 1, duration));
    const end = Math.max(start + 0.05, 
        Math.min(endCandidate, duration  || endCandidate));
    const existing = regions.getRegions()[0];
    if(existing){
        existing.setOptions({start, end});

    }else {
        regions.addRegion({
            id:"trim-range",
            start,
            end,
            drag: true,
            resize: true,
            color: "rgba(26,26,26,0.20)",
        });
    }
}

//updating the start end regions while user drags 
regions.on("region-updated", (region) => {
setTrimRange(region.start, region.end);
startTimeEl.textContent = region.start.toFixed(2) + " seconds";
endTimeEl.textContent = region.end.toFixed(2) + " seconds";
});