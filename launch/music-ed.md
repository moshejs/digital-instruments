# Music-education community drafts

Status: **drafts for the owner to post under his own accounts.** Nothing here has been posted.

## Rules status: read this first

None of the Reddit communities below could be checked from the agent's environment on 2026-11-20. Every request to reddit.com returned HTTP 403, including `/about/rules.json`, `old.reddit.com` and `api.reddit.com`. Both browser tools refused reddit.com under their safety settings, and the Reddit mirrors were down or served junk. **So every Reddit draft below is gated.** Open the rules URL yourself, signed in. If the rules ban self-promotion or links to your own projects, don't post there. Some subreddits allow it only in a weekly thread or above a karma/contribution threshold; follow that instead.

| Community | Rules URL | What was checked | Status |
|---|---|---|---|
| r/musicteachers | https://www.reddit.com/r/musicteachers/about/rules | Not readable (403). A web search found no copy of its rules. | **Unverified.** Variant A is drafted, gated on your reading of the rules. |
| r/MusicEd | https://www.reddit.com/r/MusicEd/about/rules | Not readable directly (403). Secondary source only: a search-engine summary of a 2021 moderator post, "Reminder: Rule 2 / blog spam" (mirror URL `lr.sudovanilla.org/r/MusicEd/comments/lyasso/reminder_rule_2blog_spam`, which itself returned 404). According to that summary, a post sharing a self-created resource is removed as blogspam when the poster doesn't otherwise take part in discussions, and most of a user's posts should not be their own materials. | **Unverified, likely restricted.** Variant B is drafted for the case where you already take part there. If your only post would be this link, Rule 2 as summarized would remove it, so skip it. |
| r/WebAudio, r/kalimba, r/theremin | `https://www.reddit.com/r/<name>/about/rules` | Not readable (403). | **Unverified.** These are hobby/dev communities, not music-ed. Variant C (the kalimba version) is drafted, gated the same way. The desk's growth plan also lists these channels. |
| Piano Street forum | https://www.pianostreet.com/forumrules.php | Read 2026-11-20: "Any kind of commercial advertising or spamming is prohibited." The rules don't say whether a free tool counts. Moderators can remove posts at their discretion. | **Not drafted.** The rule is ambiguous for a free tool, and it's a piano forum, so the fit is poor. |
| Yamaha Musicians forum | https://yamahamusicians.com/forum/threads/important-notice-advertising-and-self-promotion.24514/ | Direct read returned 403. A search-engine summary of that notice says members may not promote their products, websites or other projects, free ones included, without a paid advertising arrangement. | **Not drafted. Treat as banned.** |
| FORUMS (open music-ed resources, Google Sites) | https://sites.google.com/view/forums-music/about/what-forums-will-and-will-not-do | Read 2026-11-20. It shares free and open materials for teaching music. Under what it "will not do" it lists "Promote commercial interests". Its scope is post-secondary general-studies music. It has no visible submission process, only a Contact page. | **Not drafted.** The audience (college general-studies courses) is a weak fit, and there's no clear way to submit. Revisit if you want a resource listing. |

Facebook music-teacher groups (named in the desk plan) need a login to read their rules, so they weren't checked. The same gate applies.

One more thing to disclose in every variant: each instrument page's footer says "Built by Moshe Malka at Quentin.Code · Work with me" and links to the studio. The site also runs Google Analytics. Communities that ban "commercial interests" may count the studio credit. That's why every draft states plainly who made the site and that it is free.

---

## Variant A: r/musicteachers (gated: read the rules first)

**Title:** Free browser instruments with a play-along mode: steelpan, kalimba, glass harp, lever harp, theremin

**Body:**

> I made a set of free instruments that run in a web browser, and I'd like to hear from teachers whether any of it is useful in a lesson, or what would make it useful.
>
> https://digital-instruments.quentin.software/
>
> There's a steelpan, a 17-key kalimba, a glass harp, a lever harp, a theremin and a simple synth. No account, no install, no ads. Every sound is synthesized live in the browser rather than played from a recording.
>
> The part that might matter for teaching is the song coach. There are 15 public-domain tunes (Twinkle Twinkle, Mary Had a Little Lamb, Ode to Joy, Frère Jacques, Amazing Grace and so on). "Listen" plays the tune. "Play along" lights up the next note to play, and it waits for the student. Each song also has a printable-style page with the notes written out in that instrument's notation: kalimba number tabs, flats on the steelpan, lever settings on the harp. For example:
> https://digital-instruments.quentin.software/kalimba/twinkle-twinkle/
>
> An instrument only offers the songs it can actually play. The kalimba is tuned to C major, so it skips songs that need sharps.
>
> Things I don't know and would like to:
> - Would you use something like this on a classroom board or on student devices? What gets in the way?
> - Which songs are missing for your students' level?
> - Does it work on the tablets or Chromebooks your school uses?
>
> I built it myself and I'm a developer, not a music teacher, so please tell me if the notation or the pedagogy is off.

Before posting, check that `/kalimba/twinkle-twinkle/` still exists (the C-major kalimba can play it; see `src/data/availability.ts`).

---

## Variant B: r/MusicEd (only if you already take part there; gated)

**Title:** Made a free play-along tool for steelpan, kalimba and harp. Looking for teacher feedback on the notation pages

