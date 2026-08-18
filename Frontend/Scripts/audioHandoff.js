//convert trimmed audio blob to a data url via filereader.readAsData url and storein session storage
const STORAGE_KEY = "resonate:trimmedAudioHandoff";

export async function saveTrimmedAudioForHandoff(blob, name = "trimmed-audio.mp3"){
    const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({dataUrl, name}));
}
export async function loadTrimmedAudioForHandoff(){
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if(!raw) return null;

    const {dataUrl, name} = JSON.parse(raw);
    const blob = await fetch(dataUrl).then((res) => res.blob());
    return {blob, name};
}
export function clearTrimmedAudioForHandoff() {
    sessionStorage.removeItem(STORAGE_KEY);
}
