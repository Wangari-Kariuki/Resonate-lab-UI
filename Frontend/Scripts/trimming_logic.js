import lamejs from "@breezystack/lamejs";
import { audioState, selectActivePlayer, setTrimmedAudioUrl } from './audioState.js';
import { saveTrimmedAudioForHandoff } from './audioHandoff.js';

//Trimming logic 
async function extractAudioSlice(file, startTime, endTime){

    //convert the file object to arraybuffer
    const arrayBuffer = await file.arrayBuffer();

    //decode the audio binary data into an AudioBuffer
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const mainAudioBuffer =  await audioCtx.decodeAudioData(arrayBuffer);

    //calculate the frames and bounderies (now that we have an audiobuffer- collection of samples 
    //airpreasure reading sper instant  we can calculate the sample rate at the start and end time)

    const sampleRate = mainAudioBuffer.sampleRate;
    const numberOfChannels = mainAudioBuffer.numberOfChannels;

    const StartFrame = Math.max(0, Math.floor(startTime * sampleRate));
    const EndFrame = Math.min(mainAudioBuffer.length, Math.floor(endTime * sampleRate));
    if (EndFrame <= StartFrame){
        throw new Error("invalid trim range")
    }
    const totalFrames = EndFrame - StartFrame;

    //create a new empty audiobuffer for the trimmed clip
    const trimmedBuffer =  audioCtx.createBuffer(numberOfChannels, totalFrames, sampleRate);

    for (let channel = 0; channel < numberOfChannels; channel++){
        const originalData = mainAudioBuffer.getChannelData(channel);
        const trimmedData = trimmedBuffer.getChannelData(channel);

        //slice the specific frame range
        const chunk = originalData.subarray(StartFrame, EndFrame);
        trimmedData.set(chunk);
    }
    return trimmedBuffer; //ths contains floating point values of PCM samples 
}

//Encoding the trimmedbuffer into mp3 blob
function encodeMp3(trimmedBuffer, bitrate = 128){
    const channels = trimmedBuffer.numberOfChannels;
    const sampleRate = trimmedBuffer.sampleRate;

    const encoder = new lamejs.Mp3Encoder(
        channels, 
        sampleRate, 
        bitrate
    );
    const mp3Data = [];
    const blockSize = 1152;

    if (channels === 1){
        const samples = trimmedBuffer.getChannelData(0);
        const pcm = floatTo16BitPCM(samples);

        for (let i =0;i < pcm.length; i += blockSize){
            const chunk = pcm.subarray(i, i + blockSize);
            const mp3buf = encoder.encodeBuffer(chunk);

            if (mp3buf.length > 0){
                mp3Data.push(new Uint8Array(mp3buf));
                }
        }
    }
    else if (channels === 2){
        const left = floatTo16BitPCM(trimmedBuffer.getChannelData(0));
        const right = floatTo16BitPCM(trimmedBuffer.getChannelData(1));
        for (let i =0;i < left.length; i += blockSize){
            const leftChunk =  left.subarray(i, i + blockSize);
            const rightChunk = right.subarray(i, i + blockSize);

            const mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);

            if (mp3buf.length > 0){
                mp3Data.push(new Uint8Array(mp3buf));
            }
        }
    }
    else {
        throw new Error ("Only mono and stereo AudioBuffers are supported. ")
    }
    const end = encoder.flush();
    if (end.length > 0){
        mp3Data.push(new Uint8Array(end));
    }
    return new Blob(mp3Data, {type: "audio/mpeg"})

  
}


 // converts float 32 PCM (-1 TO 1)into int16 PCM
  function floatTo16BitPCM(float32Array){
        const pcm = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i ++){
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return pcm;
    }

