import { describe, expect, it } from 'vitest';
import { SONGS, findSong, playableCount } from '../src/data/songs';
import { REST, noteToMidi } from '../src/lib/music';
import { buildPads } from '../src/lib/steelpan-layout';
import { PIANO_KEYMAP as KEYMAP, invertKeymap } from '../src/lib/keyboard';
import { FIELD_MAX_MIDI, FIELD_MIN_MIDI, freqToX, tiltToControl, xToFreq, yToVolume } from '../src/lib/theremin-field';

const NOTE_TO_KEY = invertKeymap(KEYMAP);
const pads = buildPads();
const padNotes = new Set(pads.map((p) => p.note));

describe('songbook', () => {
  it('has nine songs with unique, URL-safe ids', () => {
    expect(SONGS).toHaveLength(9);
    const ids = SONGS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it.each(SONGS.map((s) => [s.title, s] as const))('%s is well formed', (_title, song) => {
    expect(song.tempo).toBeGreaterThan(40);
    expect(song.tempo).toBeLessThan(200);
    expect(playableCount(song)).toBeGreaterThanOrEqual(20);
    for (const n of song.notes) {
      expect(n.beats).toBeGreaterThan(0);
      if (n.note === REST) continue;
      const midi = noteToMidi(n.note);
      expect(midi).toBeGreaterThanOrEqual(60); // C4
      expect(midi).toBeLessThanOrEqual(84); // C6
    }
  });

  it.each(SONGS.map((s) => [s.title, s] as const))('%s is playable on the steelpan', (_title, song) => {
    const missing = song.notes.filter((n) => n.note !== REST && !padNotes.has(n.note)).map((n) => n.note);
    expect(missing).toEqual([]);
  });

  it.each(SONGS.map((s) => [s.title, s] as const))('%s fits the theremin field', (_title, song) => {
    for (const n of song.notes) {
      if (n.note === REST) continue;
      const midi = noteToMidi(n.note);
      expect(midi).toBeGreaterThanOrEqual(FIELD_MIN_MIDI);
      expect(midi).toBeLessThanOrEqual(FIELD_MAX_MIDI);
    }
  });

  it('keeps the verified Dorian raised sixth in Scarborough Fair', () => {
    const notes = findSong('scarborough-fair')!.notes.map((n) => n.note);
    expect(notes).toContain('C#5');
    expect(notes).not.toContain('C5');
  });

  it('finds songs by id and ignores unknown ids', () => {
    expect(findSong('ode-to-joy')?.title).toBe('Ode to Joy');
    expect(findSong('nope')).toBeUndefined();
    expect(findSong(null)).toBeUndefined();
  });
});

describe('steelpan layout', () => {
  it('has 25 pads covering C4–C6 chromatically, each once', () => {
    expect(pads).toHaveLength(25);
    expect(padNotes.size).toBe(25);
    const midis = [...padNotes].map(noteToMidi).sort((a, b) => a - b);
    expect(midis[0]).toBe(60);
    expect(midis[24]).toBe(84);
    midis.forEach((m, i) => expect(m).toBe(60 + i));
  });

  it('keeps every pad inside the pan', () => {
    for (const p of pads) {
      const r = Math.hypot(p.x - 50, p.y - 50) + Math.max(p.w, p.h) / 2;
      expect(r).toBeLessThanOrEqual(50);
    }
  });

  it('maps the keyboard onto real pads, two octaves plus top C', () => {
    expect(Object.keys(KEYMAP)).toHaveLength(25);
    for (const note of Object.values(KEYMAP)) expect(padNotes.has(note)).toBe(true);
    expect(NOTE_TO_KEY['C4']).toBe('z');
    expect(NOTE_TO_KEY['C6']).toBe('i');
  });
});

describe('theremin field', () => {
  it('spans C3 to C6 left to right', () => {
    expect(xToFreq(0)).toBeCloseTo(130.81, 1);
    expect(xToFreq(1)).toBeCloseTo(1046.5, 1);
    expect(xToFreq(-1)).toBeCloseTo(xToFreq(0), 6);
  });

  it('round-trips position ↔ frequency', () => {
    for (const fx of [0.1, 0.33, 0.5, 0.9]) expect(freqToX(xToFreq(fx))).toBeCloseTo(fx, 9);
  });

  it('is loud at the top and silent along the bottom edge', () => {
    expect(yToVolume(0)).toBeCloseTo(1, 1);
    expect(yToVolume(0.98)).toBe(0);
    expect(yToVolume(0.5)).toBeGreaterThan(yToVolume(0.6));
  });

  it('turns phone roll into pitch and tilt into volume', () => {
    expect(tiltToControl(0, 0)).toEqual({ fx: 0.5, vol: 0.5 });
    const rolled = tiltToControl(32, 24);
    expect(rolled.fx).toBeCloseTo(0.9, 9);
    expect(rolled.vol).toBeCloseTo(0.9, 9);
    expect(tiltToControl(400, -400)).toEqual({ fx: 1, vol: 0 });
  });
});
