import { clearProject } from './projectstore.js';

// Starting a new project is the only place the saved project is discarded.
const newProjectLink = document.getElementById("new-project-link");
newProjectLink?.addEventListener("click", async (event) => {
    event.preventDefault();
    try {
        await clearProject();
    } catch (error) {
        console.error("Could not clear the saved project:", error);
    }
    window.location.href = newProjectLink.href;
});
