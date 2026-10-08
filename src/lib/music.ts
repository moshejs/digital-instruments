/**
 * Shared music theory helpers used by every instrument.
 * Notes are written in scientific pitch notation (C4 = middle C, A4 = 440 Hz).
 */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const REST = 'REST';

const PITCH_CLASS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C4" → 60, "Bb4" → 70, "F#5" → 78. Throws on anything it can't parse. */
export function noteToMidi(name: string): number {
  const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(name.trim());
  if (!m) throw new Error(`Unrecognised note name: "${name}"`);
  let pc = PITCH_CLASS[m[1].toUpperCase()];
  if (m[2] === '#') pc += 1;
  else if (m[2] === 'b') pc -= 1;
  return (parseInt(m[3], 10) + 1) * 12 + pc;
}

export const midiToFreq = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

export const noteToFreq = (name: string): number => midiToFreq(noteToMidi(name));

/** 70 → "A#4". Always spelled with sharps so names can be compared as strings. */
export function midiToName(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  return `${NOTE_NAMES[pc]}${Math.floor(midi / 12) - 1}`;
}

/** Normalises enharmonic spellings ("Bb4" → "A#4"); rests pass through untouched. */
export function canonicalNote(name: string): string {
  return name === REST ? REST : midiToName(noteToMidi(name));
}

export const freqToMidiFloat = (freq: number): number => 69 + 12 * Math.log2(freq / 440);

/** Distance between two frequencies in cents (100 cents = one semitone). */
export const centsBetween = (a: number, b: number): number => 1200 * Math.log2(a / b);

export interface PitchInfo {
  /** Nearest note, e.g. "A4". */
  name: string;
  /** How far the frequency sits from that note, -50…+50. */
  cents: number;
  midi: number;
}

export function freqInfo(freq: number): PitchInfo {
  const midiF = freqToMidiFloat(freq);
  const midi = Math.round(midiF);
  return { name: midiToName(midi), cents: Math.round((midiF - midi) * 100), midi };
}

export const SCALES = {
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  pentatonic: [0, 2, 4, 7, 9],
} as const;

export type ScaleMode = keyof typeof SCALES | 'off';

/** Pulls a frequency onto the nearest note of a scale rooted on C; 'off' leaves it free. */
export function snapFreq(freq: number, scale: ScaleMode): number {
  if (scale === 'off') return freq;
  const allowed: readonly number[] = SCALES[scale];
  const midiF = freqToMidiFloat(freq);
  let best = Math.round(midiF);
  let bestDist = Infinity;
  for (let m = Math.floor(midiF) - 2; m <= Math.ceil(midiF) + 2; m++) {
    if (!allowed.includes(((m % 12) + 12) % 12)) continue;
    const d = Math.abs(m - midiF);
    if (d < bestDist) {
      bestDist = d;
      best = m;
    }
  }
  return midiToFreq(best);
}
