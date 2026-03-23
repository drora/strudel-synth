# Strudel Studio — Product Spec & Build Prompt

> **Purpose**: This document is a complete product definition and build prompt for an AI coding agent. It specifies a browser-based music production environment built on top of [Strudel](https://strudel.cc), the JavaScript port of TidalCycles. The goal: make live-coded music accessible to everyone — from zero-experience beginners to seasoned algorave performers — while preserving the full power of Strudel's pattern language.

---

## 1. Product Vision

**Strudel Studio** is an opinionated, guided music creation environment that wraps Strudel's live coding engine in a production-grade UI. It removes the blank-canvas intimidation of a raw REPL by providing role-based tracks, visual controls, intelligent code assistance, genre templates, and a gamified learning path — all while keeping the code front-and-center as the source of truth.

**Core philosophy**: The code IS the instrument. Every UI control writes or modifies Strudel code. Users always see what's happening under the hood, so every interaction teaches them the language.

---

## 2. Technical Foundation

### 2.1 Strudel Integration

Use the `@strudel/web` package for maximum control over the audio engine without being locked into the built-in CodeMirror REPL UI:

```html
<script src="https://unpkg.com/@strudel/web@1.0.3"></script>
```

This gives access to all Strudel globals (`note()`, `s()`, `sound()`, `stack()`, `setcps()`, `hush()`, etc.) after calling `initStrudel()`.

**Key packages/APIs to leverage**:
- `@strudel/core` — Pattern engine, `queryArc`, event scheduling
- `@strudel/web` — Batteries-included browser bundle (`initStrudel()`, all globals)
- `@strudel/repl` — If you need the `StrudelMirror` CodeMirror integration (`.editor` property exposes `setCode()`, `start()`, `stop()`, `evaluate()`)
- `@strudel/mini` — Mini-notation PEG parser
- `@strudel/tonal` — Scales, chords, voicings

### 2.2 Tech Stack

- **Framework**: React (Vite) or plain HTML+JS — agent's choice based on complexity
- **Code Editor**: CodeMirror 6 (matches Strudel's own editor; critical for syntax extensions)
- **Audio**: Strudel's built-in superdough engine (Web Audio API under the hood)
- **State Management**: Zustand or React context — keep it simple
- **Styling**: Tailwind CSS with a dark-mode-first design (music production aesthetic)
- **No backend required**: Entire app is client-side (Web Audio, CodeMirror, WebMCP). Static hosting only.
- **License**: Must be AGPL-3.0-or-later compatible (Strudel's license requirement)

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────┐
│                   STRUDEL STUDIO                     │
├──────────┬──────────────────────────┬───────────────┤
│          │                          │               │
│  SIDEBAR │     CODE EDITOR          │  RIGHT PANEL  │
│          │     (CodeMirror 6)       │               │
│ - Tracks │                          │ - Effects     │
│ - Presets│  [per-track code panes   │ - Docs/Help   │
│ - Templ. │   stacked vertically     │ - Cheatsheet  │
│ - Learn  │   or tabbed]             │ - Piano Keys  │
│          │                          │               │
├──────────┴──────────────────────────┴───────────────┤
│              TRANSPORT BAR                           │
│  [▶ Play] [⏹ Stop] [BPM: 120] [Cycle viz] [Master] │
└─────────────────────────────────────────────────────┘
```

### 3.1 Multi-Track Model

The core UI metaphor is a **multi-track session** where each track is a named Strudel code block. Tracks are `stack()`-ed together behind the scenes. This is the key abstraction that makes Strudel feel like a DAW.

```javascript
// Internal: what the engine actually evaluates
setcps(0.5)
stack(
  /* DRUMS */   s("bd sd [~ bd] sd").bank("RolandTR808"),
  /* BASS */    note("c2 ~ c2 ~ eb2 ~ g1 ~").sound("sawtooth").lpf(400),
  /* LEAD */    note("<c4 eb4 g4 bb4>*2").sound("square").room(0.3),
  /* PAD */     note("[c3,eb3,g3]").sound("sine").room(0.8).gain(0.3)
)
```

Each track has:
- A **name** and **role** (drums, bass, lead, pad, fx, vocals, custom)
- Its own **code pane** (editable CodeMirror instance)
- A **mute/solo/volume** strip
- A **color** for visual identification
- Track code is independently editable; the engine recompiles the full `stack()` on each eval (Ctrl+Enter)

---

## 4. Feature Specifications

### 4.1 🎹 Smart Code Editor

**Engine**: CodeMirror 6 with custom extensions.

**Syntax Highlighting**:
- Strudel-aware highlighting: mini-notation strings (in double quotes) get special treatment
  - Notes (`c4`, `eb3`, `g#5`) → pitch color
  - Rests (`~`) → muted/gray
  - Operators (`*`, `/`, `<>`, `[]`, `,`, `@`, `!`, `?`) → operator color
  - Sample names (`bd`, `sd`, `hh`) → sample color
- JavaScript syntax for everything outside mini-notation
- Method chains (`.lpf()`, `.room()`, `.gain()`) → effect color category

**Intellisense & Code Completion**:
- Autocomplete for ALL Strudel functions, triggered on `.` after a pattern:
  - Sound functions: `s()`, `sound()`, `note()`, `n()`
  - Effects: `.lpf()`, `.hpf()`, `.delay()`, `.room()`, `.gain()`, `.pan()`, `.shape()`, `.distort()`, `.phaser()`, `.vowel()`, `.crush()`, `.coarse()`
  - Pattern modifiers: `.fast()`, `.slow()`, `.rev()`, `.jux()`, `.every()`, `.sometimes()`, `.rarely()`, `.struct()`, `.mask()`, `.ply()`
  - Time: `.early()`, `.late()`, `.off()`
  - Tonal: `.scale()`, `.chord()`, `.voicing()`
  - Accumulation: `stack()`, `cat()`, `sequence()`, `fastcat()`
  - Signals: `sine`, `saw`, `square`, `tri`, `perlin`, `rand`
- Each completion shows: **function signature**, **short description**, **mini inline example**
- Autocomplete for sample names within `s()` and `.bank()` (e.g., `RolandTR808`, `RolandTR909`)
- Autocomplete for scale names within `.scale()` (e.g., `minor`, `major`, `dorian`, `phrygian`, `pentatonic`)
- Autocomplete for note names within `note()` strings

**Auto-Suggestions** (ghost text / inline hints):
- When user types `s("bd `, suggest common next sounds: `sd`, `hh`, `cp`
- When user types `.lpf(`, suggest sensible default: `800`
- When user types `note("c3 `, suggest scale-aware next notes
- Context-aware: if track role is "drums", suggest drum patterns; if "bass", suggest bass notes

**Error Handling**:
- Catch eval errors gracefully — show inline red underline + tooltip, don't crash audio
- Warn on common mistakes: unmatched brackets in mini-notation, missing closing quotes

### 4.2 🥁 Role-Based Track Presets

When creating a new track, the user picks a **role**. Each role comes with:

| Role | Default Sound | Default Pattern | Default Effects | Suggested Scale |
|------|--------------|----------------|----------------|----------------|
| **Drums** | `s("bd sd [~ bd] sd").bank("RolandTR808")` | 4/4 kick-snare | none | N/A |
| **Hi-Hats** | `s("hh*8").gain(0.3).bank("RolandTR808")` | 8th note hats | `.gain(0.3)` | N/A |
| **Bass** | `note("c2 ~ c2 ~ eb2 ~ g1 ~").sound("sawtooth")` | synth bass | `.lpf(500).lpq(3)` | root notes |
| **Lead** | `note("<c4 eb4 g4 bb4>*2").sound("square")` | melodic sequence | `.room(0.3).delay(0.2)` | scale degrees |
| **Pad** | `note("[c3,eb3,g3]").sound("sine")` | sustained chords | `.room(0.8).gain(0.3)` | chord voicings |
| **Arp** | `note("<c3 eb3 g3 bb3>*8").sound("triangle")` | arpeggiated | `.delay(0.5).delaytime(0.125)` | scale run |
| **FX/Perc** | `s("cp rim").bank("RolandTR808")` | accents | `.room(0.5).pan(sine)` | N/A |
| **Vox** | `s("vox").loopAt(2)` | recorded sample loop | `.room(0.3).lpf(4000)` | N/A |
| **Custom** | empty | user writes from scratch | none | none |

Each role also sets the **track color** and **icon** in the sidebar.

### 4.3 🎨 Effects Panel (Right Panel)

A visual control surface that reads AND writes Strudel code. Every knob/slider change updates the code; every code change updates the knobs.

**Layout**: Vertical list of collapsible effect sections per selected track:

- **Filter** — `lpf` (knob: 20–20000 Hz, log scale), `hpf` (same), `lpq`/`hpq` (resonance: 0–20), `vowel` (dropdown: a e i o u), `bandpass`
  - **Filter Envelope sub-section**: `lpenv` (depth: 0–10), `lpa` (attack), `lpd` (decay), `lps` (sustain), `lpr` (release) — same for `hp` variants
- **Amplitude** — `gain` (0–1.5), `attack`/`decay`/`sustain`/`release` (ADSR sliders)
- **Space** — `room` (reverb: 0–2), `size` (0–10), `delay` (0–1), `delaytime` (0–1), `delayfeedback` (0–1)
- **Distortion** — `shape` (waveshape: 0–1), `distort` (0–10), `crush` (bitcrush: 1–16), `coarse` (sample rate: 1–32)
- **Modulation** — `phaser` (0–10), `tremolo` (0–10), `pan` (dropdown: static value, `sine`, `rand`, `mouseX`)
- **FM Synthesis** — `fm` (modulation index: 0–20), `fmh` (harmonicity: 0.01–16), `fmenv` (envelope depth: 0–10), `fmdecay` (0–2)
- **Pattern** — `speed` (playback rate: -2 to 4), `begin`/`end` (sample trim: 0–1)
- **Routing** — `orbit` (bus: 0–8), `duck` (sidechain depth: 0–1), `duckattack` (0–0.5), "Duck by" dropdown (select trigger track)

**Bidirectional sync**: If the user types `.lpf(800)` in code, the filter knob snaps to 800. If they drag the knob to 1200, the code updates to `.lpf(1200)`. For pattern-driven values like `.lpf(sine.range(200,2000))`, show an animated knob + a "pattern mode" toggle.

### 4.4 📚 Documentation Panel

A searchable, context-aware docs panel in the right sidebar (tabbed with Effects).

**Content** (sourced from strudel.cc, reformatted for quick reference):

- **Function Reference**: Every Strudel function with signature, description, runnable example
- **Mini-Notation Guide**: All operators (`*`, `/`, `[]`, `<>`, `,`, `~`, `@`, `!`, `?`, `()`, `{}`) with visual diagrams
- **Samples Browser**: Searchable list of all available sample banks and their sounds
- **Scales & Chords**: List of all scale names and chord types available in `@strudel/tonal`
- **Signal Reference**: `sine`, `saw`, `square`, `tri`, `perlin`, `rand` — with visual waveform previews

**Context awareness**: When the cursor is on `.lpf(`, the docs panel auto-scrolls to the `lpf` entry. Clicking an example pastes it into the active track.

### 4.5 📋 Cheatsheet (Floating / Toggleable)

A single-screen quick reference card, always one keypress away (hotkey: `?` or `Cmd+/`):

```
╔══════════════════════════════════════════════════╗
║  STRUDEL STUDIO CHEATSHEET                       ║
╠══════════════════════════════════════════════════╣
║  MINI-NOTATION                                   ║
║  "a b c d"     → sequence (fit in 1 cycle)       ║
║  "a*3"         → repeat 3x                       ║
║  "[a b]/2"     → play over 2 cycles              ║
║  "<a b c>"     → one per cycle                   ║
║  "[a b] c"     → subdivide time                  ║
║  "~"           → rest / silence                  ║
║  "a,b"         → play simultaneously             ║
║  "a@2 b"       → 'a' takes 2x the time           ║
║  "a!3"         → repeat without subdivision       ║
║  "a?"          → randomly include/exclude         ║
║  "a(3,8)"      → euclidean rhythm                ║
╠══════════════════════════════════════════════════╣
║  SOUNDS          EFFECTS          PATTERNS       ║
║  s("bd sd")      .lpf(800)        .fast(2)       ║
║  note("c3 e3")   .hpf(200)        .slow(2)       ║
║  sound("saw")    .room(0.5)        .rev()         ║
║  .bank("TR808")  .delay(0.3)       .jux(rev)      ║
║                  .gain(0.8)        .every(4,fast(2))║
║                  .shape(0.5)       .sometimes(rev) ║
║                  .pan(sine)        .struct("x ~ x")║
╠══════════════════════════════════════════════════╣
║  KEYBOARD                                        ║
║  Ctrl+Enter      → update track (on the one)      ║
║  Ctrl+Shift+Enter→ update ALL tracks (on the one)  ║
║  Ctrl+.          → stop all sound                  ║
║  Ctrl+L          → toggle Lock (auto-update)       ║
║  Ctrl+Shift+L    → toggle Lock ALL tracks          ║
║  Ctrl+Shift+R    → reshuffle focused track         ║
║  Ctrl+Shift+M    → mute/unmute track               ║
║  Ctrl+Shift+S    → solo track                      ║
║  Ctrl+Z          → undo (reverts shuffles too)     ║
╚══════════════════════════════════════════════════╝
```

### 4.6 🎼 Genre Templates

Pre-built, fully-functional multi-track sessions the user can load and immediately modify. Each template should sound good out of the box and demonstrate a range of Strudel techniques.

**Required Templates** (minimum viable set):

1. **Techno** — 4/4 kick, offbeat hats, acid bassline (`.lpf(sine.range(200,2000))`), atmospheric pad, percussive FX
2. **House** — Disco-influenced kick pattern, clap on 2&4, chord stabs, walking bass, shaker
3. **Hip Hop** — Boom bap drums with swing, sub bass, melodic sample chop, hi-hat rolls
4. **Ambient** — Long evolving pads, granular textures (`.speed(0.5).begin(rand)`), sparse melodic motifs, field recording feel
5. **Drum & Bass** — Fast breakbeat pattern (170 BPM), rolling bass (`.note("c1 ~ c1 ~ [c1 eb1] ~").fast(2)`), atmospheric pads
6. **Lo-Fi** — Vinyl crackle (noise channel), muted piano chords (`.lpf(800)`), lazy drums, tape wobble
7. **Synthwave** — Arpeggiated synths, gated reverb snare, driving bass, lush pads
8. **Minimal** — Stripped-back: just kick, one perc element, one evolving melodic line, maximum pattern manipulation
9. **Dub** — Heavy bass, echo-drenched snare (`.delay(0.7).delaytime(0.375)`), sparse melodic hits, spring reverb
10. **Blank Session** — Empty 4-track (drums, bass, lead, pad) with sensible defaults, ready for user creativity

Each template must include **inline comments** explaining what each line does, making them serve double duty as learning material.

### 4.7 🎮 Gamified Learning Path

A progressive curriculum that teaches Strudel through increasingly complex **challenges** organized into levels.

**Structure**:

```
LEVEL 1: "First Sound" (3 challenges)
  1.1  Press play on s("bd") — learn what a sound is
  1.2  Make a beat: s("bd sd bd sd") — learn sequences
  1.3  Add hi-hats: stack two patterns — learn stack()

LEVEL 2: "Rhythm" (4 challenges)
  2.1  Use * to speed up: s("hh*8") — learn multiplication
  2.2  Use [] to subdivide: s("bd [sd sd] bd sd")
  2.3  Use ~ for rests: s("bd ~ sd ~")
  2.4  Euclidean rhythms: s("bd(3,8)")

LEVEL 3: "Melody" (4 challenges)
  3.1  Play notes: note("c3 e3 g3 b3")
  3.2  Use < > for one-per-cycle: note("<c3 e3 g3>")
  3.3  Choose a sound: note("...").sound("sawtooth")
  3.4  Use a scale: n("0 2 4 6").scale("C:minor")

LEVEL 4: "Effects" (4 challenges)
  4.1  Add a filter: .lpf(800)
  4.2  Add reverb: .room(0.5)
  4.3  Add delay: .delay(0.3).delaytime(0.25)
  4.4  Combine effects chain

LEVEL 5: "Pattern Power" (4 challenges)
  5.1  .fast(2) and .slow(2)
  5.2  .rev() and .jux(rev)
  5.3  .every(4, fast(2)) — conditional transforms
  5.4  .sometimes(rev) — randomness

LEVEL 6: "Live Performance" (4 challenges)
  6.1  Use the Update button to change a pattern on the one
  6.2  Enable Lock mode: edit code and hear changes land on each cycle
  6.3  Build a drop: mute tracks, edit, unmute on the one
  6.4  Use signals for automation: .lpf(sine.range(200,4000).slow(8))

LEVEL 6b: "Reshuffle & Flow" (3 challenges)
  6b.1 Use Shuffle to generate a new drum pattern, then Update
  6b.2 Pin your effects, shuffle only the notes
  6b.3 Lock + Shuffle: rapid-fire variations in a live jam

LEVEL 7: "Your Voice" (3 challenges)
  7.1  Record a sample and play it back with s("vox")
  7.2  Chop your voice: s("vox").chop(8) — learn slicing
  7.3  Build a vocal loop with effects and layering

LEVEL 8: "Producer Mode" (3 challenges)
  8.1  Build a complete 4-track song from scratch
  8.2  Use the effects panel + code together
  8.3  Create and save your own template
```

**Challenge UI**:
- Left pane: instruction text + goal description ("Make the hi-hats play 8 times per cycle")
- Center: code editor pre-filled with starter code
- Right: a "target" audio preview the user can listen to (optional — or just text description)
- **Validation**: Compare user's evaluated pattern output against expected pattern (or just check that specific functions/values are present in the code)
- **Rewards**: XP bar, level badges, streak counter for daily practice
- **Progress persistence**: Save to localStorage (or your storage API)

### 4.8 🎹 Piano Keyboard (Note Input Helper)

A visual piano keyboard displayed below or beside the code editor when a melodic track is selected.

**Behavior**:
- Shows 2 octaves of keys (C2–C4 adjustable via octave shift buttons)
- Keys are labeled with note names AND the Strudel notation (`c3`, `d#3`, etc.)
- **Click a key** → inserts that note name at the cursor position in the code editor
- **Hold Shift + click multiple keys** → inserts them as a chord `[c3,e3,g3]`
- **Highlight active notes**: While the pattern plays, light up keys that are currently sounding (reads from Strudel's event output)
- **Scale overlay**: When a `.scale()` is active on the track, highlight only the in-scale keys and dim the others
- **Computer keyboard mapping**: Map QWERTY rows to piano keys (Z=C, S=C#, X=D, D=D#, C=E, V=F, etc.) so users can "play" notes in real-time and have them recorded into the pattern

### 4.9 💡 Smart Auto-Suggestions

Beyond basic autocomplete, provide contextual "what to try next" suggestions:

- **Empty track**: "Try starting with `s('bd sd bd sd')` for drums or `note('c3 e3 g3')` for melody"
- **Plain pattern, no effects**: Floating hint: "💡 Add some flavor — try `.room(0.5)` for reverb or `.lpf(800)` for warmth"
- **Single track playing**: "💡 Add another track to thicken your sound"
- **After 2 minutes of no edits**: "💡 Try `.every(4, fast(2))` to add variation"
- **Pattern getting complex**: "💡 Extract this into a `const` variable for readability"

These appear as dismissible, non-intrusive tooltip banners below the affected track. Never block the code.

### 4.10 🔊 Transport & Global Controls

**Transport Bar** (always visible, bottom of screen):

- **Play / Stop** buttons (also Ctrl+Enter / Ctrl+.)
- **BPM control**: Numeric input + drag, maps to `setcps(bpm/60/4)` — show both BPM and CPS
- **Master gain**: Overall volume slider
- **Cycle visualizer**: A circular or linear animation showing the current position within the cycle — synced to Strudel's scheduler. This is CRITICAL for the live update system — users need to SEE where "the one" is.
- **Scope / Spectrum toggle**: Inline oscilloscope and FFT visualizer (Strudel has built-in `_scope()` and `_spectrum()` — expose these globally)

### 4.10b ⚡ Live Update System (Cycle-Synced Hot Swap)

This is the core live performance mechanic. Code changes take effect **on the next cycle boundary ("the one")** — never mid-pattern. The result: edits always land musically, never create rhythmic glitches, and the performer stays in flow.

**How Strudel's Scheduler Works (context for the agent)**:

Strudel's scheduler continuously queries the active `Pattern` object in small time slices (using the "Tale of Two Clocks" Web Audio scheduling technique). Time is measured in **cycles** (fractional floats: 0.0, 0.5, 1.0, 1.5, 2.0...). When you call `evaluate()`, the pattern reference is swapped immediately — the next scheduler tick uses the new pattern. This means a raw eval can land mid-cycle, breaking rhythm.

**The solution**: Instead of swapping immediately, we **defer** the pattern swap to the next integer cycle boundary.

**Implementation Architecture**:

```javascript
// Pseudocode for the cycle-synced eval system
class LiveUpdateEngine {
  pendingCode = null;      // queued code waiting for cycle boundary
  isLocked = false;        // auto-update mode
  debounceTimer = null;

  // Get current cycle position from Strudel's scheduler
  getCurrentCycle() {
    return scheduler.now(); // returns float, e.g., 3.72
  }

  // Queue code for next cycle boundary
  queueUpdate(trackId, newCode) {
    this.pendingCode = { trackId, code: newCode };
    this.updateStatus('pending'); // UI: show "queued" indicator
  }

  // Called on every scheduler tick
  onTick() {
    if (!this.pendingCode) return;
    const cycle = this.getCurrentCycle();
    const fractional = cycle % 1;
    if (fractional < 0.05) {
      this.applyPendingCode();
    }
  }

  applyPendingCode() {
    const { trackId, code } = this.pendingCode;
    this.pendingCode = null;
    recompileTrack(trackId, code);
    this.flashConfirmation(trackId); // UI: brief green flash
  }

  // Auto-update mode: debounce keystrokes, queue on idle
  onCodeChange(trackId, newCode) {
    if (!this.isLocked) return;
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.queueUpdate(trackId, newCode);
    }, 300);
  }
}
```

**UI — Per-Track Update Controls**:

Each track's header strip gets these controls alongside mute/solo:

```
┌─────────────────────────────────────────────────┐
│ 🥁 DRUMS  [▶ Update] [🔒 Lock] [🔀 Shuffle]    │
│           [M] [S] [Vol ████░░]                   │
├──────────