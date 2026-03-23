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
├─────────────────────────────────────────────────┤
│  s("bd sd [~ bd] sd").bank("RolandTR808")       │
│                                                  │
└─────────────────────────────────────────────────┘
```

**[▶ Update] Button** — Cycle-Synced Eval:
- **Click**: Queues the current track's code for evaluation at the next cycle boundary
- **Visual states**:
  - 🔵 **Idle** — code matches what's playing
  - 🟡 **Dirty** — code has been edited but not yet queued
  - 🟠 **Queued** — waiting for the next "one"
  - 🟢 **Applied** — brief green flash (200ms) confirming the swap happened
- **Keyboard shortcut**: `Ctrl+Enter` (per-track) or `Ctrl+Shift+Enter` (update ALL dirty tracks)
- **Quantization options** (right-click dropdown on Update button):
  - `1 cycle` (default) — update on next "the one"
  - `2 cycles` — update on next even cycle
  - `4 cycles` — update on next 4-cycle boundary
  - `Immediate` — classic Strudel behavior, swap instantly

**[🔒 Lock] Toggle** — Auto-Update Mode:
- **Off (default)**: Manual mode. User edits code freely, presses Update when ready.
- **On (locked)**: Every code change auto-queues for the next cycle boundary after a 300ms debounce.
- **Visual**: Track border glows with animated pulse.
- **Safety**: If new code throws a parse/eval error, the lock catches it silently — keeps playing the last good pattern, shows error inline.
- **Keyboard shortcut**: `Ctrl+L` (focused track), `Ctrl+Shift+L` (ALL tracks)
- **Lock + Effects Panel**: Knob drags auto-evaluate on the next boundary.

**Global Update Controls** (in transport bar):
- **[⚡ Update All]** — queues ALL dirty tracks for next cycle boundary (`Ctrl+Shift+Enter`)
- **[🔒 Lock All]** — toggles auto-update on every track
- **Quantization selector** — global default for all tracks

### 4.10c 🔀 Reshuffle (AI Pattern Suggestions)

A per-track "inspiration engine" that generates new pattern variations matching the current session context.

**What Reshuffle Knows** (context):
- Track role (drums, bass, lead, pad, etc.)
- Current BPM / CPS
- Active scale/key across all tracks
- Other tracks' content (avoids clashes)
- Template style (if started from a template)
- Complexity level (matches existing pattern)

**Two Engines**:

**Engine 1 — Rule-Based Generator** (instant, no API call):

A library of parameterized pattern templates per role, randomly assembled:

```javascript
const drumPatterns = {
  kicks: [
    's("bd sd bd sd")',
    's("bd ~ bd ~")',
    's("bd*2 ~ bd ~")',
    's("bd [~ bd] sd [bd ~]")',
    's("bd(3,8)")',
  ],
  hats: [
    's("hh*8")',
    's("hh*16").gain("0.8 0.5")',
    's("hh(5,8)")',
    's("[hh oh]*4")',
  ],
};
```

For melodic tracks, the generator picks from note pool constrained by the session scale.

**Engine 2 — AI-Powered Generator** (richer, uses Anthropic API):

Calls the Anthropic API with full session context as system prompt, asking for a single Strudel code pattern matching the role, key, tempo, and style.

**UI — Reshuffle Button & Flow**:

- **[🔀 Shuffle] button**: In each track's header strip
- **Click**: Generates new pattern, replaces track code, does NOT auto-eval. Update button turns 🟡 Dirty.
- **If Lock is ON**: Shuffled code auto-queues for next cycle boundary.
- **Shift+Click**: Generates 3 variations in a quick-pick dropdown.
- **History**: Each shuffle pushes to undo stack. `Ctrl+Z` reverts.
- **AI toggle**: Settings toggle for "Use AI for richer suggestions" (off by default).
- **Keyboard shortcut**: `Ctrl+Shift+R`

**Reshuffle Constraints System**:

Users can pin constraints that reshuffle always respects:
- **Pin notes**: Keep these note values
- **Pin rhythm**: Keep rhythm structure
- **Pin effects**: Only regenerate pattern, not effects
- **Pin sound**: Keep sound/bank, change notes/rhythm

Shown as small 📌 icons next to pinned elements in the code.

### 4.11 🎤 Voice Recorder & Sample Capture (Vox Studio)

A built-in microphone recording feature that lets users capture vocal samples and instantly use them as pattern-manipulable Strudel samples.

**Technical Flow**:
1. `navigator.mediaDevices.getUserMedia({ audio: true })` → acquire mic stream
2. Record into `AudioBuffer` via `MediaRecorder`
3. Convert blob to object URL
4. Register via Strudel's `registerSound()` API under user-chosen name (`vox`, `vox:0`, etc.)
5. Sample is now available: `s("vox")`, `s("vox:0").chop(8)`, etc.

**UI — Recording Panel**:

- **Record button** (big red circle) — real-time waveform display
- **Stop button** → shows captured waveform
- **Waveform editor** — visual trim handles (maps to `.begin()` / `.end()`)
- **Preview button** — plays raw sample
- **Name input** — user names the sample
- **Save to session** — registers and auto-inserts Vox track
- **Sample bank** — multiple recordings: `vox:0`, `vox:1`, `vox:2`

**Strudel Integration** — What users can do with recorded samples:

```javascript
s("vox")                                    // basic playback
s("vox").chop(8).rev()                      // slice and rearrange
s("vox*4").begin(rand).end(rand.add(0.1))   // granular
s("vox").loopAt(2)                          // time-stretch
s("vox").speed("<1 1.5 0.75 2>")            // pitch shift
s("vox").speed(-1)                          // reverse
s("vox").ply("<1 2 4 8>")                   // stutter
s("vox").chop(16).n("0 4 8 12 2 6 10 14")  // slice reorder
```

**Vox Presets** (one-click transformations):

| Preset | Code Generated | Description |
|--------|---------------|-------------|
| **Loop** | `s("vox").loopAt(2)` | Clean loop fitted to 2 cycles |
| **Chop & Shuffle** | `s("vox").chop(8).sometimes(rev)` | Slice into 8, randomly reverse |
| **Stutter** | `s("vox*4").begin(rand).end(rand.add(0.05))` | Granular micro-slicing |
| **Pitch Shift** | `s("vox").speed("<1 1.25 0.75 1.5>")` | Melodic pitch variations |
| **Robot** | `s("vox").coarse(8).shape(0.4)` | Lo-fi robotic voice |
| **Echo** | `s("vox").delay(0.7).delaytime(0.375).delayfeedback(0.6)` | Dub echo |
| **Reverse** | `s("vox").speed(-1).room(0.5)` | Reversed with reverb tail |
| **Glitch** | `s("vox").chop(32).n(rand.range(0,31).segment(8)).fast(2)` | Chaotic slice rearrangement |
| **Beatbox** | `s("vox:0 vox:1 vox:2 vox:3")` | Sequence multiple takes |

**Live Looping Mode** (advanced):
- **Overdub recording**: Quantizes to cycle boundaries
- **Layer stacking**: Each new recording becomes `vox:N`
- **Punch-in**: Re-record a single variant
- **Monitor toggle**: Route mic through Strudel's effects chain in real-time

**Persistence**: IndexedDB blobs, keyed by session. Exported with session JSON as base64.

**Privacy**: Standard `getUserMedia` permissions. Red dot indicator when recording. All processing local.

### 4.12 📊 Visualizer System (Spectrum, Scope, Pianoroll & More)

A comprehensive audio and pattern visualization layer built on Strudel's native visual feedback functions.

**Strudel's Built-In Visualizers**:

Two variants for each:
- **Background mode** (no prefix): renders to page background — `scope()`, `spectrum()`, etc.
- **Inline mode** (`_` prefix): renders inside the code — `_scope()`, `_spectrum()`, etc.

---

**4.12a — Master Visualizer Strip (Transport Bar)**

Always-visible horizontal strip above the transport bar showing master output analysis.

```
┌──────────────────────────────────────────────────────────────────┐
│ [Scope 〰️]  [Spectrum ▊▋▌▍]  [Cycle ◯]  [Level ▌▌▌░░]         │
└──────────────────────────────────────────────────────────────────┘
```

1. **Oscilloscope** (`scope()`): Time-domain waveform, 200px×60px, `align: 1`, `scale: 0.25`
2. **Spectrum Analyzer** (`spectrum()`): 64-bin FFT, log frequency scale, cyan→magenta gradient, peak hold dots, 300px×60px, `smoothingTimeConstant: 0.8`
3. **Cycle Visualizer**: Circular progress sweep synced to scheduler, tick marks at 0.25/0.5/0.75, flashes on boundary (syncs with Live Update)
4. **Master Level Meter**: Stereo VU, green→yellow→red, peak hold

---

**4.12b — Per-Track Inline Visualizers**

Toggle via icons in track header: `[🎹][〰️][▊][🌀]`

| Visualizer | Function | Shows | Best For |
|-----------|----------|-------|----------|
| **Pianoroll** | `_pianoroll()` | Scrolling note blocks | Melodic tracks |
| **Punchcard** | `_punchcard()` | Same + post-effects transforms | Seeing final output |
| **Scope** | `_scope()` | Track waveform | Waveform shape, distortion |
| **Spectrum** | `_spectrum()` | Track FFT | Filter sweeps, frequency content |
| **Spiral** | `_spiral()` | Events on a spiral | Understanding cycle structure |

**Pianoroll as Step Sequencer** (for drums): `vertical: true` + `fold: true` → classic step sequencer grid.

**Config options**: `cycles`, `playhead`, `labels`, `vertical`, `autorange`, `smear`, `fold`, `active`/`inactive` colors.

---

**4.12c — Full-Screen Performance Mode**

Hotkey: `F11`. Code editor shrinks to narrow editable strip at bottom. Rest of screen becomes visualization canvas:
- Combined pianoroll (all tracks, color-coded) OR spiral OR Hydra generative visuals
- Spectrum bars across bottom + scope across top as overlays
- Track activity indicator dots in corners
- Mini-notation highlighting stays active in code strip

---

**4.12d — Mini-Notation Highlighting**

Strudel's built-in feature: active elements within mini-notation strings glow as they play, using each track's assigned color. `.color("cyan magenta")` allows per-note color coding.

---

**4.12e — Visualizer Language Reference**

```javascript
._scope({ align: 1, scale: 0.25, thickness: 3, color: 'cyan' })
._spectrum()
._fscope()
._pianoroll({ cycles: 4, labels: 1, vertical: 0, autorange: 1 })
._punchcard({ fold: 1, smear: 1 })
._spiral({ steady: 0.96, stretch: 1, thickness: 3 })
.color("cyan magenta yellow")
.fft(8)
.analyze()
```

---

**4.12f — Implementation Notes**

- Use `<canvas>` for all real-time visualizers (not SVG)
- Per-track `AnalyserNode` via Strudel's orbit system for track-level scope/spectrum
- Resizable panel heights (draggable)
- "Disable Visualizers" toggle for low-power devices
- Audio must NEVER suffer for visuals

### 4.13 🎛️ MIDI I/O & External Gear Integration

**MIDI Output**:
- Per-track `.midi()` toggle in track header
- Device picker (auto-populated via WebMIDI)
- Channel selector (1–16)
- Program change via `progNum()`
- CC mapping: visual assignment, generates `.control([74, sine.slow(4)])` or `.ccn(74).ccv(value)`
- MIDI Clock: `midicmd("clock*48")` for external sync

**MIDI Input**:
- `midiin()` / `midin()` to receive CC values as continuous signals
- **Learn mode**: Click parameter → move knob → auto-maps CC
- MIDI note input via piano keyboard feature

**OSC Output** (advanced, desktop app only):
- Toggle for SuperDirt routing via OSC

### 4.14 🎮 Physical Input Devices (Gamepad, Motion, Mouse)

**Gamepad**: `const gp = gamepad(0)`. Map buttons to mute/solo/shuffle. Map sticks to continuous parameters: `.lpf(gp.x1.range(200, 4000))`.

**Device Motion** (mobile): `enableMotion()`. Tilt-to-filter: `.lpf(gravityY.range(200, 4000))`. Shake-to-glitch. Rotate-to-pan.

**Mouse Position**: `mouseX`, `mouseY` (0–1 range) as pattern signals.

### 4.15 🔗 Inline Slider Widgets

Strudel's `slider(default, min, max, step)` renders a draggable slider directly inside the code editor. Support this in our CodeMirror setup. Sliders respect Lock mode.

### 4.16 🎵 Advanced Synthesis (FM, Wavetable, Additive, ByteBeat)

**FM Synthesis**: `.fm()`, `.fmh()`, `.fmattack()`, `.fmdecay()`, `.fmenv()`, `.fmrelease()`, `.fmsustain()`, `.fmwave()`

**Wavetable**: `wt_` prefix, 1000+ AKWF wavetables, `.loopBegin()` / `.loopEnd()` for scanning

**Additive**: `.partials([1, 0.5, 0.3])`, `.phases([0, 0, 0.5])`, `sound("user")` for custom timbres

**ByteBeat**: `bbexpr()` for raw bytebeat synthesis

**Noise**: `white`, `pink`, `brown`, `crackle` with `.density()`, `.noise()` on any oscillator

### 4.17 🔄 Sidechain Ducking & Crossfade

**Ducking** (`.duck()`): `.duck(depth)`, `.duckattack()`, `.duckorbit()`. Expose as "Duck by" dropdown.

**Crossfade** (`.xfade()`): Smooth transition on pattern swap. Global toggle in Live Update system.

### 4.18 🌊 Hydra Generative Visuals (Advanced)

`await initHydra()` loads Hydra engine. `H(pattern)` bridges Strudel patterns into Hydra. `detectAudio: true` for audio-reactive visuals. `feedStrudel` transforms Strudel's visualizations with shaders. Expose as a "Visuals" track type.

### 4.19 🎵 Mondo Notation

Newer, more expressive notation extending mini-notation. Available via `mondo\`...\``. Support in editor with syntax highlighting for advanced users.

