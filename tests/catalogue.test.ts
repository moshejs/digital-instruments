import { describe, expect, it } from 'vitest';
import { SONGS, findSong } from '../src/data/songs';
import { isPlayable, unavailableReason, type InstrumentSlug } from '../src/data/availability';
import { INSTRUMENTS } from '../src/data/instruments';
import { REST, midiToName, noteToMidi } from '../src/lib/music';
import { buildTines, kalimbaNumber, KALIMBA_KEYMAP, KALIMBA_NOTES } from '../src/lib/kalimba-layout';
import { buildGlasses } from '../src/lib/glass-layout';
import {
  C_MAJOR_LEVERS, HARP_KEYS, HARP_STRINGS, chooseFingering, countFlips, fingeringsFor, leverPreset, sounds, stringGeometry, stringLabel,
} from '../src/lib/harp';

const melody = (id: string) => findSong(id)!.notes.filter((n) => n.note !== REST).map((n) => n.note);

describe('catalogue', () => {
  it('lists five instruments with unique slugs and catalogue numbers in order', () => {
    expect(INSTRUMENTS.map((i) => i.slug)).toEqual(['steelpan', 'theremin', 'kalimba', 'glass-harp', 'harp']);
    INSTRUMENTS.forEach((inst, i) => expect(inst.catalogNo).toBe(`No. 0${i + 1}`));
  });
});

describe('song availability', () => {
  const slugs: InstrumentSlug[] = ['steelpan', 'theremin', 'glass-harp', 'harp'];

  it.each(slugs)('the %s plays all fifteen songs', (slug) => {
    expect(SONGS.filter((s) => isPlayable(slug, s))).toHaveLength(15);
  });

  it('the C-major kalimba plays exactly the songs without accidentals', () => {
    const playable = SONGS.filter((s) => isPlayable('kalimba', s)).map((s) => s.id).sort();
    expect(playable).toEqual(['amazing-grace', 'mary-had-a-little-lamb', 'ode-to-joy', 'oh-susanna', 'twinkle-twinkle', 'when-the-saints',
      'jingle-bells', 'silent-night', 'we-wish-you-a-merry-christmas', 'auld-lang-syne', 'happy-birthday', 'frere-jacques'].sort());
  });

  it('explains why a song is unavailable', () => {
    expect(unavailableReason('kalimba', findSong('greensleeves')!)).toBe('Needs G♯4 — this kalimba is tuned to C major');
    expect(unavailableReason('kalimba', findSong('londonderry-air')!)).toContain('A♯4');
    expect(unavailableReason('harp', findSong('greensleeves')!)).toBeNull();
  });
});

describe('kalimba', () => {
  const tines = buildTines();

  it('has 17 tines, C4–E6 in C major, each once', () => {
    expect(tines).toHaveLength(17);
    expect(new Set(tines.map((t) => t.note)).size).toBe(17);
    expect(KALIMBA_NOTES.every((n) => !n.includes('#'))).toBe(true);
  });

  it('puts the lowest tine in the middle and alternates outward like the real instrument', () => {
    const order = [...tines].sort((a, b) => a.slot - b.slot).map((t) => t.note);
    expect(order).toEqual(['D6', 'B5', 'G5', 'E5', 'C5', 'A4', 'F4', 'D4', 'C4', 'E4', 'G4', 'B4', 'D5', 'F5', 'A5', 'C6', 'E6']);
  });

  it('makes lower tines longer', () => {
    const byPitch = [...tines].sort((a, b) => noteToMidi(a.note) - noteToMidi(b.note));
    byPitch.slice(1).forEach((t, i) => expect(t.length).toBeLessThan(byPitch[i].length));
  });

  it('writes kalimba number tabs with octave dots', () => {
    expect(kalimbaNumber('C4')).toEqual({ digit: 1, dots: 0 });
    expect(kalimbaNumber('G5')).toEqual({ digit: 5, dots: 1 });
    expect(kalimbaNumber('E6')).toEqual({ digit: 3, dots: 2 });
  });

  it('maps a key to every tine', () => {
    expect(new Set(Object.values(KALIMBA_KEYMAP))).toEqual(new Set(KALIMBA_NOTES));
  });
});

