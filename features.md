# My Sounds page: "Listen as you explore"

A new **My Sounds** page lists the sounds saved in the current project. In its centered
**Listen as you explore** section, the user holds their printed torus and follows along while the
sound plays. The on-screen torus turns one full circle over the length of the sound.

## Files touched

| File | Change |
|---|---|
| `Frontend/Scripts/ringScene.js` | **New.** The Three.js scene moved out of `adjust-panel.js`: renderer, camera, lights, OrbitControls, `MODELS`, `BAND_HEIGHT` and `buildRing()`, wrapped in `createRingScene(canvas)`. |
| `Frontend/Scripts/adjust-panel.js` | About 85 lines of scene setup replaced by `import { MODELS, createRingScene }` and one call. The panel's behavior is unchanged. |
| `Frontend/Pages/my-sounds.html` | **New.** Sound list (radio buttons), audio player, time text, mode buttons, instruction, 3D canvas and a polite live region. |
| `Frontend/Styling/my-sounds.css` | **New.** Layout for the page. Theme, header and button styles come from `theme.css` (since the site redesign; see the end of this file). |
| `Frontend/Scripts/my_sounds.js` | **New.** Sound loading, mode state, rotation, reduced-motion marker and announcements. |
| `Backend/audio_ring_to_stl.py` | Added `add_start_marker()` (a tactile start marker) and a `--no-start-marker` flag. The marker is on by default. |
| `Frontend/Pages/Printing_options.html`, `Frontend/Pages/new-project.html` | One nav link to `my-sounds.html` in each. |

Nothing else was changed.

## How it works

### Reusing the torus scene
`adjust-panel.js` used to build its scene as soon as it loaded, using elements that only exist on
Printing Options, so loading it on any other page would crash. The smallest fix was to move the
scene code into `ringScene.js`:

- Both pages now call `createRingScene(canvas)`.
- `buildRing()` takes an optional `data` array (one value from 0 to 1 per ridge). Printing Options
  doesn't pass one, so it still uses the same placeholder pattern as before.
- My Sounds passes the real loudness of the selected sound. It decodes the audio with
  `OfflineAudioContext` and takes the RMS level of each slot. If decoding fails, it falls back to
  the placeholder pattern.

The torus uses the **Sound-Torus** (`select1`) default settings: 60 mm wide, 3 mm ridges, 64 ridges.

### Audio player
There was no shared player component; the pages use plain `<audio controls>` elements. My Sounds
uses the same element.

### Mode states
- **Before activation:** the "Activate listen as you explore mode" button is shown; the torus is hidden.
- **Activate:** shows the torus and the instruction. The button is replaced by **Restart** and
  **Deactivate mode**, and focus moves to Restart. Activating does not start playback.
- **Restart:** sets `currentTime = 0` and calls `play()`.
- **Deactivate:** pauses, sets the time back to 0:00, stops the redraw loop, resets the torus angle
  and the camera (`controls.reset()`), hides the torus and moves focus back to the Activate button.
- **When the sound ends:** the redraw loop stops; Restart and Deactivate stay available.
- **Choosing another sound, or leaving the page (`pagehide`, which also covers the back/forward
  cache):** runs Deactivate without moving focus.

### Rotation comes from the audio's current time
`applyAngle()` reads `audio.currentTime / audio.duration` and sets the angle from that.
`requestAnimationFrame` only decides when to redraw; it never keeps its own time. Because of this,
pausing, seeking with the player's controls and the end of the sound all stay in sync.

On screen, the sound runs in the same direction around the ring as on the print. The STL generator
places the sound counter-clockwise when seen from above. Three.js angles run the other way, so
the code places sound position *p* at angle `-p·2π`. A fixed orange pointer at the front shows
"now". A green block on the ring is the start marker.

### Tactile start marker on the print (`audio_ring_to_stl.py`)
The sound starts and ends at the same spot, angle 0. The script already fades the start and end to
the quietest (thinnest) part of the ring, so the marker sits in a smooth dip and is easy to find.
- **Raised, not cut in.** A cut would make the thinnest part of the ring even thinner and weaker.
- **Sawtooth shape, so it shows direction.** It has a steep edge on the end-of-sound side and a
  gentle slope that runs the way the sound plays. The page tells the user: start at the steep edge,
  follow the gentle slope, and stop when you come back to the steep edge.
