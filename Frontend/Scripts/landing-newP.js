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
    loadAudioFile(event.target.files[0]);
});

function toggleSection() {
    const section = document.getElementById("audio-trimmer");

    trimmingMode = !trimmingMode;
    section.style.display = trimmingMode ? "block" : "none";

    if (trimToggle) {
        trimToggle.setAttribute("aria-expanded", String(trimmingMode));
        trimToggle.textContent = trimmingMode ? "Hide trim" : "Trim";
    }
}

if (trimToggle) {
    trimToggle.addEventListener("click", toggleSection);
}

document.addEventListener("keydown", (event) => {

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

    // Everything below only works in trim mode
    if (!trimmingMode) return;

    const startTime = document.getElementById("Start-time");
    const endTime = document.getElementById("End-time");

    // Mark start
    if (event.key === "t" || event.key === "T") {
        startTime.textContent =
            `Start time: ${trimPlayer.currentTime.toFixed(2)} seconds`;
    }

    // Mark end
    if (event.key === "e" || event.key === "E") {
        endTime.textContent =
            `End time: ${trimPlayer.currentTime.toFixed(2)} seconds`;
    }

    // Skip forward 5 seconds
    if (event.key === "ArrowUp") {
        trimPlayer.currentTime = Math.min(
            trimPlayer.duration,
            trimPlayer.currentTime + 5
        );
    }

    // Skip backward 5 seconds
    if (event.key === "ArrowDown") {
        trimPlayer.currentTime = Math.max(
            0,
            trimPlayer.currentTime - 5
        );
    }
});