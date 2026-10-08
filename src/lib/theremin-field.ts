/**
 * Maps positions in the theremin's play field to sound.
 * Horizontal = pitch on a logarithmic (musical) scale, C3–C6.
 * Vertical   = volume, loud at the top, silent along the bottom edge.
 */
import { midiToFreq } from './music';

export const FIELD_MIN_MIDI = 48; // C3
export const FIELD_MAX_MIDI = 84; // C6
export const F_MIN = midiToFreq(FIELD_MIN_MIDI);
export const F_MAX = midiToFreq(FIELD_MAX_MIDI);
const LOG_SPAN = Math.log2(F_MAX / F_MIN);

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** 0 (left edge) … 1 (right edge) → frequency in Hz. */
export const xToFreq = (fx: number): number => F_MIN * Math.pow(2, clamp01(fx) * LOG_SPAN);

/** Frequency in Hz → 0 … 1 across the field. */
export const freqToX = (freq: number): number => Math.log2(freq / F_MIN) / LOG_SPAN;

/** 0 (top) … 1 (bottom) → volume 0 … 1, with a small silent strip at the bottom. */
export const yToVolume = (fy: number): number => clamp01((1 - fy - 0.04) / 0.96);

/** Phone orientation (degrees from the calibrated rest pose) → field position + volume. */
export function tiltToControl(dGamma: number, dBeta: number): { fx: number; vol: number } {
  return { fx: clamp01(0.5 + dGamma / 80), vol: clamp01(0.5 + dBeta / 60) };
}
