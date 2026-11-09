import { describe, expect, it } from 'vitest';
import { hasSongs, isPlayable } from '../src/data/availability';
import { SONGS } from '../src/data/songs';
import { instrumentBySlug } from '../src/data/instruments';
import { songPages, songsFor } from '../src/data/song-pages';
import { midiToName } from '../src/lib/music';
import {
  MAX_OCTAVE, MIN_OCTAVE, PHONE_KEYS, PRESETS, SYNTH_KEYMAP, WIDE_KEYS,
  fmtHz, fmtPct, fmtSec, hzToPos, isBlackKey, keyMidi, layoutKeys, posToHz,
} from '../src/lib/synth';

describe('subtractive synth', () => {
  it('maps the cutoff slider logarithmically, and back', () => {
    expect(posToHz(0)).toBeCloseTo(50);
    expect(posToHz(1)).toBeCloseTo(12000);
    expect(posToHz(0.5)).toBeCloseTo(Math.sqrt(50 * 12000));
    for (const hz of [50, 600, 900, 3500, 8000, 12000]) expect(posToHz(hzToPos(hz))).toBeCloseTo(hz);
    expect(hzToPos(1)).toBe(0);
    expect(hzToPos(99999)).toBe(1);
  });

  it('keeps every preset inside the ranges its sliders offer', () => {
    for (const p of Object.values(PRESETS)) {
      expect(p.cutoff).toBeGreaterThanOrEqual(50);
      expect(p.cutoff).toBeLessThanOrEqual(12000);
      expect(p.res).toBeLessThanOrEqual(20);
      expect(p.a).toBeLessThanOrEqual(2);
      expect(p.d).toBeLessThanOrEqual(2);
      expect(p.s).toBeLessThanOrEqual(1);
      expect(p.r).toBeLessThanOrEqual(3);
      expect(p.space).toBeLessThanOrEqual(1);
    }
  });

  it('formats readouts the way the panel shows them', () => {
    expect(fmtHz(8000)).toBe('8.0 kHz');
    expect(fmtHz(600)).toBe('600 Hz');
    expect(fmtSec(0.005)).toBe('5 ms');
    expect(fmtSec(1.4)).toBe('1.40 s');
    expect(fmtPct(0.75)).toBe('75%');
  });

  it('puts A above middle C at 440 Hz on the A key in octave 4', () => {
    expect(midiToName(keyMidi(4, SYNTH_KEYMAP.a))).toBe('C4');
    expect(midiToName(keyMidi(4, SYNTH_KEYMAP.h))).toBe('A4');
    expect(midiToName(keyMidi(4, SYNTH_KEYMAP.k))).toBe('C5');
  });

  it('states its true range in the catalogue', () => {
    const range = `${midiToName(keyMidi(MIN_OCTAVE, 0))} – ${midiToName(keyMidi(MAX_OCTAVE, WIDE_KEYS - 1))}`;
    expect(instrumentBySlug('subtractive-synth').specs.find(([k]) => k === 'Range')![1]).toContain(range);
  });

  it.each([WIDE_KEYS, PHONE_KEYS])('lays out %i keys with whites edge to edge and blacks on their boundaries', (count) => {
    const keys = layoutKeys(count);
    expect(keys).toHaveLength(count);
    const whites = keys.filter((k) => !k.black);
    whites.forEach((k, i) => expect(k.left).toBeCloseTo(i * k.width));
    expect(whites.at(-1)!.left + whites.at(-1)!.width).toBeCloseTo(100);
    for (const k of keys.filter((g) => g.black)) {
      const boundary = k.left + k.width / 2;
      expect(whites.some((w) => Math.abs(w.left - boundary) < 1e-9)).toBe(true);
    }
  });

  it('knows which keys are black', () => {
    expect([...Array(13).keys()].filter(isBlackKey)).toEqual([1, 3, 6, 8, 10]);
  });

  it('has no songs, so no song pages', () => {
    expect(hasSongs('subtractive-synth')).toBe(false);
    expect(SONGS.some((s) => isPlayable('subtractive-synth', s))).toBe(false);
    expect(songsFor('subtractive-synth')).toEqual([]);
    expect(songPages().some((p) => p.instrument.slug === 'subtractive-synth')).toBe(false);
  });
});
