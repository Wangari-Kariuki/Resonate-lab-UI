export const audioState = {
  selectedAudioFile: null,
  trimStart: null,
  trimEnd: null,
};

export function setSelectedAudioFile(file) {
  audioState.selectedAudioFile = file;
}

export function setTrimRange(start, end) {
  audioState.trimStart = start;
  audioState.trimEnd = end;
}

export function clearTrimSelection() {
  audioState.trimStart = null;
  audioState.trimEnd = null;
}
