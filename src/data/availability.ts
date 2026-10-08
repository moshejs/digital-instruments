/**
 * Which songs each instrument can actually play. An instrument only offers a
 * song if every note exists on it — a C-major kalimba has no sharps, for example.
 */
import { REST, midiToName, noteToMidi } from '../lib/music';
import { buildPads } from '../lib/steelpan-layout';
import { KALIMBA_NOTES } from '../lib/kalimba-layout';
import { buildGlasses } from '../lib/glass-layout';
import { fingeringsFor } from '../lib/harp';
import { FIELD_MAX_MIDI, FIELD_MIN_MIDI } from '../lib/theremin-field';
import type { Song } from './songs';

export type InstrumentSlug = 'steelpan' | 'theremin' | 'kalimba' | 'glass-harp' | 'harp';

const padNotes = new Set(buildPads().map((p) => p.note));
const kalimbaNotes = new Set(KALIMBA_NOTES);
const glassNotes = new Set(buildGlasses().map((g) => g.note));

const canPlay: Record<InstrumentSlug, (note: string) => boolean> = {
  steelpan: (n) => padNotes.has(n),
  theremin: (n) => {
    const m = noteToMidi(n);
    return m >= FIELD_MIN_MIDI && m <= FIELD_MAX_MIDI;
  },
  kalimba: (n) => kalimbaNotes.has(n),
  'glass-harp': (n) => glassNotes.has(n),
  harp: (n) => fingeringsFor(n).length > 0,
};

/** Human-readable spelling for messages: "G#4" → "G♯4". */
const pretty = (note: string) => note.replace('#', '♯');

/** Why a song can't be played on an instrument, or null if it can. */
export function unavailableReason(slug: InstrumentSlug, song: Song): string | null {
  const missing = new Set<string>();
  for (const n of song.notes) if (n.note !== REST && !canPlay[slug](n.note)) missing.add(midiToName(noteToMidi(n.note)));
  if (missing.size === 0) return null;
  const list = [...missing].map(pretty).join(', ');
  return slug === 'kalimba' ? `Needs ${list} — this kalimba is tuned to C major` : `Needs ${list}, out of range`;
}

export const isPlayable = (slug: InstrumentSlug, song: Song): boolean => unavailableReason(slug, song) === null;
