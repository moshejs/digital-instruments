# Moshe's Digital Instruments

![Moshe's Digital Instruments — a chrome steelpan and a glowing theremin waveform](public/og/home.png)

Real instruments, synthesized note by note in your browser. No samples, no installs, no plugins — just the Web Audio API.

**▶ Play now: [moshejs.github.io/digital-instruments](https://moshejs.github.io/digital-instruments/)**

| | |
|---|---|
| [![Steelpan](public/og/steelpan.png)](https://moshejs.github.io/digital-instruments/steelpan/) | [![Aetherwave theremin](public/og/theremin.png)](https://moshejs.github.io/digital-instruments/theremin/) |
| **[No. 01 — Steelpan](https://moshejs.github.io/digital-instruments/steelpan/)**<br>A Caribbean tenor pan with 25 hammered chrome pads in the authentic circle-of-fifths layout. Strike with a click, a tap, or a piano-style keyboard. | **[No. 02 — Aetherwave (theremin)](https://moshejs.github.io/digital-instruments/theremin/)**<br>The instrument you play without touching. Hover for pitch and volume — or on a phone, roll, tilt and shake it through the air. |

## Features

**Both instruments**
- 🎵 **Nine-song songbook** — Twinkle Twinkle, Mary Had a Little Lamb, Ode to Joy, When the Saints Go Marching In, Amazing Grace, Oh! Susanna, Greensleeves, Scarborough Fair and Londonderry Air (Danny Boy). All public domain.
- ▶ **Listen** — the instrument plays the tune for you.
- ◎ **Play Along** — a guide that lights the way, with a scrolling note strip, lyrics/solfège and progress.
- 🔗 **Deep links** — `?song=amazing-grace` opens an instrument with a song ready to go.

**Steelpan**
- Additive synthesis: seven partials, including a hand-detuned octave and twelfth, over a band-passed noise strike, with plate reverb and a gentle tremolo.
- Keyboard: `Z S X D C V G B H N J M` for the lower octave, `Q 2 W 3 E R 5 T 6 Y 7 U I` for the upper — like a piano. `Space` plays/stops, `Esc` stops.
- Guide mode only advances on the right pad; wrong pads shake.
- Stage (dark) and Daylight (light) themes, remembered between visits.

**Theremin**
- Two oscillators crossfaded for timbre, a vibrato LFO, portamento glide, and a live oscilloscope of the real output.
- Voice rack: glide, vibrato rate & depth, timbre, reverb, and optional scale assist (chromatic / C major / pentatonic).
- **Motion control on phones:** roll for pitch (gyroscope), tilt for volume, shake for vibrato (accelerometer). Tap the field to recenter.
- Play Along sweeps a target band across the field and scores how long you stay on pitch.

## The songbook

Every melody was transcribed, then independently re-derived note by note by a second pass that corrected errors before they shipped — for example, restoring Scarborough Fair's raised-sixth Dorian mode and removing a spurious repeated phrase from When the Saints. The test suite checks that every note of every song exists on both instruments.

## Development

Requires Node.js 22.12 or newer (`.nvmrc` pins 24).

```bash
npm install
npm run dev        # http://localhost:4321/digital-instruments/
npm run check      # strict TypeScript + Astro diagnostics
npm test           # Vitest unit tests
npm run build      # static site in dist/
npm run icons      # regenerate favicons, app icons and social cards
```

### Project layout

```
src/
  data/        songs.ts (the shared songbook) · instruments.ts (metadata, structured data)
  lib/         music.ts (note math, scales) · steelpan-layout.ts · theremin-field.ts · audio.ts · site.ts
  scripts/     steelpan.ts · theremin.ts · shared/song-ui.ts (library + note strip)
  layouts/     Base.astro — SEO, Open Graph, Twitter cards, JSON-LD, icons
  pages/       index · steelpan · theremin · 404
  styles/      per-instrument CSS
scripts/       generate-images.mjs — renders every icon and OG card from SVG with sharp
tests/         music + instrument/songbook tests
```

### SEO and sharing

Per-page titles, descriptions, canonical URLs and keywords; Open Graph and Twitter cards with 1200×630 images; schema.org JSON-LD (`WebSite`, `WebApplication`, `BreadcrumbList`, `ItemList`); a sitemap, `robots.txt`, SVG/PNG/ICO favicons, an Apple touch icon and an installable web manifest.

### Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`: type-check → test → build → deploy to GitHub Pages. Pull requests run the same checks without deploying.

## License

[MIT](LICENSE) © 2026 Moshe Malka. All melodies are in the public domain.