### 4.20 🌐 Community Sample Packs & GitHub Integration

`samples('github:user/repo')` ecosystem. Curated community tab, custom URL loading, favorites, VCSL instruments, tidal-drum-machines library, `soundAlias()` for custom naming.

### 4.21 ✨ Additional Features (Polish & Delight)

- **Session save/load**: Export full session as JSON. Import to restore.
- **Share**: Shareable URL (base64-encoded session in hash) or copy code to clipboard.
- **Undo/Redo per track**: CodeMirror's built-in history.
- **Pattern visualizer**: Per-track pianoroll/step-sequencer (see Section 4.12).
- **Sample browser**: Searchable panel. Click to insert `s("samplename")`.
- **Dark/light theme** (default dark).
- **Responsive**: Works on tablet (landscape) minimum.
- **Keyboard shortcut overlay**: Hold Cmd/Ctrl to see all shortcuts.

### 4.22 🤖 WebMCP — Browser-Native AI Agent Integration

Strudel Studio exposes its full functionality as **WebMCP tools** via the `navigator.modelContext` browser API. Any browser-based AI agent (Chrome's built-in agent, MCP-B extension, Claude in Chrome, or any future WebMCP-compatible agent) can discover and call these tools directly — no server, no sidecar, no WebSocket bridge. Everything stays client-side.

**Why WebMCP?**

Strudel Studio is 100% client-side: Web Audio API, CodeMirror editor, all state in the browser. There is no backend. WebMCP lets a web page register JavaScript functions as structured tools that browser-based agents can call. The tools execute in the page's JS context with direct access to the Strudel engine, session state, and live audio graph. No serialization, no latency.

The browser mediates between the page and the agent, handling tool discovery, permission prompts, and structured parameter passing. The page is effectively an MCP server implemented entirely in client-side JavaScript.

**Status**: W3C Community Group proposal (Google + Microsoft). Early preview in Chrome 146+ Canary (`chrome://flags/#enable-webmcp-testing`). Polyfill via MCP-B (`@mcp-b/client`). Spec covers tools only (no resources/prompts yet) — knowledge served as tool return values.

---

**4.22a — Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                    BROWSER TAB                                   │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              STRUDEL STUDIO (client-side app)              │  │
│  │                                                            │  │
│  │  Session State ─── Strudel Engine ─── CodeMirror Editor   │  │
│  │       │                  │                    │            │  │
│  │       ▼                  ▼                    ▼            │  │
│  │  ┌──────────────────────────────────────────────────┐     │  │
│  │  │         navigator.modelContext.registerTool()     │     │  │
│  │  │                                                   │     │  │
│  │  │   get_session      update_track    reshuffle      │     │  │
│  │  │   add_track        set_bpm         play / stop    │     │  │
│  │  │   get_reference    get_samples     evaluate_code  │     │  │
│  │  │   mute / solo      get_scales      explain_code   │     │  │
│  │  │                                                   │     │  │
│  │  │   execute() callbacks have DIRECT access to:      │     │  │
│  │  │   • sessionStore    • liveUpdateEngine             │     │  │
│  │  │   • strudelEngine   • reshuffleEngine              │     │  │
│  │  │   • STRUDEL_REFERENCE (compiled docs)             │     │  │
│  │  └──────────────────────────────────────────────────┘     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                    browser mediates                               │
│                              │                                   │
│  ┌───────────────────────────┴───────────────────────────────┐  │
│  │                    AI AGENT                                │  │
│  │  (Chrome built-in agent / MCP-B / Claude in Chrome / etc) │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

No sidecar. No WebSocket. No server. `execute()` callbacks are plain JS functions calling directly into app state.

---

**4.22b — Tool Registration**

All tools registered on app load. Updated via `provideContext()` when session changes.

**Session tools**: `get_session` (read full state), `set_bpm`
**Track tools**: `update_track` (cycle-synced via liveUpdateEngine), `add_track`, `remove_track`, `mute_track`, `solo_track`
**Transport tools**: `play`, `stop`
**Creative tools**: `reshuffle_track` (returns suggestion WITHOUT applying), `evaluate_code` (arbitrary Strudel execution)
**Knowledge tools**: `get_reference` (returns compiled ~15-20KB Strudel language reference), `get_samples` (available sample names), `get_scales_and_chords`, `explain_code`

Each tool uses `navigator.modelContext.registerTool()` with `name`, `description`, `inputSchema` (JSON Schema), and `execute` callback. See full implementation code in the expanded spec.

Key design: `update_track` feeds into the Live Update system — agent code changes queue for the next cycle boundary, same as manual edits. Agent specifies quantization (`"1"`, `"2"`, `"4"`, `"immediate"`).

---

**4.22c — Strudel Knowledge Base**

The `STRUDEL_REFERENCE` constant is compiled from strudel.cc docs at build time. Contains: all function signatures, mini-notation syntax, effects chain, pattern modifiers, signals, tonal functions, sample manipulation, common recipes, common mistakes, code patterns by role. This is what stops agents from hallucinating syntax.

---

**4.22d — Agent Interaction UX**

- 🤖 icon in transport bar (gray = no agent, green = active)
- Agent activity log (collapsible, shows tool calls with timestamps)
- Optional approval mode: `update_track` shows diff with Accept/Reject
- "Ask Agent" button per track: opens browser agent with pre-filled context

---

**4.22e — Polyfill / Fallback**

1. Feature detect: `if ("modelContext" in navigator)`
2. MCP-B polyfill fallback for non-Canary browsers
3. Graceful degradation with tooltip if unavailable
4. When spec stabilizes in stable Chrome/Edge, polyfill becomes unnecessary
5. **Non-browser agents**: CLI agents running outside a browser cannot use WebMCP. If this becomes a need, the same tool implementations could be wrapped in a Streamable HTTP endpoint later — but this is explicitly **out of scope** for Strudel Studio. The product is a browser app; WebMCP is the only agent integration layer.

---

## 5. Strudel Language Reference (for the agent)

### 5.1 Core Functions

```javascript
s("bd sd hh cp")              // play samples by name
sound("sawtooth")             // play synth waveform
note("c3 e3 g3 b3")          // play notes
n("0 2 4 6")                 // play by scale degree

stack(pattern1, pattern2)     // play simultaneously
cat(pattern1, pattern2)       // play in sequence

setcps(0.5)                   // cycles per second (0.5 = 120 BPM at 4/4)
hush()                        // stop all sound
```

### 5.2 Mini-Notation

```
"a b c d"       → 4 events per cycle
"a*3"           → repeat 3 times
"[a b]/2"       → spread over 2 cycles
"<a b c>"       → one per cycle
"[a b] c"       → a,b share time of one event
"~"             → rest
"a,b"           → simultaneous
"a@2 b"         → a takes 2x time weight
"a!3"           → repeat 3x same time division
"a?"            → randomly play or rest
"a(3,8)"        → euclidean rhythm
"a:2"           → sample variant
```

### 5.3 Effects Chain (signal-flow order)

```javascript
.gain(0.8)            .attack(0.01)         .decay(0.1)
.sustain(0.5)         .release(0.2)
.lpf(800)             .lpq(5)               .lpenv(4)
.lpa(0.1)             .lpd(0.1)             .lps(0.5)            .lpr(0.2)
.hpf(200)             .hpq(3)               .hpenv(4)
.bandpass(1000)       .vowel("a e i o u")
.coarse(8)            .crush(4)
.shape(0.5)           .distort(2)
.phaser(4)            .pan(0.5)
.delay(0.5)           .delaytime(0.25)      .delayfeedback(0.5)
.room(0.5)            .size(2)
.fm(4)                .fmh(2)               .fmenv(4)            .fmdecay(0.3)
.tremolo(4)           .duck(0.8)            .duckattack(0.01)
.orbit(1)
```

### 5.4 Pattern Modifiers

```javascript
.fast(2)              .slow(2)              .rev()
.jux(rev)             .every(4, fast(2))    .sometimes(rev)
.rarely(fast(2))      .struct("x ~ x ~")   .mask("1 0 1 1")
.ply(2)               .off(0.125, add(note(7)))
.chunk(4, fast(2))    .early(0.25)          .late(0.125)
.iter(4)              .xfade()

// Sample manipulation
.chop(8)              .slice(8, "0 3 2 1")  .splice(8, "0 3 2 1")
.fit()                .loopAt(2)            .speed(1.5)
.begin(0.25)          .end(0.75)            .cut(1)
.clip(0.5)            .euclid(3, 8)
```

### 5.5 Signals

```javascript
sine    saw    square    tri    perlin    rand
irand(8)    brand    brandBy(0.3)
sine2   saw2   cosine2   tri2   square2   rand2  // bipolar -1 to 1

mouseX    mouseY                           // mouse position 0-1
gp.x1    gp.a    gp.lt                    // gamepad (after gamepad(0))
gravityX  gravityY  rotationAlpha          // device motion (after enableMotion())
slider(500, 100, 2000, 1)                  // inline draggable slider

.lpf(sine.range(200, 4000).slow(8))
.gain(perlin.range(0.3, 0.9))
```

### 5.6 Tonal

```javascript
.scale("C4:minor")
.chord("<Cm7 Fm7 G7>")
.voicing()
```

### 5.7 Sample Banks

Default bank: `bd`, `sd`, `hh`, `oh`, `cp`, `rim`, `rd`, `tom`, `cy`, `sh`, `cb`, `tb`, `perc`, `misc`, `fx`

Drum machines: `RolandTR808`, `RolandTR909`, and many more via `tidal-drum-machines`

Community packs: `samples('github:user/repo')`

VCSL instruments loaded by default.

---

## 6. UX Requirements

### 6.1 First-Run Experience

1. Splash screen: "Welcome to Strudel Studio"
2. Two options: **"Start with a Template"** or **"Learn from Scratch"**
3. Template auto-plays immediately. Music in under 5 seconds.
4. Pulsing highlight: "Try changing a number!"

### 6.2 The 5-Second Rule

New users hear sound within 5 seconds. Templates auto-play. Learning path Level 1 pre-fills `s("bd")`.

### 6.3 Progressive Disclosure

- **Beginner mode** (default): Tracks, editor, transport, learning panel. Effects and advanced docs collapsed.
- **Producer mode**: Full UI. Auto-upgrades as learning levels complete, or manual toggle.

### 6.4 Always Recoverable

- Undo (Ctrl+Z), `hush()`/Stop always works
- Errors keep last good pattern playing, show inline error
- "Reset track" restores role default

---

## 7. Design Language

- **Palette**: Deep dark (#0a0a0f), neon track colors (drums: orange, bass: cyan, lead: magenta, pad: purple, arp: green, fx: yellow)
- **Typography**: JetBrains Mono / Fira Code (code), Inter (UI)
- **Aesthetic**: Minimal, functional, retro-futuristic. Ableton meets terminal.
- **Animations**: Subtle — cycle pulse, note highlights, knob rotation. Never distract from code.

---

## 8. Implementation Priority

### Phase 1 — MVP (get sound working)
1. Strudel engine integration (`@strudel/web` + `initStrudel()`)
2. Single code editor pane with Play/Stop
3. Basic syntax highlighting for Strudel
4. Transport bar with BPM control
5. 3 working templates (Techno, Lo-Fi, Minimal)

### Phase 2 — Multi-Track
6. Multi-track model with stack() composition
7. Track sidebar with mute/solo/volume
8. Role-based presets (Drums, Bass, Lead, Pad)
9. Per-track code panes

### Phase 3 — Intelligence
10. Autocomplete engine (function names, sample names, scale names)
11. Cheatsheet overlay
12. Context-aware docs panel
13. Auto-suggestions system
14. Error handling with graceful degradation

### Phase 4 — Visual Controls & Voice
15. Effects panel with bidirectional code sync
16. Piano keyboard with note insertion
17. Voice Recorder (mic capture, waveform trim, registerSound integration)
18. Vox presets (one-click transformations for recorded samples)
19. Master visualizer strip (scope + spectrum + cycle + level meter)
20. Per-track inline visualizers (pianoroll, scope, spectrum, spiral toggles)
21. Pattern visualizer — pianoroll-as-step-sequencer for drum tracks

### Phase 5 — Learning, Performance & Polish
22. Gamified learning path (Levels 1–3 first, then expand)
23. Live looping mode (overdub, layer stacking, monitor)
24. Full-screen performance visualizer mode
25. Session save/load/share (including recorded samples via IndexedDB + base64 export)
26. Sample browser with community GitHub packs
27. Progressive disclosure (beginner → producer mode)
28. Remaining templates

### Phase 6 — External Integration & Advanced
29. MIDI output per track (device picker, channel selector, CC mapping)
30. MIDI input & learn mode (hardware knobs → Strudel parameters)
31. Inline slider widgets (`slider()` function in CodeMirror)
32. Gamepad input mapping UI
33. Device motion mapping (mobile accelerometer/gyroscope)
34. FM Synthesis, Wavetable, and Additive synthesis controls in effects panel
35. Sidechain ducking routing UI
36. Crossfade on pattern swap option
37. Hydra generative visuals track type
38. Mondo notation support in editor
39. Sample alias system and community pack browser

### Phase 7 — WebMCP Agent Integration
40. Feature-detect `navigator.modelContext` and register core tools
41. Session tools: get_session, set_bpm
42. Track tools: update_track, add_track, remove_track, mute/solo (execute callbacks call directly into sessionStore and liveUpdateEngine)
43. Transport tools: play, stop
44. Creative tools: reshuffle_track, evaluate_code
45. Knowledge tools: get_reference (returns compiled Strudel docs), get_samples, get_scales_and_chords
46. Build script: crawl strudel.cc docs → compile STRUDEL_REFERENCE constant
47. Agent activity log UI (collapsible panel showing tool calls)
48. Optional approval mode for update_track (diff view)
49. MCP-B polyfill fallback detection

---

## 9. Non-Functional Requirements

- **Performance**: Audio must never glitch. UI rendering secondary to audio scheduling. Use Web Workers for heavy UI.
- **Offline**: Should work offline after first load (Strudel supports PWA). Cache templates and sample banks. The entire app is client-side — no server dependency.
- **Zero backend**: The app requires no server infrastructure. Audio engine, state management, code editing, WebMCP tool registration — all run in the browser. This is a deliberate architectural choice that enables instant deployment (static hosting), offline use, and WebMCP integration (the page itself is the MCP server).
- **Browser support**: Chrome and Firefox latest. Safari should work but is not primary target.
- **Bundle size**: Initial load under 2MB. Lazy-load sample banks.

---

## 10. What Success Looks Like

A first-time user with zero coding experience opens Strudel Studio, picks the "Techno" template, hears a beat immediately, changes `bd` to `bd*2`, hears the kick double, grins, opens the effects panel, drags the filter cutoff down, hears the bass get muffled, and thinks: "I'm making music with code." They come back the next day to try Level 2 of the learning path.

A live coding performer opens Strudel Studio, loads a Blank Session, rapidly builds 6 tracks from scratch, records a vocal sample, chops it into a glitchy rhythmic element with `.chop(16).sometimes(rev)`, uses keyboard shortcuts to mute/solo/transform patterns in real-time, and performs a 30-minute set — all from this single browser tab.

A producer opens Strudel Studio in Chrome, enables the browser's AI agent, and says "build me a dark minimal techno set in D minor at 130 BPM." The agent discovers the WebMCP tools registered on the page, calls `get_reference` to learn Strudel syntax, creates 5 tracks via `add_track`, and presses play — all without leaving the browser tab. Then they collaborate in real-time: "make the bass dirtier", "shuffle the hi-hats" — the agent calls `update_track` and code lands on the next beat. Zero servers. Zero setup. The page IS the MCP server.

**All three users are equally well-served.**
