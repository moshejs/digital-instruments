/**
 * A chromatic glass harp, C4–C6: naturals in the front row, sharps behind,
 * arranged like a piano keyboard. More water lowers a glass's pitch,
 * so the low glasses are the fullest.
 *
 * Import-free so build scripts can load it directly with Node.
 */

export interface Glass {
  note: string;
  row: 'front' | 'back';
  /** Centre position from the left, as a percentage of the table width. */
  x: number;
  /** Water fill, 0 (empty) … 1 (full). */
  water: number;
}

const NATURALS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const HAS_SHARP = new Set(['C', 'D', 'F', 'G', 'A']);

export function buildGlasses(): Glass[] {
  const front: string[] = [];
  for (const octave of [4, 5]) for (const n of NATURALS) front.push(`${n}${octave}`);
  front.push('C6');

  const glasses: Glass[] = [];
  const step = 100 / front.length;
  front.forEach((note, i) => {
    glasses.push({ note, row: 'front', x: (i + 0.5) * step, water: 0 });
    if (HAS_SHARP.has(note[0]) && note !== 'C6') {
      glasses.push({ note: `${note[0]}#${note.slice(1)}`, row: 'back', x: (i + 1) * step, water: 0 });
    }
  });

  // fill level falls as pitch rises: lowest glass ~88% full, highest ~22%
  const order = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  for (const g of glasses) {
    const octave = Number(g.note.slice(-1));
    const semis = (octave - 4) * 12 + order.indexOf(g.note.slice(0, -1));
    g.water = 0.88 - (semis / 24) * 0.66;
  }
  return glasses;
}
