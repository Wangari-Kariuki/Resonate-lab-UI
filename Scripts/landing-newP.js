
const btn1 = document.getElementById("guide-page-link");
const btn2 = document.getElementById("new-project-link");

btn1.addEventListener ("click",  () => {
    window.location.href ="./guide.html";
});

btn2.addEventListener ("click",  () => {
    window.location.href ="./new-project.html";
});

const btn3 = document.getElementById("upload-new");
const btn4 = document.getElementById("select-from-library");

function handleFies(event){
    var files = event.target.files;
    $("#src").attr("src", URL.createObjectURL.Url(files[0]));
    document.getElementById("audio").load();
}
document.getElementById("upload").addEventListener("change", handleFies,false)