describe('glass harp', () => {
  const glasses = buildGlasses();

  it('has 25 chromatic glasses, naturals in front and sharps behind', () => {
    expect(glasses).toHaveLength(25);
    expect(glasses.filter((g) => g.row === 'front').every((g) => !g.note.includes('#'))).toBe(true);
    expect(glasses.filter((g) => g.row === 'back').every((g) => g.note.includes('#'))).toBe(true);
    const midis = glasses.map((g) => noteToMidi(g.note)).sort((a, b) => a - b);
    midis.forEach((m, i) => expect(m).toBe(60 + i));
  });

  it('places each sharp between its neighbouring naturals', () => {
    const at = (n: string) => glasses.find((g) => g.note === n)!.x;
    expect(at('C#4')).toBeGreaterThan(at('C4'));
    expect(at('C#4')).toBeLessThan(at('D4'));
    expect(at('A#5')).toBeGreaterThan(at('A5'));
    expect(at('A#5')).toBeLessThan(at('B5'));
  });

  it('fills lower glasses with more water', () => {
    const byPitch = [...glasses].sort((a, b) => noteToMidi(a.note) - noteToMidi(b.note));
    byPitch.slice(1).forEach((g, i) => expect(g.water).toBeLessThan(byPitch[i].water));
  });
});

describe('lever harp', () => {
  it('has 15 strings tuned C D E♭ F G A♭ B♭, with red Cs and blue Fs', () => {
    expect(HARP_STRINGS).toHaveLength(15);
    expect(HARP_STRINGS.slice(0, 7).map((s) => s.name)).toEqual(['C4', 'D4', 'E♭4', 'F4', 'G4', 'A♭4', 'B♭4']);
    expect(HARP_STRINGS.filter((s) => s.colour === 'c').map((s) => s.name)).toEqual(['C4', 'C5', 'C6']);
    expect(HARP_STRINGS.filter((s) => s.colour === 'f').map((s) => s.name)).toEqual(['F4', 'F5']);
  });

  it('reaches every chromatic note from C4 to C6 with levers', () => {
    for (let m = 60; m <= 84; m++) expect(fingeringsFor(midiToName(m)).length).toBeGreaterThan(0);
  });

  it('defaults to C major and spells raised strings correctly', () => {
    const cMajor = HARP_STRINGS.map((s, i) => midiToName(s.midi + (C_MAJOR_LEVERS[i] ? 1 : 0)).replace(/\d/, ''));
    expect(new Set(cMajor)).toEqual(new Set(['C', 'D', 'E', 'F', 'G', 'A', 'B']));
    expect(stringLabel(2, true)).toBe('E');
    expect(stringLabel(3, true)).toBe('F♯');
    expect(stringLabel(6, false)).toBe('B♭');
  });

  it.each(SONGS.map((s) => [s.title, s.id] as const))('plays %s note-perfectly with auto levers', (_title, id) => {
    const notes = melody(id);
    const levers = leverPreset(notes);
    for (const note of notes) {
      const f = chooseFingering(note, levers)!;
      levers[f.index] = f.lever; // flip if needed, as the app does
      expect(sounds(f)).toBe(note);
    }
  });

  it('needs no mid-song flips for single-key songs', () => {
    for (const id of ['ode-to-joy', 'amazing-grace', 'scarborough-fair', 'londonderry-air', 'oh-susanna']) {
      expect(countFlips(melody(id), leverPreset(melody(id)))).toBe(0);
    }
  });

  it('flips levers mid-song for Greensleeves, which uses both G and G♯', () => {
    expect(countFlips(melody('greensleeves'), leverPreset(melody('greensleeves')))).toBeGreaterThan(0);
  });

  it('draws long bass strings on the left, short treble strings on the right', () => {
    const lengths = HARP_STRINGS.map((_, i) => stringGeometry(i)).map((g) => g.bottom - g.top);
    lengths.slice(1).forEach((len, i) => expect(len).toBeLessThan(lengths[i]));
    expect(lengths[14]).toBeGreaterThan(30);
  });

  it('assigns one key per string', () => {
    expect(HARP_KEYS).toHaveLength(HARP_STRINGS.length);
    expect(new Set(HARP_KEYS).size).toBe(HARP_KEYS.length);
  });
});
