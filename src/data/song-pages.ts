/**
 * Every song an instrument can play gets its own page (/kalimba/ode-to-joy/):
 * the instrument with the song preloaded, plus a written lesson that search
 * engines and screen readers can read without running any JavaScript.
 */
import { REST, flatName } from '../lib/music';
import { kalimbaNumber } from '../lib/kalimba-layout';
import { countFlips, leverPreset, stringLabel } from '../lib/harp';
import { SONGS, playableCount, type NoteEvent, type Song } from './songs';
import { INSTRUMENTS, fullName, type Instrument } from './instruments';
import { isPlayable, type InstrumentSlug } from './availability';
import { SITE, withBase } from '../lib/site';

export interface SongPage {
  instrument: Instrument;
  song: Song;
}

export const songsFor = (slug: InstrumentSlug): Song[] => SONGS.filter((s) => isPlayable(slug, s));
export const instrumentsFor = (song: Song): Instrument[] => INSTRUMENTS.filter((i) => isPlayable(i.slug, song));

export const songPages = (): SongPage[] =>
  INSTRUMENTS.flatMap((instrument) => songsFor(instrument.slug).map((song) => ({ instrument, song })));

/** Site-relative paths (pass through withBase for links). */
export const songPath = (slug: InstrumentSlug, id: string): string => `${slug}/${id}/`;
export const songImage = (slug: InstrumentSlug, id: string): string => `og/songs/${slug}--${id}.png`;

/** A note in the instrument's own notation: kalimba tabs, flats on the pan, names elsewhere. */
export function notate(slug: InstrumentSlug, note: string): string {
  if (note === REST) return '·';
  if (slug === 'kalimba') {
    const { digit, dots } = kalimbaNumber(note);
    return `${digit}${['', '̇', '̈'][dots] ?? ''}`;
  }
  if (slug === 'steelpan') return flatName(note);
  return note.replace('#', '♯');
}

/** Splits a song into lines of about four bars, for the printed sheet. */
export function phrases(song: Song, barsPerLine = 4): NoteEvent[][] {
  const [num, den] = song.timeSignature.split('/').map(Number);
  const lineBeats = num * (4 / den) * barsPerLine;
  const lines: NoteEvent[][] = [[]];
  let beats = 0;
  for (const n of song.notes) {
    if (beats >= lineBeats - 0.01) {
      lines.push([]);
      beats = 0;
    }
    lines[lines.length - 1].push(n);
    beats += n.beats;
  }
  return lines;
}

/** For the harp: which levers the song wants raised, and how many flips it needs mid-song. */
export function harpLevers(song: Song): { raised: string[]; flips: number } {
  const notes = song.notes.filter((n) => n.note !== REST).map((n) => n.note);
  const preset = leverPreset(notes);
  const raised = [...new Set(preset.map((up, i) => (up ? stringLabel(i, true) : null)).filter((n): n is string => !!n))];
  return { raised, flips: countFlips(notes, preset) };
}

interface Copy {
  /** "Kalimba Tabs" / "on Steel Drum": how people search for it. */
  title: (song: Song) => string;
  /** What the sheet prints. */
  notation: string;
  /** What lights up in Play along. */
  target: string;
  /** One instrument-specific tip for the lesson. */
  tip: string;
}

const COPY: Record<InstrumentSlug, Copy> = {
  steelpan: {
    title: (s) => `${s.title} on Steel Drum — Notes & Play-Along`,
    notation: 'note names spelled with flats',
    target: 'the pad to strike',
    tip: 'Low notes sit on the rim and high notes toward the centre. Going round the rim, each pad is a fifth above the one before (C, G, D, A …), and the inner ring repeats the same pattern an octave higher.',
  },
  theremin: {
    title: (s) => `${s.title} on Theremin — Play Along Online`,
    notation: 'every note name',
    target: 'a band where your hand needs to be',
    tip: 'Pitch slides continuously, so aim for the centre of the band and hold still. Play along scores how long you stay on pitch.',
  },
  kalimba: {
    title: (s) => `${s.title} Kalimba Tabs — Play Along Online`,
    notation: 'kalimba number tabs',
    target: 'the tine to pluck',
    tip: 'Tabs number the notes of the scale: 1 is C, 2 is D, up to 7 for B. A dot above a number means the octave above. The lowest tine is in the middle and notes alternate left and right.',
  },
  'glass-harp': {
    title: (s) => `${s.title} on Glass Harp — Notes & Play-Along`,
    notation: 'the note names',
    target: 'the glass to circle',
    tip: 'Press and circle a rim to make it sing. A quick tap only gives a ting, and circling faster makes it louder.',
  },
  harp: {
    title: (s) => `${s.title} on Harp — Notes, Levers & Play-Along`,
    notation: 'note names and lever settings',
    target: 'the string to pluck',
    tip: 'The harp is tuned in E♭. Each lever at the top raises its string a semitone, and the page sets the levers for you when the song loads.',
  },
};

export const pageTitle = ({ instrument, song }: SongPage): string => COPY[instrument.slug].title(song);

export function pageDescription({ instrument, song }: SongPage): string {
  const c = COPY[instrument.slug];
  const guide = instrument.slug === 'theremin' ? 'shows where to hold your hand' : `lights ${c.target}`;
  return `Learn ${song.title} on the ${instrument.name.toLowerCase()}: ${c.notation}, and a free play-along that ${guide}. ${playableCount(song)} notes, ${song.key}.`;
}

export const lessonCopy = (slug: InstrumentSlug): Copy => COPY[slug];

/** schema.org: a learning resource about the composition, plus breadcrumbs. */
export function songJsonLd(page: SongPage, url: string, image: string, site: URL): Record<string, unknown>[] {
  const { instrument, song } = page;
  const instrumentUrl = new URL(withBase(`${instrument.slug}/`), site).href;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'LearningResource',
      name: pageTitle(page),
      description: pageDescription(page),
      url,
      image,
      learningResourceType: 'Interactive tutorial',
      educationalLevel: song.difficulty,
      teaches: `How to play ${song.title} on the ${instrument.name.toLowerCase()}`,
      isAccessibleForFree: true,
      inLanguage: 'en',
      about: {
        '@type': 'MusicComposition',
        name: song.title,
        musicalKey: song.key,
        description: `${song.origin}. ${song.description}`,
      },
      isPartOf: { '@type': 'WebApplication', name: fullName(instrument), url: instrumentUrl },
      author: { '@type': 'Person', name: SITE.author },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: SITE.name, item: new URL(withBase(), site).href },
        { '@type': 'ListItem', position: 2, name: instrument.name, item: instrumentUrl },
        { '@type': 'ListItem', position: 3, name: song.title, item: url },
      ],
    },
  ];
}