//Encoding the trimmedbuffer into an uncompressed WAV blob (no lossy re-encode needed downstream)
function encodeWav(trimmedBuffer){
    const channels = trimmedBuffer.numberOfChannels;
    const sampleRate = trimmedBuffer.sampleRate;
    const channelData = [];
    for (let channel = 0; channel < channels; channel++){
        channelData.push(floatTo16BitPCM(trimmedBuffer.getChannelData(channel)));
    }
    const frameCount = channelData[0].length;

    // interleave channels
    const interleaved = new Int16Array(frameCount * channels);
    for (let i = 0; i < frameCount; i++){
        for (let channel = 0; channel < channels; channel++){
            interleaved[i * channels + channel] = channelData[channel][i];
        }
    }

    const bytesPerSample = 2;
    const blockAlign = channels * bytesPerSample;
    const dataSize = interleaved.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset, str) => {
        for (let i = 0; i < str.length; i++){
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);           // PCM fmt chunk size
    view.setUint16(20, 1, true);            // audio format = PCM
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true); // byte rate
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);           // bits per sample
    writeString(36, "data");
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < interleaved.length; i++, offset += 2){
        view.setInt16(offset, interleaved[i], true);
    }

    return new Blob([buffer], { type: "audio/wav" });
}

const saveButton = document.getElementById("save-Mp3-trim");
const downloadButton = document.getElementById("download-Mp3-trim");
const trimPreview = document.getElementById("trim-preview");
const trimPlayer = document.getElementById("trim-player");
const trimmedAudioInfo = document.getElementById("trimmed-audio-file-info");
const srAnnouncer = document.getElementById("sr-announcer");

//Writing and announcing trimmed audio file info
function formatSeconds(totalSeconds) {
    const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
}

function writeStatus(el, message) {
    if (!el) return;
    el.textContent = "";
    requestAnimationFrame(() => {
        el.textContent = message;
    });
}

function announceTrimmedAudio(startTime, endTime, durationSeconds) {
    const message = `Audio trimmed successfully. Start ${formatSeconds(startTime)}, end ${formatSeconds(endTime)}, duration ${formatSeconds(durationSeconds)}.`;
    writeStatus(trimmedAudioInfo, message);
    writeStatus(srAnnouncer, message);
}


 let latestTrimmedMp3 = null;

 //builds the trimmed mp3 blob once and caches it for saving/downloading
 async function buildTrimmedMp3() {
    if (!audioState.selectedAudioFile) {
        throw new Error("No audio file selected.");
    }
    if (audioState.trimStart === null || audioState.trimEnd === null) {
        throw new Error("Please mark both a start and end time before saving.");
    }
    const trimmedBuffer = await extractAudioSlice(
        audioState.selectedAudioFile,
        audioState.trimStart,
        audioState.trimEnd
    );

    latestTrimmedMp3 = encodeMp3(trimmedBuffer);
    announceTrimmedAudio(audioState.trimStart, audioState.trimEnd, trimmedBuffer.duration);
    return latestTrimmedMp3;
}

//stores the trimmed mp3 as a local blob URL without downloading it
async function saveTrimmedAudio() {
    try {
        const mp3Blob = await buildTrimmedMp3();
        const url = URL.createObjectURL(mp3Blob);
        setTrimmedAudioUrl(url);
    } catch (error) {
        console.error(error);
    }
}

//downloads the trimmed mp3 to the user's computer, building it first if needed
async function downloadTrimmedAudio() {
    try {
        const mp3Blob = latestTrimmedMp3 ?? await buildTrimmedMp3();
        downloadMp3(mp3Blob);
    } catch (error) {
        console.error(error);
    }
}

saveButton?.addEventListener("click", saveTrimmedAudio);
downloadButton?.addEventListener("click", downloadTrimmedAudio);

//Enter key trigger when trim input is focused
document.addEventListener("keydown", (event) => {
    if(event.key === "Enter" && event.target?.id === "trim-time-input"){
        event.preventDefault();
        saveTrimmedAudio();
    }
});

