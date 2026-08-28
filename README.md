# Resonate-lab-UI
Accessible Audio to 3D interface for blind and visually impaired users. 
<!-- 
## File Structure

```
Resonate-lab-UI/
│
├── README.md
├── Backend/
│   ├── app.js
│   ├── package.json
│   └── audio/
│
└── Frontend/
    ├── Features/
    ├── Pages/
    │   ├── guide.html
    │   ├── help.html
    │   ├── landing_page.html
    │   ├── landingpage.css
    │   ├── new-project.html
    │   ├── pages.html
    │   ├── project-history.html
    │   └── Settings.html
    └── Scripts/
        └── landing-newP.js
``` -->
### Cloning 
1. Open terminal in command line
2. Copy the github link to this repository
3. In command line cd ito the folder you would like to add the repository and enter: git clone _github link_
4. After cloning you will see the _file structure here_

## Install prerequisites
Node.js, preferabl the lts version
Python 3 
Git
Redis

### Install frontend packages 
from the project root:
 npm intall

### Install backend packages 
 cd backend 
 npm install

This installs Express, Multer, Google APIs, CORS, BullMQ and other backend dependencies listed in _package.json_


### Create and activate the project virtual environment
 py -m venv .venv
 .\.venv\Scripts\Activate.ps1

### Install Python packages 
Create requirements.tt in the repository root, then install dependencies with 
 py -m intall -r requirements.txt



## Run the Project
Open two terminals
Terminal 1 from the project root:
 npm run dev

In terminal 2
 cd backend 
 node app.js



## Requirements for this project
This project contains 2 depedency systems Frontend/Backend uses npm manifests  and the converter uses python.
The node environment contains all the path and routing handlers, interactive functions and logic.

The python script uses only numpy and scipy argparse and struct so it cn run on a normal python installation 
Added command line inputs: The script uses command line inputs input.wav file and output.wav file as defined in audio_ring_to_stl.py
Added WAV loading: scipy.io reads theuploaded audio, while the script converts integer and unsigned audio sampls into normalized floating point values 
Added sterio support
Added a native STL writer:Creates binary STL directly using python's STRUCT  module, avoiding another mesh package
App.js loads the audio and saves it temporarily, starts the python script and returns the generated STL download

Converter initially supports wav files

### Trimming Logic (`trimming_logic.js`)
- Extracts an audio slice from the selected file using the Web Audio API.
- Encodes the trimmed slice to MP3 using `@breezystack/lamejs`.
- Triggers trim and download via:
  - Clicking the **Save** button (`#save-trim`)
  - Pressing **Enter** while the trim marker input (`#in01`) is focused

### Customized Keyboard Navigation (`landing-newP.js`)

#### Arrow Key — Section Navigation
Arrow keys move focus through the page in order when audio is **not** being actively scrubbed:

| Key | Action |
|-----|--------|
| `↓` Down Arrow | Move focus to the next element |
| `↑` Up Arrow | Move focus to the previous element |

**Navigation stops (in order):**
1. Page title (`h1`)
2. Sidebar navigation (`nav`)
3. Upload audio heading
4. File picker input
5. File info status message
6. Audio preview player
7. Action row (Save / Trim buttons)
8. Save audio button
9. Trim audio button
10. *(When trim panel is open)* Trim heading → Trim controls guide → individual instructions → Trim player → Trim marker input → Time display → Start time → End time → Save trimmed button

**Scrubbing mode (trim panel only, focus on trim player while playing):**

| Key | Action |
|-----|--------|
| `↑` Up Arrow | Skip 5 seconds forward |
| `↓` Down Arrow | Skip 5 seconds backward |

#### Other Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause active audio player |
| `T` | Mark trim start point at current playback time |
| `E` | Mark trim end point at current playback time |
| `Enter` (on trim input) | Trim and download audio |

<!-- # integrating the audio to stl coverter into the choose print option pg

## Audio to 3D conversion Logic -->
