import lamejs from "@breezystack/lamejs";
import { audioState } from './audioState.js';

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

const saveButton = document.getElementById("save-trim");

 async function saveTrimmedAudio ()  {
    try {
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
        const mp3Blob = encodeMp3(trimmedBuffer);

        downloadMp3(mp3Blob);
    } catch (error) {
        console.error(error);
    }
};
saveButton.addEventListener("click", saveTrimmedAudio);

//Enter key trigger when trim input is focused
document.addEventListener("keydown", (event) => {
    if(event.key === "Enter"){
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

    const trimmedBuffer = await extractAudioSlice(
      audioState.selectedAudioFile,
      audioState.trimStart,
      audioState.trimEnd
    );
    const mp3Blob = encodeMp3(trimmedBuffer);

    const trimPreview = document.getElementById("trim-preview");
    const url = URL.createObjectURL(mp3Blob);

    trimPreview.src = url;
    trimPreview.load();
    await trimPreview.play();
  } catch (error) {
    console.error(error);
  }
}

const trimPreviewBtn = document.getElementById("trim-preview-btn");
trimPreviewBtn?.addEventListener("click", () => {
  previewTrimmedAudio();
});