function downloadMp3(mp3Blob){
    //we create a blob so that the browser can treat the mp3 as a downloadable file
    const url = URL.createObjectURL(mp3Blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "trimmed-audio.mp3";

    link.click();

    URL.revokeObjectURL(url);
}
async function previewTrimmedAudio() {
  try {
    if (!audioState.selectedAudioFile) {
      throw new Error("No audio file selected.");
    }
    if (audioState.trimStart === null || audioState.trimEnd === null) {
      throw new Error("Please mark both a start and end time before previewing.");
    }

        if (trimPlayer && !trimPlayer.paused) {
            trimPlayer.pause();
            trimPlayer.currentTime = 0;
        }

    const trimmedBuffer = await extractAudioSlice(
      audioState.selectedAudioFile,
      audioState.trimStart,
      audioState.trimEnd);
        const mp3Blob = encodeMp3(trimmedBuffer);
        const url = URL.createObjectURL(mp3Blob);

        if (!trimPreview) {
            throw new Error("Trim preview player not found.");
        }
    trimPreview.src = url;
    trimPreview.load();
    await trimPreview.play();
        selectActivePlayer("trim-preview");
                announceTrimmedAudio(audioState.trimStart, audioState.trimEnd, trimmedBuffer.duration);
  } catch (error) {
    console.error(error);
  }
}

const trimPreviewBtn = document.getElementById("trim-preview-btn");
trimPreviewBtn?.addEventListener("click", () => {
  previewTrimmedAudio();
});
//setting new trim
//call on the extract audio slice function



//uploadin audio to drive
export async  function uploadTrimmedAudio(mp3Blob){
    const formData = new FormData();
    formData.append("audio", mp3Blob, "trimmed-audio.mp3");

    const response = await fetch("http://127.0.0.1:3000/api/audio", {
        method: "POST", 
        body: formData
    });
    if(!response.ok){
        throw new Error ("Upload Failed");
    }
    return response.json();
}

const SendToDrive = document.getElementById("Send-to-lab");
const sendStatus = document.getElementById("send-status");

function showSendStatus(message, state = "success") {
    if (!sendStatus) return;

    sendStatus.textContent = message;
    sendStatus.dataset.state = state;
    sendStatus.hidden = false;
}

SendToDrive?.addEventListener("click", async()=>{
    if (SendToDrive.disabled) return;

    SendToDrive.disabled = true;
    showSendStatus("Sending audio...", "sending");
    try {
        if(!latestTrimmedMp3){
            throw new Error("Please create a trimmed MP3 first.");
        }
        const uploadedFile = await uploadTrimmedAudio(latestTrimmedMp3);
        console.log("uploaded file:", uploadedFile);
        showSendStatus("Audio sent to Resonate.");
    }catch (error){
        console.error("upload Failed", error);
        showSendStatus(error.message || "Audio could not be sent.", "error");
    } finally {
        SendToDrive.disabled = false;
    }
})

const proceedToPrintLink = document.getElementById("proceed-to-print");

proceedToPrintLink?.addEventListener("click", async (event) => {
    event.preventDefault();
    try {
        const mp3Blob = latestTrimmedMp3 ?? await buildTrimmedMp3();
        await saveTrimmedAudioForHandoff(mp3Blob);
        window.location.href = proceedToPrintLink.href;
    } catch (error) {
        console.error("Could not carry trimmed audio to the next page:", error);
        window.location.href = proceedToPrintLink.href;
    }
});


const stl_req = document.getElementById("save-stl");
stl_req?.addEventListener("click", async () => {
  try {
    // STL generation reads raw PCM, so send WAV directly instead of encoding/decoding MP3
    if (!audioState.selectedAudioFile) {
        throw new Error("No audio file selected.");
    }
    if (audioState.trimStart === null || audioState.trimEnd === null) {
        throw new Error("Please mark both a start and end time before saving.");
    }
    const trimmedBuffer = await extractAudioSlice(
        audioState.selectedAudioFile,
        audioState.trimStart,
        audioState.trimEnd
    );
    const wavBlob = encodeWav(trimmedBuffer);

    console.log("STL input:", wavBlob, wavBlob instanceof Blob);

    if (!(wavBlob instanceof Blob)) {
      throw new Error("Could not create a trimmed WAV Blob.");
    }

    const formData = new FormData();
    formData.append("audio", wavBlob, "trimmed-audio.wav");

    const response = await fetch("http://localhost:3000/api/stl", {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      throw new Error(`STL request failed: ${response.status}`);
    }
  } catch (error) {
    console.error("Could not create STL:", error);
  }
});
//uploading trimmed audio to backend endpoint 
async function uploadTrimmedAudioToBackend() {
    const mp3Blob = await buildTrimmedMp3();
    const formData = new FormData();
    formData.append("audio", mp3Blob, "trimmed-audio.mp3")

    const response = await fetch ("http://localhost:3000/api/audio", {
        method: "POST", 
        body: formData
    })

    const result = await response.json();
    console.log(result);
}