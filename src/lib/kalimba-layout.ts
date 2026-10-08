/**
 * A 17-key kalimba in C major (C4–E6), laid out like the real thing:
 * the longest, lowest tine sits in the middle and the scale alternates
 * outward — left, right, left — so each thumb plays every other note.
 *
 * Import-free so build scripts can load it directly with Node.
 */

export const KALIMBA_NOTES = [
  'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4',
  'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5',
  'C6', 'D6', 'E6',
];

export interface Tine {
  note: string;
  /** Position from the left, 0 … 16. */
  slot: number;
  /** Rank by pitch, 0 = lowest. */
  rank: number;
  /** Visible length as a fraction of the longest tine. */
  length: number;
}

export function buildTines(): Tine[] {
  const left: string[] = [];
  const right: string[] = [];
  KALIMBA_NOTES.slice(1).forEach((note, i) => (i % 2 === 0 ? left : right).push(note));
  const order = [...left.reverse(), KALIMBA_NOTES[0], ...right];
  return order.map((note, slot) => {
    const rank = KALIMBA_NOTES.indexOf(note);
    return { note, slot, rank, length: 1 - rank * 0.032 };
  });
}

const DEGREE: Record<string, number> = { C: 1, D: 2, E: 3, F: 4, G: 5, A: 6, B: 7 };

/** Kalimba tablature: scale degree 1–7, with one dot per octave above the 4th. */
export function kalimbaNumber(note: string): { digit: number; dots: number } {
  const letter = note[0];
  const octave = Number(note.slice(-1));
  return { digit: DEGREE[letter] ?? 0, dots: Math.max(0, octave - 4) };
}

/** Number keys for degrees 1–7, then the q-row and a-row for the upper octaves. */
export const KALIMBA_KEYMAP: Record<string, string> = {
  '1': 'C4', '2': 'D4', '3': 'E4', '4': 'F4', '5': 'G4', '6': 'A4', '7': 'B4',
  q: 'C5', w: 'D5', e: 'E5', r: 'F5', t: 'G5', y: 'A5', u: 'B5',
  a: 'C6', s: 'D6', d: 'E6',
};
