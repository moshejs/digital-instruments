/**
 * A 15-string lever harp, C4–C6, tuned in E♭ like most lever harps.
 * Flipping a string's lever raises it a semitone, so the E♭, A♭ and B♭
 * strings become E, A and B (C major), and C, D, F, G can become sharps.
 * Between them every chromatic note is reachable — sometimes with a lever flip.
 */
import { midiToName, noteToMidi } from './music.ts';

export interface HarpString {
  index: number;
  /** Open (lever down) pitch as MIDI. */
  midi: number;
  /** Open-string spelling, e.g. "E♭4". */
  name: string;
  /** Harpists colour C strings red and F strings dark blue. */
  colour: 'c' | 'f' | 'plain';
}

const OPEN = ['C', 'D', 'E♭', 'F', 'G', 'A♭', 'B♭'];
const OPEN_PC = [0, 2, 3, 5, 7, 8, 10];

export const HARP_STRINGS: HarpString[] = (() => {
  const strings: HarpString[] = [];
  for (const octave of [4, 5]) {
    OPEN.forEach((name, i) => {
      strings.push({
        index: strings.length,
        midi: (octave + 1) * 12 + OPEN_PC[i],
        name: `${name}${octave}`,
        colour: name === 'C' ? 'c' : name === 'F' ? 'f' : 'plain',
      });
    });
  }
  strings.push({ index: strings.length, midi: 84, name: 'C6', colour: 'c' });
  return strings;
})();

export type Levers = boolean[];

export const pitchOf = (index: number, lever: boolean): number => HARP_STRINGS[index].midi + (lever ? 1 : 0);

/** How a string sounds right now, spelled the way a harpist would read it. */
export function stringLabel(index: number, lever: boolean): string {
  const s = HARP_STRINGS[index];
  if (!lever) return s.name.slice(0, -1);
  const natural = { 'E♭': 'E', 'A♭': 'A', 'B♭': 'B' }[s.name.slice(0, -1)];
  return natural ?? `${s.name.slice(0, -1)}♯`;
}

export interface Fingering { index: number; lever: boolean }

/** Every string + lever combination that sounds this note. */
export function fingeringsFor(note: string): Fingering[] {
  const midi = noteToMidi(note);
  const out: Fingering[] = [];
  for (const s of HARP_STRINGS) {
    if (s.midi === midi) out.push({ index: s.index, lever: false });
    if (s.midi + 1 === midi) out.push({ index: s.index, lever: true });
  }
  return out;
}

/** Picks the fingering that needs no lever flip if possible, else the first option. */
export function chooseFingering(note: string, levers: Levers): Fingering | null {
  const options = fingeringsFor(note);
  return options.find((f) => levers[f.index] === f.lever) ?? options[0] ?? null;
}

/** The common "C major" setting: E♭, A♭ and B♭ strings raised. */
export const C_MAJOR_LEVERS: Levers = HARP_STRINGS.map((s) => [3, 8, 10].includes(s.midi % 12));

/**
 * Sets each lever the way the song first needs it, so most songs play with no
 * flips at all. Strings the song never uses stay in C major.
 */
export function leverPreset(notes: string[]): Levers {
  const levers = [...C_MAJOR_LEVERS];
  const fixed = new Set<number>();
  for (const note of notes) {
    const options = fingeringsFor(note);
    if (options.some((f) => fixed.has(f.index) && levers[f.index] === f.lever)) continue;
    const free = options.find((f) => !fixed.has(f.index));
    if (!free) continue; // conflicts with an earlier choice → needs a flip mid-song
    levers[free.index] = free.lever;
    fixed.add(free.index);
  }
  return levers;
}

/** Counts mid-song lever flips needed to play the notes from a preset. */
export function countFlips(notes: string[], preset: Levers): number {
  const levers = [...preset];
  let flips = 0;
  for (const note of notes) {
    const f = chooseFingering(note, levers);
    if (!f) continue;
    if (levers[f.index] !== f.lever) {
      levers[f.index] = f.lever;
      flips++;
    }
  }
  return flips;
}

export const sounds = (f: Fingering): string => midiToName(pitchOf(f.index, f.lever));

/** One key per string: 1–7 for the lower octave, q–u for the upper, i for top C. */
export const HARP_KEYS = ['1', '2', '3', '4', '5', '6', '7', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i'];

/* ───────── drawing geometry (SVG units, viewBox 0 0 1000 720) ───────── */

export const HARP_VIEW = { width: 1000, height: 720 } as const;

const FIRST_X = 200;
const LAST_X = 872;

/** The neck curves up from the pillar and sweeps down toward the treble. */
export const neckY = (x: number): number => 112 + 178 * Math.pow(Math.max(0, (x - 120) / 800), 1.55);

/** The soundboard runs diagonally from the base (bass) up to the neck (treble). */
export const soundboardY = (x: number): number => 680 - ((x - 160) * 350) / 740;

export interface StringGeometry { x: number; top: number; bottom: number }

export function stringGeometry(index: number): StringGeometry {
  const x = FIRST_X + (index * (LAST_X - FIRST_X)) / (HARP_STRINGS.length - 1);
  return { x, top: neckY(x) + 14, bottom: soundboardY(x) - 6 };
}
