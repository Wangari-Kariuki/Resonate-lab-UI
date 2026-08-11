import { loadAudioFile } from "../Scripts/landing-newP"
const WaveformContainer = document.getElementById("Waveform")
const audiofileInput = document.getElementById("audio-file")
const playButton = document.getElementById("play-btn")
const pauseButton = document.getElementById("pause-btn")
const openWavebtn = document.getElementById("open-waveform-btn")


const wavesurfer = WaveSurfer.create({
    container:WaveformContainer
    wavesurfer.loadAudioFile()
})


let WaveformDisplay = false
function openDisplay() {
    const section = document.getElementById("waveform");
 
    WaveformDisplay = !WaveformDisplay;
    section.style.display = WaveformDisplay ? "block" : "none";

    if (openWavebtn) {
        openWavebtn.setAttribute("aria-expanded", String(WaveformDisplay));
        openWavebtn.textContent = WaveformDisplay ? "Hide waveform" : "Show waveform";
    }

    // Move focus into the newly revealed waveform section so screen reader users
    // land there immediately without having to search for it.
    if (WaveformDisplay) {
       WaveformDisplay.focus()
        // currentSectionIndex = getNavigableSections().length - 1;
    }
   
}

if(openWavebtn){
    openWavebtn.addEventListener("click", openDisplay);
    openWavebtn.addEventListener("keydown", (event)=>{
        if (event.key === "Enter"){
            event.preventDefault();
            toggleSection();
        }
    });
}


