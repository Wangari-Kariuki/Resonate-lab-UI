
const btn1 = document.getElementById("guide-page-link");
const btn2 = document.getElementById("new-project-link");

btn1.addEventListener ("click",  () => {
    window.location.href ="./guide.html";
});

btn2.addEventListener ("click",  () => {
    window.location.href ="./new-project.html";
});
