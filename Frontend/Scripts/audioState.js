import { saveProject, loadProject } from './projectstore.js';

export const audioState = {
  selectedAudioFile: null,
  trimStart: null,
  trimEnd: null,
  activePlayerID: null,
  trimmedAudioUrl: null,
};

export function setTrimmedAudioUrl(url) {
  if (audioState.trimmedAudioUrl) {
    URL.revokeObjectURL(audioState.trimmedAudioUrl);
  }
  audioState.trimmedAudioUrl = url;
}
export function selectActivePlayer(id){
  audioState.activePlayerID = id;
}

export function clearActivePlayer() {
  audioState.activePlayerID = null;
}

export function setSelectedAudioFile(file) {
  audioState.selectedAudioFile = file;
}

export function setTrimRange(start, end) {
  // skip the dispatch when nothing changed to avoid an event/listener feedback loop
  if (audioState.trimStart === start && audioState.trimEnd === end) {
    return;
  }
  audioState.trimStart = start;
  audioState.trimEnd = end;

  document.dispatchEvent(
    new CustomEvent("trim-range-changed", {
      detail: {
        start,
        end,
      },
    })
  );
}

// Registered once: persists the trim range whenever it changes.
document.addEventListener("trim-range-changed", async (e) => {
  const { start, end } = e.detail;
  const hasRange = Number.isFinite(start) && Number.isFinite(end);
  try {
    const stored = await loadProject();
    // Nothing stored yet (no audio uploaded) or range identical (restore): don't write.
    if (!stored || (stored.trimStart === start && stored.trimEnd === end)) return;
    await saveProject({
      trimStart: hasRange ? start : null,
      trimEnd: hasRange ? end : null,
      duration: hasRange ? end - start : null,
      // a changed range makes any previously trimmed audio stale
      trimmedWav: null,
      trimmedMp3: null,
    });
  } catch (err) {
    console.error("Could not save trim range:", err);
  }
});

export function clearTrimSelection() {
  audioState.trimStart = null;
  audioState.trimEnd = null;

  document.dispatchEvent(
    new CustomEvent("trim-range-changed", {
      detail: {
        start: null,
        end: null,
      },
    })
  );
   // screen reader: trim starting points cleared
}