- **Same overall size.** The marker's peak equals the loudest point of the ring, so the print's size
  doesn't change.
- **Tested.** Generated from an existing WAV in `Backend/tmp`, with and without the marker, using the
  app's settings and the default settings. Every result is a closed mesh (each edge is shared by
  exactly 2 faces), and the height range is the same as without the marker.

### Accessibility
- All controls are real `<button>` and radio elements, so they work with the keyboard as-is. Focus
  outlines use the existing `:focus-visible` style. Restart and Deactivate have `aria-label`s that
  start with their visible text, for example "Restart: play the sound and turn the torus from the
  beginning".
- A polite live region (`aria-atomic`) announces only state changes: "Activated", "Playing",
  "Restarted", "Paused", "Deactivated", "Finished". It never announces the running time.
- The time is shown as text, for example `0:12 / 0:45`. It updates on `timeupdate` and is not a live
  region.
- `prefers-reduced-motion: reduce`: the torus doesn't turn. An orange dot moves around the ring
  instead and the front pointer is hidden. The page switches immediately if the setting changes
  while it is open.
- The canvas has `role="img"`, an `aria-label` that changes with the motion setting, and a visible
  `<figcaption>` linked by `aria-describedby`. Arrow keys turn the view (the same OrbitControls as
  Printing Options).
- `[hidden]` is forced to `display: none` on this page, because `Print_options.css` sets
  `button { display: inline-flex }`, which would otherwise override it.

## Assumptions
1. **What "My Sounds" lists:** the app stores one project (`projectstore.js`, key `current`). The
   page lists that project's **trimmed audio** (`trimmedWav`, the sound the print is made from;
   selected by default) and **original audio** (`originalAudio`). Showing more projects would need
   changes to `projectstore.js`.
2. **Torus settings:** the slider values chosen on Printing Options are not saved anywhere, so
   My Sounds uses the Sound-Torus defaults. The on-screen torus is the existing band-and-ridges
   preview, not an exact copy of the printed tube shape.
3. **Start/end position:** the sound starts at angle 0 and ends after one full turn back at the same
   spot, which matches `build_ring_mesh()`.
4. **Activate doesn't auto-play.** Playback starts with Restart, or with the player's own play
   button. Playing or seeking with the player's controls while the mode is active also turns the torus.
5. **"Paused" is announced** when the user pauses during the mode. This wasn't in the requested list,
   but otherwise pausing would be silent.
6. **Navigation:** a link was added to the Printing Options and New Project navs, not the landing page.
   The landing page nav uses `tabindex="1"`–`"5"`, so a new link there would either be reached out of
   order or require renumbering the existing links.

## Not verified / follow-ups
- The page hasn't been clicked through in a browser yet. Module syntax was checked and every file
  loads through the Vite dev server (`200`, and the `three` imports resolve). Things to test by hand:
  activate, restart, play to the end, deactivate, switching sounds, a screen reader, and
  reduced-motion mode.
- `vite.config.js` has no `build.rollupOptions.input`, so `vite build` only includes `index.html`.
  This already affects every existing page, not just My Sounds.
- STLs generated before this change have no start marker. The STL needs to be regenerated on
  Printing Options.

---

# Site redesign (shared layout, sound effects, "Hear the shape")

All pages now share one header, palette and set of fonts from `Frontend/Styling/theme.css`. Each page
is built from the same sections: a dark top band (nav and hero), a wide rounded banner, two columns
of small cards, a row of image cards, a split promo card and a closing call-to-action band.

- `Frontend/Scripts/sound.js`: optional sound effects (Web Audio). They are **off by default** and
  saved in `localStorage`. The audio context is only created after a click.
- `Frontend/Scripts/site.js` is loaded on every page and handles:
  - the sound-effects toggle (`aria-pressed`)
  - a short tap sound on button presses
  - a chime when a status message changes
  - moving focus into main when the skip link is used
- My Sounds:
  - Spatial sound: when sound effects are on, the player goes through a `StereoPannerNode`, so the
    sound moves from the left ear to the right as the playback moves around the torus.
  - Each mode change has its own cue.
  - New "Hear the shape" slider: 16 parts, a high note for loud parts and a low note for quiet ones,
    panned from left to right. The slider's `aria-valuetext` and a visible readout give the same
    information as text.
