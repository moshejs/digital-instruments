import { describe, expect, it } from 'vitest';
import { SONGS } from '../src/data/songs';
import { notate, pageDescription, pageTitle, phrases, songPages, songPath } from '../src/data/song-pages';

describe('song pages', () => {
  const pages = songPages();

  it('makes one page per playable song: nine per instrument, six on the C-major kalimba', () => {
    expect(pages).toHaveLength(9 * 4 + 6);
    expect(new Set(pages.map((p) => songPath(p.instrument.slug, p.song.id))).size).toBe(pages.length);
  });

  it('gives every page a unique title, and descriptions short enough for search results', () => {
    expect(new Set(pages.map(pageTitle)).size).toBe(pages.length);
    for (const page of pages) expect(pageDescription(page).length).toBeLessThanOrEqual(170);
  });

  it('writes notes in each instrument’s own notation', () => {
    expect(notate('kalimba', 'C4')).toBe('1');
    expect(notate('kalimba', 'E5')).toBe('3̇');
    expect(notate('steelpan', 'A#4')).toBe('B♭4');
    expect(notate('glass-harp', 'C#5')).toBe('C♯5');
    expect(notate('harp', 'REST')).toBe('·');
  });

  it('splits every song into sheet lines without losing a note', () => {
    for (const song of SONGS) {
      const lines = phrases(song);
      expect(lines.flat()).toEqual(song.notes);
      expect(lines.every((l) => l.length > 0)).toBe(true);
    }
  });
});
