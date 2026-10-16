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
  song(
    {
      id: 'jingle-bells',
      title: 'Jingle Bells',
      origin: 'James Lord Pierpont, 1857',
      key: 'C major',
      tempo: 120,
      timeSignature: '4/4',
      difficulty: 'Easy',
      description: 'The chorus everyone knows. Mostly one note played three times, with a jump up for "hey!"',
    },
    [
      ['E4', 1, 'Jin-'], ['E4', 1, 'gle'], ['E4', 2, 'bells'], ['E4', 1, 'jin-'], ['E4', 1, 'gle'], ['E4', 2, 'bells'],
      ['E4', 1, 'jin-'], ['G4', 1, 'gle'], ['C4', 1.5, 'all'], ['D4', 0.5, 'the'], ['E4', 4, 'way'],
      ['F4', 1, 'Oh'], ['F4', 1, 'what'], ['F4', 1.5, 'fun'], ['F4', 0.5, 'it'], ['F4', 1, 'is'], ['E4', 1, 'to'], ['E4', 1, 'ride'], ['E4', 0.5, 'in'], ['E4', 0.5, 'a'],
      ['E4', 1, 'one-'], ['D4', 1, 'horse'], ['D4', 1, 'o-'], ['E4', 1, 'pen'], ['D4', 2, 'sleigh'], ['G4', 2, 'hey!'],
      ['E4', 1, 'Jin-'], ['E4', 1, 'gle'], ['E4', 2, 'bells'], ['E4', 1, 'jin-'], ['E4', 1, 'gle'], ['E4', 2, 'bells'],
      ['E4', 1, 'jin-'], ['G4', 1, 'gle'], ['C4', 1.5, 'all'], ['D4', 0.5, 'the'], ['E4', 4, 'way'],
      ['F4', 1, 'Oh'], ['F4', 1, 'what'], ['F4', 1.5, 'fun'], ['F4', 0.5, 'it'], ['F4', 1, 'is'], ['E4', 1, 'to'], ['E4', 1, 'ride'], ['E4', 0.5, 'in'], ['E4', 0.5, 'a'],
      ['G4', 1, 'one-'], ['G4', 1, 'horse'], ['F4', 1, 'o-'], ['D4', 1, 'pen'], ['C4', 4, 'sleigh'],
    ],
  ),
  song(
    {
      id: 'silent-night',
      title: 'Silent Night',
      origin: 'Franz Xaver Gruber, 1818',
      key: 'C major',
      tempo: 84,
      timeSignature: '6/8',
      difficulty: 'Medium',
      description: 'A slow rocking lullaby in six. Let the long notes ring and it sings itself.',
    },
    [
      ['G4', 1.5, 'Si-'], ['A4', 0.5], ['G4', 1, 'lent'], ['E4', 3, 'night'],
      ['G4', 1.5, 'ho-'], ['A4', 0.5], ['G4', 1, 'ly'], ['E4', 3, 'night'],
      ['D5', 2, 'All'], ['D5', 1, 'is'], ['B4', 3, 'calm'], ['C5', 2, 'all'], ['C5', 1, 'is'], ['G4', 3, 'bright'],
      ['A4', 2, 'Round'], ['A4', 1, 'yon'], ['C5', 1.5, 'vir-'], ['B4', 0.5], ['A4', 1, 'gin'], ['G4', 1.5, 'mo-'], ['A4', 0.5, 'ther'], ['G4', 1, 'and'], ['E4', 3, 'child'],
      ['A4', 2, 'Ho-'], ['A4', 1, 'ly'], ['C5', 1.5, 'in-'], ['B4', 0.5, 'fant'], ['A4', 1, 'so'], ['G4', 1.5, 'ten-'], ['A4', 0.5, 'der'], ['G4', 1, 'and'], ['E4', 3, 'mild'],
      ['D5', 2, 'Sleep'], ['D5', 1, 'in'], ['F5', 1.5, 'hea-'], ['D5', 0.5, 'ven-'], ['B4', 1, 'ly'], ['C5', 3, 'peace'], ['E5', 3, 'Sleep'],
      ['C5', 1.5, 'in'], ['G4', 0.5], ['E4', 1, 'hea-'], ['G4', 1.5, 'ven-'], ['F4', 0.5, 'ly'], ['D4', 1], ['C4', 6, 'peace'],
    ],
  ),
  song(
    {
      id: 'we-wish-you-a-merry-christmas',
      title: 'We Wish You a Merry Christmas',
      origin: 'English West Country carol, traditional',
      key: 'C major',
      tempo: 132,
      timeSignature: '3/4',
      difficulty: 'Medium',
      description: 'A brisk waltz that steps up the scale three times, each phrase a note higher than the last.',
    },
    [
      ['G4', 1, 'We'],
      ['C5', 1, 'wish'], ['C5', 0.5, 'you'], ['D5', 0.5, 'a'], ['C5', 0.5, 'mer-'], ['B4', 0.5, 'ry'], ['A4', 1, 'Christ-'], ['A4', 1, 'mas'], ['A4', 1, 'we'],
      ['D5', 1, 'wish'], ['D5', 0.5, 'you'], ['E5', 0.5, 'a'], ['D5', 0.5, 'mer-'], ['C5', 0.5, 'ry'], ['B4', 1, 'Christ-'], ['G4', 1, 'mas'], ['G4', 1, 'we'],
      ['E5', 1, 'wish'], ['E5', 0.5, 'you'], ['F5', 0.5, 'a'], ['E5', 0.5, 'mer-'], ['D5', 0.5, 'ry'], ['C5', 1, 'Christ-'], ['A4', 1, 'mas'], ['G4', 0.5, 'and'], ['G4', 0.5, 'a'],
      ['A4', 1, 'hap-'], ['D5', 1, 'py'], ['B4', 1, 'new'], ['C5', 3, 'year'],
    ],
  ),
  song(
    {
      id: 'auld-lang-syne',
      title: 'Auld Lang Syne',
      origin: 'Scottish traditional tune; words by Robert Burns, 1788',
      key: 'C major',
      tempo: 84,
      timeSignature: '4/4',
      difficulty: 'Medium',
      description: 'The New Year song. Dotted rhythms give it its lilt; lean on the long first note of each bar.',
    },
    [
      ['G4', 1, 'Should'],
      ['C5', 1.5, 'auld'], ['C5', 0.5, 'ac-'], ['C5', 1, 'quain-'], ['E5', 1, 'tance'], ['D5', 1.5, 'be'], ['C5', 0.5, 'for-'], ['D5', 1, 'got'], ['E5', 1, 'and'],
      ['C5', 1.5, 'nev-'], ['C5', 0.5, 'er'], ['E5', 1, 'brought'], ['G5', 1, 'to'], ['A5', 3, 'mind'], ['A5', 1, 'Should'],
      ['G5', 1.5, 'auld'], ['E5', 0.5, 'ac-'], ['E5', 1, 'quain-'], ['C5', 1, 'tance'], ['D5', 1.5, 'be'], ['C5', 0.5, 'for-'], ['D5', 1, 'got'], ['E5', 1, 'and'],
      ['C5', 1.5, 'days'], ['A4', 0.5, 'of'], ['A4', 1, 'auld'], ['G4', 1, 'lang'], ['C5', 3, 'syne'],
    ],
  ),
  song(
    {
      id: 'happy-birthday',
      title: 'Happy Birthday',
      origin: 'Mildred and Patty Hill, "Good Morning to All", 1893',
      key: 'C major',
      tempo: 100,
      timeSignature: '3/4',
      difficulty: 'Easy',
      description: 'Short and useful. The big octave leap on the third "birthday" is the only stretch.',
    },
    [
      ['G4', 0.75, 'Hap-'], ['G4', 0.25, 'py'], ['A4', 1, 'birth-'], ['G4', 1, 'day'], ['C5', 1, 'to'], ['B4', 2, 'you'],
      ['G4', 0.75, 'Hap-'], ['G4', 0.25, 'py'], ['A4', 1, 'birth-'], ['G4', 1, 'day'], ['D5', 1, 'to'], ['C5', 2, 'you'],
      ['G4', 0.75, 'Hap-'], ['G4', 0.25, 'py'], ['G5', 1, 'birth-'], ['E5', 1, 'day'], ['C5', 1, 'dear'], ['B4', 1, 'friend'], ['A4', 1],
      ['F5', 0.75, 'Hap-'], ['F5', 0.25, 'py'], ['E5', 1, 'birth-'], ['C5', 1, 'day'], ['D5', 1, 'to'], ['C5', 2, 'you'],
    ],
  ),
  song(
    {
      id: 'frere-jacques',
      title: 'Frère Jacques (Are You Sleeping?)',
      origin: 'French nursery round, 18th century',
      key: 'C major',
      tempo: 108,
      timeSignature: '4/4',
      difficulty: 'Easy',
      description: 'Every phrase plays twice, so you learn it in half the time. It works as a round, too.',
    },
    [
      ['C5', 1, 'Are'], ['D5', 1, 'you'], ['E5', 1, 'sleep-'], ['C5', 1, 'ing'], ['C5', 1, 'are'], ['D5', 1, 'you'], ['E5', 1, 'sleep-'], ['C5', 1, 'ing'],
      ['E5', 1, 'Bro-'], ['F5', 1, 'ther'], ['G5', 2, 'John'], ['E5', 1, 'Bro-'], ['F5', 1, 'ther'], ['G5', 2, 'John'],
      ['G5', 0.5, 'Morn-'], ['A5', 0.5, 'ing'], ['G5', 0.5, 'bells'], ['F5', 0.5, 'are'], ['E5', 1, 'ring-'], ['C5', 1, 'ing'],
      ['G5', 0.5, 'morn-'], ['A5', 0.5, 'ing'], ['G5', 0.5, 'bells'], ['F5', 0.5, 'are'], ['E5', 1, 'ring-'], ['C5', 1, 'ing'],
      ['C5', 1, 'Ding'], ['G4', 1, 'dang'], ['C5', 2, 'dong'], ['C5', 1, 'ding'], ['G4', 1, 'dang'], ['C5', 2, 'dong'],
    ],
  ),
];

export const playableCount = (s: Song): number => s.notes.filter((n) => n.note !== REST).length;

export const findSong = (id: string | null | undefined): Song | undefined =>
  id ? SONGS.find((s) => s.id === id) : undefined;
