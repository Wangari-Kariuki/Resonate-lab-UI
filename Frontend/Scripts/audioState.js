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


