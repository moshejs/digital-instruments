/**
 * The songbook shared by every instrument.
 *
 * Every melody is public domain / traditional. Each was transcribed and then
 * independently re-derived note-by-note by a second pass that corrected errors
 * (e.g. Scarborough Fair restored to its raised-sixth Dorian mode).
 * All notes sit between C4 and C6, so they fit both the steelpan and the theremin.
 */
import { REST, canonicalNote } from '../lib/music';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface NoteEvent {
  /** Scientific pitch, sharp-spelled ("A#4"), or "REST". */
  note: string;
  /** Duration in beats: quarter = 1, eighth = 0.5, half = 2. */
  beats: number;
  /** Lyric or solfège syllable shown in the guide; may be empty. */
  lyric: string;
}

export interface Song {
  id: string;
  title: string;
  origin: string;
  key: string;
  tempo: number;
  timeSignature: string;
  difficulty: Difficulty;
  description: string;
  notes: NoteEvent[];
}

type Raw = [note: string, beats: number, lyric?: string];

function song(meta: Omit<Song, 'notes'>, seq: Raw[]): Song {
  return {
    ...meta,
    notes: seq.map(([note, beats, lyric = '']) => ({ note: canonicalNote(note), beats, lyric })),
  };
}

export const SONGS: Song[] = [
  song(
    {
      id: 'twinkle-twinkle',
      title: 'Twinkle Twinkle Little Star',
      origin: 'French folk tune, 1761',
      key: 'C major',
      tempo: 100,
      timeSignature: '4/4',
      difficulty: 'Easy',
      description: 'The gentlest start — small steps that teach you where the notes live.',
    },
    [
      ['C4', 1, 'Twin-'], ['C4', 1, 'kle'], ['G4', 1, 'twin-'], ['G4', 1, 'kle'], ['A4', 1, 'lit-'], ['A4', 1, 'tle'], ['G4', 2, 'star'],
      ['F4', 1, 'How'], ['F4', 1, 'I'], ['E4', 1, 'won-'], ['E4', 1, 'der'], ['D4', 1, 'what'], ['D4', 1, 'you'], ['C4', 2, 'are'],
      ['G4', 1, 'Up'], ['G4', 1, 'a-'], ['F4', 1, 'bove'], ['F4', 1, 'the'], ['E4', 1, 'world'], ['E4', 1, 'so'], ['D4', 2, 'high'],
      ['G4', 1, 'Like'], ['G4', 1, 'a'], ['F4', 1, 'dia-'], ['F4', 1, 'mond'], ['E4', 1, 'in'], ['E4', 1, 'the'], ['D4', 2, 'sky'],
      ['C4', 1, 'Twin-'], ['C4', 1, 'kle'], ['G4', 1, 'twin-'], ['G4', 1, 'kle'], ['A4', 1, 'lit-'], ['A4', 1, 'tle'], ['G4', 2, 'star'],
      ['F4', 1, 'How'], ['F4', 1, 'I'], ['E4', 1, 'won-'], ['E4', 1, 'der'], ['D4', 1, 'what'], ['D4', 1, 'you'], ['C4', 2, 'are'],
    ],
  ),
  song(
    {
      id: 'mary-had-a-little-lamb',
      title: 'Mary Had a Little Lamb',
      origin: 'American nursery rhyme, 1830',
      key: 'C major',
      tempo: 100,
      timeSignature: '4/4',
      difficulty: 'Easy',
      description: 'Four neighbouring notes and one leap — a classroom favourite to learn first.',
    },
    [
      ['E4', 1, 'Ma-'], ['D4', 1, 'ry'], ['C4', 1, 'had'], ['D4', 1, 'a'], ['E4', 1, 'lit-'], ['E4', 1, 'tle'], ['E4', 2, 'lamb,'],
      ['D4', 1, 'lit-'], ['D4', 1, 'tle'], ['D4', 2, 'lamb,'], ['E4', 1, 'lit-'], ['G4', 1, 'tle'], ['G4', 2, 'lamb,'],
      ['E4', 1, 'Ma-'], ['D4', 1, 'ry'], ['C4', 1, 'had'], ['D4', 1, 'a'], ['E4', 1, 'lit-'], ['E4', 1, 'tle'], ['E4', 1, 'lamb,'],
      ['E4', 1, 'its'], ['D4', 1, 'fleece'], ['D4', 1, 'was'], ['E4', 1, 'white'], ['D4', 1, 'as'], ['C4', 4, 'snow.'],
    ],
  ),
  song(
    {
      id: 'ode-to-joy',
      title: 'Ode to Joy',
      origin: 'Beethoven, Symphony No. 9, 1824',
      key: 'C major',
      tempo: 100,
      timeSignature: '4/4',
      difficulty: 'Easy',
      description: 'Almost entirely stepwise — the melody everyone can hum.',
    },
    [
      ['E4', 1, 'Joy-'], ['E4', 1, 'ful,'], ['F4', 1, 'joy-'], ['G4', 1, 'ful,'], ['G4', 1, 'we'], ['F4', 1, 'a-'], ['E4', 1, 'dore'], ['D4', 1, 'thee'],
      ['C4', 1, 'God'], ['C4', 1, 'of'], ['D4', 1, 'glo-'], ['E4', 1, 'ry,'], ['E4', 1.5, 'Lord'], ['D4', 0.5, 'of'], ['D4', 2, 'love'],
      ['E4', 1, 'Hearts'], ['E4', 1, 'un-'], ['F4', 1, 'fold'], ['G4', 1, 'like'], ['G4', 1, 'flowers'], ['F4', 1, 'be-'], ['E4', 1, 'fore'], ['D4', 1, 'thee'],
      ['C4', 1, 'op-'], ['C4', 1, 'ening'], ['D4', 1, 'to'], ['E4', 1, 'the'], ['D4', 1.5, 'sun'], ['C4', 0.5, 'a-'], ['C4', 2, 'bove'],
    ],
  ),
  song(
    {
      id: 'when-the-saints',
      title: 'When the Saints Go Marching In',
      origin: 'American gospel standard',
      key: 'C major',
      tempo: 120,
      timeSignature: '4/4',
      difficulty: 'Medium',
      description: 'Five notes, C to G, with an irresistible calypso bounce.',
    },
    [
      ['C4', 1, 'Oh'], ['E4', 1, 'when'], ['F4', 1, 'the'], ['G4', 2, 'saints'], [REST, 1],
      ['C4', 1, 'go'], ['E4', 1, 'march-'], ['F4', 1, 'ing'], ['G4', 2, 'in'], [REST, 1],
      ['C4', 1, 'Oh'], ['E4', 1, 'when'], ['F4', 1, 'the'], ['G4', 2, 'saints'], ['E4', 1, 'go'], ['C4', 1, 'march-'], ['E4', 1, 'ing'], ['D4', 3, 'in'], [REST, 1],
      ['E4', 1, 'Oh'], ['E4', 1, 'how'], ['D4', 1, 'I'], ['C4', 1, 'want'], ['C4', 1, 'to'], ['E4', 1, 'be'], ['G4', 1, 'in'], ['G4', 1, 'that'], ['G4', 1, 'num-'], ['F4', 2, 'ber'], [REST, 1],
      ['E4', 1, 'When'], ['F4', 1, 'the'], ['G4', 2, 'saints'], ['E4', 1, 'go'], ['C4', 1, 'march-'], ['D4', 1, 'ing'], ['C4', 4, 'in'],
    ],
  ),
  song(
    {
      id: 'amazing-grace',
      title: 'Amazing Grace',
      origin: 'Hymn tune "New Britain", 1829',
      key: 'G major',
      tempo: 72,
      timeSignature: '3/4',
      difficulty: 'Medium',
      description: 'A lilting hymn in three that climbs to a long, ringing D5.',
    },
    [
      ['D4', 1, 'A-'], ['G4', 2, 'ma-'], ['B4', 0.5, 'zing'], ['G4', 0.5], ['B4', 2, 'grace'], ['A4', 1, 'how'], ['G4', 2, 'sweet'], ['E4', 1, 'the'], ['D4', 2, 'sound'],
      ['D4', 1, 'that'], ['G4', 2, 'saved'], ['B4', 0.5, 'a'], ['G4', 0.5], ['B4', 2, 'wretch'], ['A4', 1, 'like'], ['D5', 3, 'me'],
      ['D5', 1, 'I'], ['B4', 2, 'once'], ['G4', 0.5, 'was'], ['B4', 0.5], ['A4', 2, 'lost'], ['G4', 1, 'but'], ['E4', 2, 'now'], ['D4', 1, 'am'], ['D4', 2, 'found'],
      ['D4', 1, 'was'], ['G4', 2, 'blind'], ['B4', 0.5, 'but'], ['G4', 0.5], ['B4', 2, 'now'], ['A4', 1, 'I'], ['G4', 2, 'see'], ['D4', 1], ['G4', 3],
    ],
  ),
  song(
    {
      id: 'oh-susanna',
      title: 'Oh! Susanna',
      origin: 'Stephen Foster, 1848',
      key: 'C major',
      tempo: 120,
      timeSignature: '2/4',
      difficulty: 'Medium',
      description: 'A bouncy, syncopated campfire romp — quick eighth notes keep you honest.',
    },
    [
      ['C4', 0.5, 'I'], ['D4', 0.5, 'come'], ['E4', 1, 'from'], ['G4', 1, 'Al-'], ['G4', 0.5, 'a-'], ['A4', 0.5, 'ba-'], ['G4', 1, 'ma'], ['E4', 1, 'with'],
      ['C4', 0.5, 'my'], ['D4', 0.5, 'ban-'], ['E4', 1, 'jo'], ['D4', 0.5, 'on'], ['C4', 0.5, 'my'], ['D4', 2, 'knee'], [REST, 0.5],
      ['C4', 0.5, "I'm"], ['D4', 0.5, "goin'"], ['E4', 1, 'to'], ['G4', 1, 'Lou-'], ['G4', 0.5, 'si-'], ['A4', 0.5, 'an-'], ['G4', 1, 'a'], ['E4', 1, 'my'],
      ['C4', 0.5, 'true'], ['D4', 0.5, 'love'], ['E4', 1, 'for'], ['D4', 1, 'to'], ['C4', 2, 'see'], [REST, 0.5],
      ['F4', 1, 'Oh!'], ['F4', 1, 'Su-'], ['A4', 1, 'san-'], ['A4', 1, 'na'], ['G4', 0.5, 'oh'], ['E4', 0.5, "don't"], ['C4', 1, 'you'], ['D4', 1, 'cry'], ['E4', 1, 'for'], ['D4', 2, 'me'], [REST, 0.5],
      ['C4', 0.5, 'I'], ['D4', 0.5, 'come'], ['E4', 1, 'from'], ['G4', 1, 'Al-'], ['G4', 0.5, 'a-'], ['A4', 0.5, 'ba-'], ['G4', 1, 'ma'], ['E4', 1, 'with'],
      ['C4', 0.5, 'my'], ['D4', 0.5, 'ban-'], ['E4', 1, 'jo'], ['E4', 1, 'on'], ['D4', 0.5, 'my'], ['C4', 2, 'knee'],
    ],
  ),
  song(
    {
      id: 'greensleeves',
      title: 'Greensleeves',
      origin: 'English folk air, 16th century',
      key: 'A minor',
      tempo: 90,
      timeSignature: '6/8',
      difficulty: 'Medium',
      description: 'A haunting minor-key air in a rocking 6/8 lilt.',
    },
    [
      ['A4', 1, 'la'], ['C5', 1.5, 'do'], ['D5', 0.5, 're'], ['E5', 1, 'mi'], ['F5', 0.5, 'fa'], ['E5', 0.5, 'mi'], ['D5', 1.5, 're'], ['B4', 0.5, 'ti'],
      ['G4', 1, 'sol'], ['A4', 0.5, 'la'], ['B4', 0.5, 'ti'], ['C5', 1, 'do'], ['A4', 0.5, 'la'], ['A4', 1.5, 'la'], ['G#4', 0.5, 'si'], ['A4', 1, 'la'],
      ['B4', 0.5, 'ti'], ['G#4', 0.5, 'si'], ['E4', 1.5, 'mi'], [REST, 0.5],
      ['A4', 1, 'la'], ['C5', 1.5, 'do'], ['D5', 0.5, 're'], ['E5', 1, 'mi'], ['F5', 0.5, 'fa'], ['E5', 0.5, 'mi'], ['D5', 1.5, 're'], ['B4', 0.5, 'ti'],
      ['G4', 1, 'sol'], ['A4', 0.5, 'la'], ['B4', 0.5, 'ti'], ['C5', 1, 'do'], ['B4', 0.5, 'ti'], ['A4', 1.5, 'la'], ['G#4', 0.5, 'si'], ['A4', 1, 'la'],
      ['B4', 0.5, 'ti'], ['G#4', 0.5, 'si'], ['E4', 1.5, 'mi'], [REST, 0.5], ['A4', 3, 'la'],
    ],
  ),
  song(
    {
      id: 'scarborough-fair',
      title: 'Scarborough Fair',
      origin: 'English ballad, traditional',
      key: 'E Dorian',
      tempo: 96,
      timeSignature: '3/4',
      difficulty: 'Medium',
      description: 'An eerie ballad in true Dorian mode — slow, floating, and modal.',
    },
    [
      ['E4', 1, 'do'], ['E4', 2, 'do'], ['B4', 2, 'sol'], ['A4', 0.5, 'fa'], ['B4', 0.5, 'sol'], ['C#5', 2, 'la'], ['B4', 1, 'sol'], ['A4', 2, 'fa'], ['G4', 1, 'me'],
      ['E4', 1, 'do'], ['E4', 1, 'do'], ['D4', 1, 'te'], ['E4', 2, 'do'], [REST, 1],
      ['E4', 1, 'do'], ['E4', 2, 'do'], ['B4', 2, 'sol'], ['A4', 0.5, 'fa'], ['B4', 0.5, 'sol'], ['C#5', 2, 'la'], ['B4', 1, 'sol'], ['A4', 2, 'fa'], ['G4', 1, 'me'],
      ['E4', 2, 'do'], ['F#4', 1, 're'], ['G4', 1.5, 'me'], ['F#4', 0.5, 're'], ['E4', 1, 'do'], ['D4', 2, 'te'], [REST, 1],
      ['D4', 2, 'te'], ['G4', 1, 'me'], ['G4', 1, 'me'], ['A4', 1.5, 'fa'], ['G4', 0.5, 'me'], ['F#4', 1, 're'], ['E4', 2, 'do'], ['F#4', 1, 're'], ['B4', 1, 'sol'], ['A4', 1, 'fa'], ['B4', 2, 'sol'], [REST, 1],
      ['E5', 2, 'do'], ['B4', 1, 'sol'], ['A4', 0.5, 'fa'], ['B4', 0.5, 'sol'], ['C#5', 2, 'la'], ['B4', 1, 'sol'], ['A4', 2, 'fa'], ['G4', 1, 'me'], ['E4', 2, 'do'], ['F#4', 1, 're'], ['E4', 2, 'do'],
    ],
  ),
  song(
    {
      id: 'londonderry-air',
      title: 'Londonderry Air (Danny Boy)',
      origin: 'Irish air, traditional',
      key: 'F major',
      tempo: 66,
      timeSignature: '4/4',
      difficulty: 'Hard',
      description: 'A soaring Irish air with wide, expressive leaps — the showpiece.',
    },
    [
      ['E4', 0.5, 'ti'], ['F4', 0.5, 'do'], ['G4', 0.5, 're'], ['A4', 1.5, 'mi'], ['G4', 0.5, 're'], ['A4', 0.5, 'mi'], ['D5', 0.5, 'la'], ['C5', 0.5, 'so'], ['A4', 0.5, 'mi'], ['G4', 0.5, 're'], ['F4', 0.5, 'do'], ['D4', 1.5, 'la'],
      ['F4', 0.5, 'do'], ['A4', 0.5, 'mi'], ['Bb4', 0.5, 'fa'], ['C5', 1.5, 'so'], ['D5', 0.5, 'la'], ['C5', 0.5, 'so'], ['A4', 0.5, 'mi'], ['F4', 0.5, 'do'], ['A4', 0.5, 'mi'], ['G4', 2, 're'], [REST, 0.5],
      ['E4', 0.5, 'ti'], ['F4', 0.5, 'do'], ['G4', 0.5, 're'], ['A4', 1.5, 'mi'], ['G4', 0.5, 're'], ['A4', 0.5, 'mi'], ['D5', 0.5, 'la'], ['C5', 0.5, 'so'], ['A4', 0.5, 'mi'], ['G4', 0.5, 're'], ['F4', 0.5, 'do'], ['D4', 1.5, 'la'],
      ['E4', 0.5, 'ti'], ['F4', 0.5, 'do'], ['G4', 0.5, 're'], ['A4', 1.5, 'mi'], ['Bb4', 0.5, 'fa'], ['A4', 0.5, 'mi'], ['G4', 0.5, 're'], ['F4', 0.5, 'do'], ['G4', 0.5, 're'], ['F4', 4, 'do'],
    ],
  ),
];

export const playableCount = (s: Song): number => s.notes.filter((n) => n.note !== REST).length;

export const findSong = (id: string | null | undefined): Song | undefined =>
  id ? SONGS.find((s) => s.id === id) : undefined;
