# Resonate-lab-UI
Accessible 3D printing web interface for blind and visually impaired users 

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
```

## New Project Page — Trimming & Keyboard Navigation

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
| `S` | Stop active audio player (pause and reset to start) |
| `T` | Mark trim start point at current playback time |
| `E` | Mark trim end point at current playback time |
| `Enter` (on trim input) | Trim and download audio |

# integrating the audio to stl coverter into the choose print option pg

