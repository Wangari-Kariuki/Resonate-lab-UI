import { loadTrimmedAudioForHandoff, clearTrimmedAudioForHandoff } from './audioHandoff.js';

const SendToDrive = document.getElementById("Send-to-lab");
let handoffAudio = null;

loadTrimmedAudioForHandoff().then((result) => {
    handoffAudio = result;
});

async function uploadTrimmedAudio(mp3Blob, name) {
    const formData = new FormData();
    formData.append("audio", mp3Blob, name);

    const response = await fetch("http://127.0.0.1:3000/api/audio", {
        method: "POST",
        body: formData
    });
    if (!response.ok) {
        throw new Error("Upload Failed");
    }
    return response.json();
}

SendToDrive?.addEventListener("click", async () => {
    try {
        if (!handoffAudio) {
            throw new Error("No trimmed audio found. Go back and trim your audio first.");
        }
        const uploadedFile = await uploadTrimmedAudio(handoffAudio.blob, handoffAudio.name);
        console.log("uploaded file:", uploadedFile);
        clearTrimmedAudioForHandoff();
    } catch (error) {
        console.error("upload Failed", error);
    }
});
