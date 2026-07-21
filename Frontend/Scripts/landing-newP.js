
const btn1 = document.getElementById("guide-page-link");
const btn2 = document.getElementById("new-project-link");
const btn3 = document.getElementById("upload-new");
const btn4 = document.getElementById("select-from-library");
const btn5 =  document.getElementById("go-to-home");
btn1.addEventListener ("click",  () => {
    window.location.href ="./guide.html";
});

btn2.addEventListener ("click",  () => {
    window.location.href ="./new-project.html";
});

btn5.addEventListener ("click",  () => {
    window.location.href ="./landing_page.html";
});
function handleFies(event){
    var files = event.target.files;
    $("#src").attr("src", URL.createObjectURL.Url(files[0]));
    document.getElementById("audio").load();
}

document.getElementById('audio-upload').addEventListener('change', function(event) {
    const file = event.target.files[0]; // Get the uploaded file
    const fileInfo = document.getElementById('file-info');
    const audioPlayer = document.getElementById('audio-player');

    // Check if a file was actually selected
    if (file) {
        // Display the selected file's name
        fileInfo.textContent = `Playing: ${file.name}`;

        // Create a local, temporary blob URL for the audio file
        const fileURL = URL.createObjectURL(file);

        // Pass the blob link to the audio elements source
        audioPlayer.src = fileURL;

        // Automatically start playback
        audioPlayer.play();
    } else {
        fileInfo.textContent = "No file selected yet";
        audioPlayer.src = "";
    }
});
