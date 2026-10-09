import { loadProject } from './projectstore.js';

const SendToDrive = document.getElementById("Send-to-lab");
const confirmButton = document.getElementById("confirmchanges");
const prepSection = document.getElementById("prep");
const prepAnnouncement = document.getElementById("preparing-model-announcement");

let handoffAudio = null;
let latestStlBlob = null;

loadProject().then((record) => {
    if (record?.trimmedWav) {
        handoffAudio = { blob: record.trimmedWav, name: "trimmed-audio.wav" };
    }
}).catch((error) => console.error("Could not load saved project:", error));

function showProcessingStatus(message) {
    prepSection.classList.remove("hidden");
    prepAnnouncement.textContent = message;
}

async function postAudioFile(blob, filename, endpoint, fields = {}) {
    const formData = new FormData();
    // text fields go before the file so multer has them when it parses the upload
    Object.entries(fields).forEach(([key, value]) => {
        if (value !== undefined && value !== null) formData.append(key, value);
    });
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

    const settings = {
        diameter: document.getElementById("ctl-diameter").value,
        height: document.getElementById("ctl-height").value,
        count: document.getElementById("ctl-count").value
    };
    const response = await postAudioFile(handoffAudio.blob, handoffAudio.name, "http://127.0.0.1:3000/api/stl", settings);
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
    } catch (error) {
        console.error("upload Failed", error);
        showProcessingStatus(error.message || "Audio could not be sent.");
    }
});

const modelIds = ["select1", "select2", "select3"];
let selectedId = null;

function setModelStatus(id, message) {
    const statusEl = document.getElementById(`${id}-status`);
    if (statusEl) statusEl.textContent = message;
}

// any change to the model or sliders makes a generated STL out of date
function resetConfirm() {
    latestStlBlob = null;
    confirmButton.dataset.state = "";
    confirmButton.textContent = "Confirm Option";
}

modelIds.forEach((id) => {
    const button = document.getElementById(id);
    const optionSection = button?.closest("#image-box");

    button?.addEventListener("click", () => {
        modelIds.forEach((other) => setModelStatus(other, ""));
        document.querySelectorAll(".print-options #image-box.selected")
            .forEach((section) => section.classList.remove("selected"));
        optionSection?.classList.add("selected");

        selectedId = id;
        resetConfirm();
        setModelStatus(id, "Selected. Adjust the ring, then choose Confirm Option.");
    });
});

["ctl-diameter", "ctl-height", "ctl-count"].forEach((ctlId) => {
    document.getElementById(ctlId)?.addEventListener("input", () => {
        if (latestStlBlob) {
            resetConfirm();
            if (selectedId) setModelStatus(selectedId, "Settings changed. Choose Confirm Option to rebuild the model.");
        }
    });
});

confirmButton?.addEventListener("click", async () => {
    if (confirmButton.disabled) return;

    // once ready, the same button downloads instead of re-requesting the STL
    if (confirmButton.dataset.state === "ready") {
        downloadBlob(latestStlBlob, "audio-ring.stl");
        return;
    }

    if (!selectedId) {
        showProcessingStatus("Select a model first.");
        return;
    }

    confirmButton.disabled = true;
    showProcessingStatus("Preparing your selected 3D model…");
    setModelStatus(selectedId, "Preparing your selected 3D model…");
    try {
        latestStlBlob = await requestStlFromHandoff();
        confirmButton.textContent = "Download STL";
        confirmButton.dataset.state = "ready";
        showProcessingStatus("Model ready. Select Download STL to save it.");
        setModelStatus(selectedId, "Model ready. Select Download STL to save it.");
    } catch (error) {
        console.error("Could not prepare model:", error);
        const message = error.message || "Could not prepare the model. Please try again.";
        showProcessingStatus(message);
        setModelStatus(selectedId, message);
    } finally {
        confirmButton.disabled = false;
    }
});

const saveStlButton = document.getElementById("save-stl");
saveStlButton?.addEventListener("click", () => {
    if (latestStlBlob) {
        downloadBlob(latestStlBlob, "audio-ring.stl");
    } else {
        showProcessingStatus("No STL available. Please confirm the model first.");
    }
});