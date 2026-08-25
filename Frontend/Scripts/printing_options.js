import { loadTrimmedAudioForHandoff, clearTrimmedAudioForHandoff } from './audioHandoff.js';

const SendToDrive = document.getElementById("Send-to-lab");
const confirmButton = document.getElementById("confirm-save-stl");
const prepSection = document.getElementById("prep");
const prepAnnouncement = document.getElementById("preparing-model-announcement");

let handoffAudio = null;
let latestStlBlob = null;

loadTrimmedAudioForHandoff().then((result) => {
    handoffAudio = result;
});

function showProcessingStatus(message) {
    prepSection.classList.remove("hidden");
    prepAnnouncement.textContent = message;
}

async function postAudioFile(blob, filename, endpoint) {
    const formData = new FormData();
    formData.append("audio", blob, filename);

    return fetch(endpoint, {
        method: "POST",
        body: formData
    });
}

async function uploadTrimmedAudio(blob, name) {
    const response = await postAudioFile(blob, name, "http://127.0.0.1:3000/api/audio");
    if (!response.ok) {
        throw new Error("Upload Failed");
    }
    return response.json();
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
}

// the handed-off blob is already raw WAV PCM, so it can go straight to the STL endpoint
async function requestStlFromHandoff() {
    if (!handoffAudio) {
        throw new Error("No trimmed audio found. Go back and trim your audio first.");
    }

    const response = await postAudioFile(handoffAudio.blob, handoffAudio.name, "http://127.0.0.1:3000/api/stl");
    if (!response.ok) {
        throw new Error(`STL request failed: ${response.status}`);
    }
    return response.blob();
}

SendToDrive?.addEventListener("click", async () => {
    try {
        if (!handoffAudio) {
            throw new Error("No trimmed audio found. Go back and trim your audio first.");
        }
        showProcessingStatus("Sending audio to Resonate…");
        const uploadedFile = await uploadTrimmedAudio(handoffAudio.blob, handoffAudio.name);
        console.log("uploaded file:", uploadedFile);
        showProcessingStatus("Audio sent to Resonate.");
        clearTrimmedAudioForHandoff();
    } catch (error) {
        console.error("upload Failed", error);
        showProcessingStatus(error.message || "Audio could not be sent.");
    }
});

["select1", "select2", "select3"].forEach((id) => {
    const button = document.getElementById(id);
    const statusEl = document.getElementById(`${id}-status`);
    const optionSection = button?.closest("#image-box");

    button?.addEventListener("click", async () => {
        if (button.disabled) return;

        // second click, once ready, downloads instead of re-requesting the STL
        if (button.dataset.state === "ready") {
            downloadBlob(latestStlBlob, "audio-ring.stl");
            return;
        }

        document.querySelectorAll(".print-options #image-box.selected")
            .forEach((section) => section.classList.remove("selected"));
        optionSection?.classList.add("selected");

        button.disabled = true;
        if (statusEl) statusEl.textContent = "Preparing your selected 3D model…";
        try {
            latestStlBlob = await requestStlFromHandoff();
            button.textContent = "Download STL";
            button.dataset.state = "ready";
            if (statusEl) statusEl.textContent = "Model ready. Select Download to save the STL.";
        } catch (error) {
            console.error("Could not prepare model:", error);
            if (statusEl) statusEl.textContent = error.message || "Could not prepare the model. Please try again.";
        } finally {
            button.disabled = false;
        }
    });
});
