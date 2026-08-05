import { audioState, setTrimRange, clearTrimSelection } from './audioState.js';
import { navigateSection, shouldUseArrowNavigation } from './landing-newP.js';
const audioTrimmer = document.getElementById("audio-trimmer")
const startTime = document.getElementById("Start-time");
const endTime = document.getElementById("End-time");

