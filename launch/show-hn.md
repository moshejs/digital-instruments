# Show HN draft: Moshe's Digital Instruments

Status: **draft for the owner to post under his own HN account.** Nothing here has been submitted.

Rules followed, from HN's Show HN page (https://news.ycombinator.com/showhn.html, read 2026-11-20):

- It is something people can try right away: no signup, no email, no install.
- The title starts with "Show HN".
- The first comment says how and why it was built.
- Do not ask friends to upvote or comment. HN calls this "not ok".
- From HN's general guidelines (https://news.ycombinator.com/newsguidelines.html, read 2026-11-20): no uppercase, no exclamation points, nothing that says how great it is, and no gratuitous numbers in titles. Don't solicit upvotes or comments. "It's ok to post your own stuff part of the time."
- Show HN asks that the maker be around to discuss it, so plan to stay in the thread.

## Before you post (owner)

1. **Update the GitHub repo description.** It still says "Five instruments ... nine songs". The site has six instruments and fifteen songs. HN readers will click through to the repo.
2. The README's "Play now" link goes to the GitHub Pages copy (`moshejs.github.io/digital-instruments`), not to `digital-instruments.quentin.software`. Either link is fine, but submit only one URL, the one below.
3. Play every instrument once on your own phone. The phone checks so far were automated (390x844 in Playwright). Nobody has listened on a real device yet (see the claims table).
4. Post at a time when you can answer comments for the next few hours.

## Title (73 characters)

```
Show HN: Steelpan, theremin, kalimba and harps synthesized in the browser
```

Alternative (78 characters). Its leading number is arguably "gratuitous" under HN's title guideline, so the first title is preferred:

```
Show HN: Six instruments synthesized in the browser with Web Audio, no samples
```

## URL

```
https://digital-instruments.quentin.software/
```

## First comment

> I built six playable instruments that run in the browser: a steelpan, a theremin, a 17-key kalimba, a glass harp, a lever harp, and a small subtractive synth. None of them use recorded samples. Each one makes its sound from a small model of how the real instrument works, using only the Web Audio API.
>
> How each one works:
>
> - Steelpan: seven additive partials per note. The octave and the twelfth are detuned slightly, the way a hand-hammered pan is, and a short burst of filtered noise plays as the strike.
> - Kalimba: a clamped steel tine is a cantilever beam, so its overtones are inharmonic, at about 1 : 6.27 : 17.55 of the fundamental. The high modes die out within a fraction of a second. Then there's a thumb-click transient and a wooden-box resonance.
> - Lever harp: Karplus–Strong. A burst of noise goes round a one-period delay line with an averaging filter. Each pitch is rendered into a buffer once and cached. Turning on a sharping lever raises that string a semitone. When you pick a song, the levers set themselves for its key, and they flip mid-song if the melody needs it.
> - Glass harp: glass bending modes plus a slightly detuned copy for the beating, driven by band-passed "friction" noise. You press on a rim and move in a circle. The faster you circle, the louder it gets.
> - Theremin: two crossfaded oscillators with a vibrato LFO and portamento. Your pointer controls pitch and volume. On a phone you can tilt and shake it instead (DeviceOrientation/DeviceMotion). It also shows a live oscilloscope.
> - Synth: one oscillator per voice, then a lowpass filter, an ADSR envelope and a convolver reverb, with a live oscilloscope and spectrum. Its page is a short explainer of subtractive synthesis that you play as you read.
>
> All the reverbs use impulse responses generated from decaying noise when the page loads, so the site doesn't download any audio files.
>
> There are also 15 public-domain songs (Ode to Joy, Greensleeves, Scarborough Fair and so on). "Listen" plays a song. "Play along" lights up the next pad, tine, glass or string. On the theremin it moves a target across the field and scores how long you stay on pitch. An instrument only offers the songs it can actually play: the kalimba is tuned to C major, so songs that need sharps are left out. Every song has its own page on every instrument that can play it, 72 pages in all. Each page shows the written notes in that instrument's own notation, like kalimba number tabs or harp lever settings, and works without JavaScript.
>
> The site is a static Astro site written in TypeScript, with no audio libraries. Vitest covers the note math, the layouts, which songs fit which instrument, and the harp lever logic. The code is MIT-licensed: https://github.com/moshejs/digital-instruments
>
> What's unfinished:
>
> - I've tested on desktop much more than on phones. The tilt mode on the theremin has had the least testing on real devices.
> - The kalimba only has one tuning (C major), and the harp has 15 strings.
> - There's no way yet to record a take or save a performance.
> - The site uses Google Analytics in consent mode, which is off by default for visitors in the EU, UK and Switzerland.
>
> The feedback I'd find most useful:
>
> - Which instrument sounds least like the real thing, and what's wrong with it? I especially want to hear from steelpan, kalimba or harp players.
> - Whether play-along mode is usable on your phone or tablet.
> - Audio glitches: clicks, dropouts or latency, along with your browser and device.
> - Songs you'd like added. There's a song-request issue template on the repo.