**Body:**

> This is my own project, so flagging it as self-promotion up front. It's free, with no account and no ads.
>
> https://digital-instruments.quentin.software/
>
> It's a set of browser instruments (steelpan, kalimba, glass harp, lever harp, theremin) with 15 public-domain songs. Each song can be played back, followed note by note with the next note lit up, and read on its own page in the instrument's notation. On the lever harp, the page tells you which levers to flip for the song's key. For Greensleeves that means flipping G to G♯ mid-tune:
> https://digital-instruments.quentin.software/harp/greensleeves/
>
> What I'm unsure about, and would value a teacher's view on:
> - Are the written notation pages (kalimba number tabs, steelpan note names with flats, harp lever settings) right for beginners, or would you present them differently?
> - Is a "light up the next note and wait" mode useful for practice, or does it get in the way of reading?
>
> I'm a developer, not a music educator, and this is the first time I'm showing it to teachers.

Known issue to fix or mention first: on the Greensleeves harp page the coach panel shows "41 notes" while the song card shows "39 notes" (rests are counted in one place and not the other). See `show-hn.md`, owner notes.

---

## Variant C: r/kalimba (gated: hobby community, not music-ed)

**Title:** I made a free 17-key kalimba in the browser that shows number tabs for 15 songs

**Body:**

> I've been building browser instruments, and the kalimba is the one I most want feedback on from people who actually play.
>
> https://digital-instruments.quentin.software/kalimba/
>
> It's a 17-tine kalimba in C major (C4 to E6), with the tines alternating out from the centre like a real one. You can tap the tines or use number keys. The sound isn't a recording. It's modelled on how a clamped steel tine vibrates, with a few inharmonic overtones that die quickly, a thumb click and a wooden-box resonance.
>
> Each song page shows the tune in kalimba number tabs, and a play-along mode lights up the next tine. For example: https://digital-instruments.quentin.software/kalimba/ode-to-joy/
>
> Because it's C major only, songs that need sharps or flats are listed as unavailable, with the reason.
>
> Two questions for kalimba players:
> - Does the tab format match what you're used to reading?
> - How far off is the sound from a real 17-key, and in which direction?
>
> It's free, with no account and no ads. I built it myself.

---

## Claims and sources

| Claim (any variant) | Verified in |
|---|---|
| Free, no account, no install | Live check 2026-11-20 (Playwright, 1440x900 and 390x844): every instrument page played with no sign-in prompt. No auth code in `src/` |
| No ads | No ad scripts in `src/layouts/Base.astro`. The only third-party script is Google Analytics (`gtag`). The desk record says `monetization_built: false` |
| Instruments: steelpan, 17-key kalimba, glass harp, lever harp, theremin, synth | `src/data/instruments.ts`. README instrument table |
| Synthesized live, not recordings | `src/scripts/*.ts` (oscillators and generated noise only). No audio files in `public/` (checked: 0 mp3/wav/ogg/m4a/flac) |
| 15 public-domain songs; titles named | `src/data/songs.ts` (15 entries: twinkle-twinkle, mary-had-a-little-lamb, ode-to-joy, amazing-grace, frere-jacques, greensleeves, ...). README licence: "All melodies are in the public domain" |
| Listen / Play along lights the next note and waits | `src/components/CoachBand.astro`, `src/scripts/shared/guide-player.ts`. README "Learning songs". Live Listen on `/kalimba/ode-to-joy/` produced sound events (`live-playthrough.json`) |
| Per-song pages in each instrument's notation (kalimba tabs, flats on pan, harp lever settings) | README "Learning songs". `src/components/SongSheet.astro`, `src/data/song-pages.ts` |
| `/kalimba/twinkle-twinkle/`, `/kalimba/ode-to-joy/`, `/harp/greensleeves/` exist | Live `sitemap-0.xml` (72 song URLs, checked 2026-11-20). `/kalimba/ode-to-joy/` and `/harp/greensleeves/` returned 200 in the Playwright run. Confirm twinkle-twinkle before posting |
| Kalimba is C major, skips songs needing sharps, explains why | `src/data/availability.ts` lines 3, 30, 45. `src/data/instruments.ts` kalimba specs |
| Kalimba range C4–E6, 17 tines, alternating from the centre, number keys | `src/data/instruments.ts` kalimba specs ("C4 – E6 · 17 tines, C major", "Alternating from the centre", "number keys") |
| Kalimba sound: clamped-tine inharmonic modes that decay fast, thumb click, box resonance | `src/scripts/kalimba.ts` header and `MODES` (ratios 1 : 6.27 : 17.55). README table |
| Harp levers set per key; Greensleeves flips G to G♯ | README "Learning songs". Live `/harp/greensleeves/` shows "Levers set for A minor: E, A, B raised" (screenshot `phone-harp_greensleeves-after.png`). G♯4 appears in `src/data/songs.ts` Greensleeves |
| "I'm a developer, not a music teacher" | **Owner to confirm** before posting. This is a statement about the owner, not checkable in the repo |
| Studio credit and "Work with me" link in footer | `src/components/InstrumentFooter.astro` line 35. `src/lib/site.ts` (`studioUrl`) |
| Community rules quoted | URLs and read status are in the "Rules status" table above. Reddit rules were **not** read directly |
