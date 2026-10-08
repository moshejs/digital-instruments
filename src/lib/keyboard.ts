/**
 * Piano-style computer keyboard covering C4–C6 chromatically:
 * bottom row = lower octave (black keys on the row above), top row = upper octave.
 */
export const PIANO_KEYMAP: Record<string, string> = {
  z: 'C4', s: 'C#4', x: 'D4', d: 'D#4', c: 'E4', v: 'F4', g: 'F#4', b: 'G4', h: 'G#4', n: 'A4', j: 'A#4', m: 'B4',
  q: 'C5', '2': 'C#5', w: 'D5', '3': 'D#5', e: 'E5', r: 'F5', '5': 'F#5', t: 'G5', '6': 'G#5', y: 'A5', '7': 'A#5', u: 'B5',
  i: 'C6',
};

/** note → key, e.g. "C4" → "z". */
export const invertKeymap = (map: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(map).map(([key, note]) => [note, key]));