(About 650 words, which is long for a first comment. If you cut, cut the per-instrument list down to the three most unusual entries: kalimba, harp and glass harp.)

## Owner notes, not for posting

- Don't edit the title after posting to add descriptors. Keep it plain.
- Bugs found while trying the live site on 2026-11-20 are listed below. Either fix them before posting or expect someone to point them out:
  - On the harp's Greensleeves page, the coach panel says "41 notes" but the song card says "39 notes". `src/scripts/shared/guide-player.ts:129` counts `song.notes.length`, which includes the two rests. Line 112 and the song list use `playableCount(song)`.
  - At 390px wide, the theremin's floating note readout (for example "A#5 -28") gets cut off at the right edge of the field when the pointer is near the top of the range.

## Claims and sources

Every factual claim in the title and first comment, and where it was checked.

| Claim | Verified in |
|---|---|
| Six instruments: steelpan, theremin, kalimba, glass harp, lever harp, synth | `src/data/instruments.ts`, `src/lib/site.ts` (`SITE.description`), live home page (screenshot `desktop-home.png`) |
| No recorded samples; sound comes from Web Audio | `src/scripts/*.ts` create oscillators and noise buffers only. `src/lib/audio.ts` (`makeNoise`, `makeImpulse`). No audio files are in `public/`. Instrument credits in `src/data/instruments.ts` say "synthesized live ... no samples" |
| Steelpan: seven additive partials, detuned octave and twelfth, noise strike | `src/scripts/steelpan.ts` lines 1-27 (`PARTIALS`: 7 entries, ratios 2.004 and 3.006), lines 119-121 |
| Kalimba 17 keys, C major, mode ratios 1 : 6.27 : 17.55, thumb click, box resonance | `src/scripts/kalimba.ts` header comment and `MODES`. `src/data/instruments.ts` kalimba specs ("17 tines, C major"). README instrument table |
| Harp: Karplus–Strong, rendered once per pitch and cached, 15 strings, sharping levers, auto-levers per song and mid-song | `src/scripts/harp.ts` lines 1-6 and 60-90 (`string()` cache). README "Learning songs" (Greensleeves uses G and G♯). Live: `/harp/greensleeves/` shows "Levers set for A minor" (screenshot `phone-harp_greensleeves-after.png`) |
| Glass harp: bending modes, detuned twin, band-passed friction noise, speed = loudness | `src/scripts/glass-harp.ts` header (line 6) and line 101. `src/data/instruments.ts` glass-harp tagline. README table |
| Theremin: two crossfaded oscillators, vibrato LFO, portamento, tilt/shake on phones, oscilloscope | `src/scripts/theremin.ts` header, lines 398-442 (DeviceOrientation/DeviceMotion). README table |
| Synth: osc → lowpass → ADSR → convolver reverb, oscilloscope and spectrum, explainer page | `src/scripts/subtractive-synth.ts` lines 1-6 and 64-65. README "Learning songs" paragraph |
| Reverb impulses are generated noise at load time | `src/lib/audio.ts` line 60 (`makeImpulse`). `src/scripts/subtractive-synth.ts` line 65 comment |
| 15 public-domain songs, including Ode to Joy, Greensleeves, Scarborough Fair | `src/data/songs.ts` (15 `id:` entries). README list. Home page copy "fifteen songs". The README licence section says the melodies are public domain |
| Listen / Play along; theremin scores time on pitch | `src/components/CoachBand.astro` (`btnListen`, `btnGuide`). README "Learning songs". Live: Listen on `/kalimba/ode-to-joy/` triggered 12 new audio-source starts (`live-playthrough.json`) |
| Instruments only offer songs they can play; kalimba is C major | `src/data/availability.ts` lines 3, 30, 45 |
| 72 song pages, own notation per instrument, readable without JavaScript | Live `sitemap-0.xml`: 79 URLs, 72 of them song pages (checked 2026-11-20). README "SEO and sharing". `src/components/SongSheet.astro` |
| Static Astro site, TypeScript, no audio libraries | `package.json` dependencies: astro, @astrojs/sitemap and fonts only |
| Vitest tests for note math, layouts, availability, lever logic | `tests/*.ts` (5 files, 50 `it`/`test` cases). README "Project layout" |
| MIT-licensed, public repo | `LICENSE`. `gh repo view` reports PUBLIC |
| Desktop tested more than phones; tilt is least tested | **Owner to confirm.** Source: the desk record notes "Sound and real phones not yet checked" (quentin-code `projects.json`). The 2026-11-20 check used only headless Playwright, with no human listening |
| Google Analytics in consent mode, off by default in EU/UK/CH | `src/layouts/Base.astro` lines 92-117 (region list includes EEA countries, GB, CH). Live HTML contains `G-N8P0ZQD3E3` |
| Song-request issue template | `.github/ISSUE_TEMPLATE/song-request.yml`. `src/lib/site.ts` `SONG_REQUEST_URL` |
| No recording / save feature | `grep -rli MediaRecorder src` returns nothing. No export UI on any instrument page (owner to confirm) |
| No signup, works immediately | Live check 2026-11-20: every instrument page played without any account or login prompt |
