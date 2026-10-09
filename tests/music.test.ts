import { describe, expect, it } from 'vitest';
import {
  canonicalNote, centsBetween, flatName, freqInfo, midiToFreq, midiToName, noteToFreq, noteToMidi, snapFreq,
} from '../src/lib/music';

describe('note math', () => {
  it('parses scientific pitch notation', () => {
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('F#5')).toBe(78);
    expect(noteToMidi('Bb4')).toBe(70);
    expect(noteToMidi('C6')).toBe(84);
  });

  it('rejects malformed note names', () => {
    expect(() => noteToMidi('H4')).toThrow();
    expect(() => noteToMidi('C')).toThrow();
  });

  it('tunes to A440', () => {
    expect(noteToFreq('A4')).toBeCloseTo(440, 6);
    expect(noteToFreq('C4')).toBeCloseTo(261.626, 2);
    expect(midiToFreq(81)).toBeCloseTo(880, 6);
  });

  it('spells every pitch with sharps so names compare as strings', () => {
    expect(midiToName(70)).toBe('A#4');
    expect(canonicalNote('Bb4')).toBe('A#4');
    expect(canonicalNote('Db5')).toBe('C#5');
    expect(canonicalNote('REST')).toBe('REST');
  });

  it('reports the nearest note and how far off it is', () => {
    expect(freqInfo(440)).toEqual({ name: 'A4', cents: 0, midi: 69 });
    const sharp = freqInfo(440 * Math.pow(2, 20 / 1200));
    expect(sharp.name).toBe('A4');
    expect(sharp.cents).toBe(20);
  });

  it('measures intervals in cents', () => {
    expect(centsBetween(880, 440)).toBeCloseTo(1200, 6);
    expect(centsBetween(noteToFreq('C#4'), noteToFreq('C4'))).toBeCloseTo(100, 6);
  });
});

describe('scale assist', () => {
  const quarterSharp = (note: string) => noteToFreq(note) * Math.pow(2, 30 / 1200);

  it('leaves the pitch free when off', () => {
    expect(snapFreq(quarterSharp('A4'), 'off')).toBeCloseTo(quarterSharp('A4'), 6);
  });

  it('snaps to the nearest semitone in chromatic mode', () => {
    expect(snapFreq(quarterSharp('A4'), 'chromatic')).toBeCloseTo(440, 6);
  });

  it('only lands on scale tones in C major and pentatonic', () => {
    expect(freqInfo(snapFreq(noteToFreq('F#4'), 'major')).name).toMatch(/^(F|G)4$/);
    expect(freqInfo(snapFreq(noteToFreq('F4'), 'pentatonic')).name).toMatch(/^(E|G)4$/);
    expect(freqInfo(snapFreq(noteToFreq('B4'), 'pentatonic')).name).toMatch(/^(A4|C5)$/);
  });
});

describe('flat spelling', () => {
  it('spells black notes as flats and leaves naturals and rests alone', () => {
    expect(flatName('A#4')).toBe('B♭4');
    expect(flatName('D#5')).toBe('E♭5');
    expect(flatName('C6')).toBe('C6');
    expect(flatName('REST')).toBe('REST');
  });
  it('round-trips to the same pitch', () => {
    for (const n of ['C#4', 'D#4', 'F#4', 'G#4', 'A#4']) {
      expect(canonicalNote(flatName(n).replace('♭', 'b'))).toBe(n);
    }
  });
});
