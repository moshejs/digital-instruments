/**
 * The subtractive synth's patches, control ranges and keyboard layout: everything
 * that doesn't need a browser, so it can be tested.
 */

export type Wave = 'sine' | 'sawtooth' | 'square' | 'triangle';

/** Everything a preset sets: all the controls except volume and octave. */
export interface Patch {
  wave: Wave;
  /** Filter cutoff in Hz. */
  cutoff: number;
  /** Filter Q, 0 to 20. */
  res: number;
  /** Attack, decay and release in seconds. */
  a: number;
  d: number;
  /** Sustain level, 0 to 1. */
  s: number;
  r: number;
  /** Reverb amount, 0 to 1. */
  space: number;
}

export const PRESETS = {
  saw: { wave: 'sawtooth', cutoff: 8000, res: 2, a: 0.005, d: 0.15, s: 0.75, r: 0.25, space: 0.12 },
  pad: { wave: 'sawtooth', cutoff: 900, res: 4, a: 0.6, d: 0.4, s: 0.8, r: 1.4, space: 0.55 },
  pluck: { wave: 'triangle', cutoff: 3500, res: 6, a: 0.002, d: 0.18, s: 0, r: 0.14, space: 0.16 },
  bass: { wave: 'square', cutoff: 600, res: 8, a: 0.005, d: 0.12, s: 0.7, r: 0.12, space: 0.05 },
} as const satisfies Record<string, Patch>;

export type PresetName = keyof typeof PRESETS;

export const WAVE_NAME: Record<Wave, string> = { sine: 'Sine', sawtooth: 'Sawtooth', square: 'Square', triangle: 'Triangle' };

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/* The cutoff slider is logarithmic, because pitch is. */
const CUT_MIN = 50;
const CUT_MAX = 12000;
export const posToHz = (p: number): number => CUT_MIN * Math.pow(CUT_MAX / CUT_MIN, clamp(p, 0, 1));
export const hzToPos = (hz: number): number => Math.log(clamp(hz, CUT_MIN, CUT_MAX) / CUT_MIN) / Math.log(CUT_MAX / CUT_MIN);

export const fmtHz = (hz: number): string => (hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${Math.round(hz)} Hz`);
export const fmtSec = (s: number): string => (s < 1 ? `${Math.round(s * 1000)} ms` : `${s.toFixed(2)} s`);
export const fmtPct = (v: number): string => `${Math.round(v * 100)}%`;

export const MIN_OCTAVE = 1;
export const MAX_OCTAVE = 6;

/** MIDI number of a key, counted in semitones up from the C of the octave. */
export const keyMidi = (octave: number, semi: number): number => 12 * (octave + 1) + semi;

/** Computer keys, laid out like a piano: home row for the white keys, the row above for the black. */
export const SYNTH_KEYMAP: Record<string, number> = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12 };

const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);
export const isBlackKey = (semi: number): boolean => BLACK_PITCH_CLASSES.has(semi % 12);

/** Keys drawn on a wide screen: C up to F an octave and a half above. */
export const WIDE_KEYS = 18;
/** Keys drawn on a phone: one octave, C to C, wide enough for a thumb. The octave buttons reach the rest. */
export const PHONE_KEYS = 13;

export interface KeyGeometry {
  semi: number;
  black: boolean;
  /** Position and width across the keyboard, in percent. */
  left: number;
  width: number;
}

/** Whites sit edge to edge; each black straddles the boundary between its two whites. */
export function layoutKeys(count: number): KeyGeometry[] {
  const semis = Array.from({ length: count }, (_, s) => s);
  const whiteWidth = 100 / semis.filter((s) => !isBlackKey(s)).length;
  const blackWidth = whiteWidth * 0.62;
  let whitesSoFar = 0;
  return semis.map((semi) => {
    if (isBlackKey(semi)) return { semi, black: true, left: whitesSoFar * whiteWidth - blackWidth / 2, width: blackWidth };
    return { semi, black: false, left: whitesSoFar++ * whiteWidth, width: whiteWidth };
  });
}
