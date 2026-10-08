/**
 * Tenor-pan note layout: a circle-of-fifths spiral from the rim inward.
 * Low notes sit on the wide outer ring, higher notes spiral toward the centre,
 * as on a real "fourths and fifths" lead pan. Covers C4–C6 chromatically (25 notes).
 *
 * Kept free of imports so build scripts can load it directly with Node.
 */

export type Ring = 'outer' | 'inner' | 'ctr' | 'center';

export interface Pad {
  note: string;
  ring: Ring;
  /** Centre position and size, as percentages of the pan's diameter. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export const OUTER = ['C4', 'G4', 'D4', 'A4', 'E4', 'B4', 'F#4', 'C#4', 'G#4', 'D#4', 'A#4', 'F4'];
export const INNER = ['C5', 'G5', 'D5', 'A5', 'E5', 'B5', 'F#5', 'C#5'];
export const CTR = ['G#5', 'D#5', 'A#5', 'F5'];
export const CENTER = 'C6';

export function buildPads(): Pad[] {
  const pads: Pad[] = [];
  const place = (list: string[], radius: number, w: number, h: number, stepDeg: number, ring: Ring) => {
    list.forEach((note, i) => {
      const a = ((-90 + i * stepDeg) * Math.PI) / 180;
      pads.push({ note, ring, x: 50 + radius * Math.cos(a), y: 50 + radius * Math.sin(a), w, h });
    });
  };
  place(OUTER, 39, 15.5, 12.8, 30, 'outer');
  place(INNER, 22, 13, 11, 45, 'inner');
  place(CTR, 10.5, 10.5, 9.5, 90, 'ctr');
  pads.push({ note: CENTER, ring: 'center', x: 50, y: 50, w: 12, h: 12 });
  return pads;
}
