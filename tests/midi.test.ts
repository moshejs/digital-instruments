import { describe, expect, it } from 'vitest';
import { BPM, GM, PPQ, TEMPO_US, bendValue, encodeMidi, midiVelocity, msToTicks, vlq } from '../src/lib/midi';
import { CONTROL_INTERVAL_MS, TakeRecorder, finaliseTake, type TakeEvent } from '../src/lib/take';
import { parseMidi, type ParsedEvent } from './helpers/parse-midi';

/** A clock the tests move by hand. */
function clock(start = 1000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

const notes = (events: ParsedEvent[]) =>
  events.filter((e) => e.type === 'noteOn' || e.type === 'noteOff').map((e) => [e.type, e.tick, e.data[0], e.data[1]]);

describe('variable-length quantities', () => {
  it('encodes the boundary values from the MIDI spec', () => {
    expect(vlq(0)).toEqual([0x00]);
    expect(vlq(0x40)).toEqual([0x40]);
    expect(vlq(0x7f)).toEqual([0x7f]);
    expect(vlq(0x80)).toEqual([0x81, 0x00]);
    expect(vlq(0x2000)).toEqual([0xc0, 0x00]);
    expect(vlq(0x3fff)).toEqual([0xff, 0x7f]);
    expect(vlq(0x4000)).toEqual([0x81, 0x80, 0x00]);
    expect(vlq(0x1fffff)).toEqual([0xff, 0xff, 0x7f]);
    expect(vlq(0x200000)).toEqual([0x81, 0x80, 0x80, 0x00]);
    expect(vlq(0x0fffffff)).toEqual([0xff, 0xff, 0xff, 0x7f]);
  });

  it('refuses values a VLQ cannot hold', () => {
    expect(() => vlq(-1)).toThrow(RangeError);
    expect(() => vlq(0x10000000)).toThrow(RangeError);
    expect(() => vlq(1.5)).toThrow(RangeError);
  });
});

describe('timing and ranges', () => {
  it('runs at 120 BPM, 480 ticks per quarter: 960 ticks a second', () => {
    expect(PPQ).toBe(480);
    expect(BPM).toBe(120);
    expect(TEMPO_US).toBe(500_000);
    expect(msToTicks(0)).toBe(0);
    expect(msToTicks(1000)).toBe(960);
    expect(msToTicks(500)).toBe(480); // one quarter note
    expect(msToTicks(1.04)).toBe(1);
    expect(msToTicks(0.4)).toBe(0);
    expect(msToTicks(-5)).toBe(0);
  });

  it('keeps velocities in 1…127 (0 would mean note-off)', () => {
    expect(midiVelocity(0)).toBe(1);
    expect(midiVelocity(1)).toBe(127);
    expect(midiVelocity(2)).toBe(127);
    expect(midiVelocity(0.5)).toBe(64);
  });

  it('maps bends onto the 14-bit range around 8192', () => {
    expect(bendValue(0, 18)).toBe(8192);
    expect(bendValue(18, 18)).toBe(16383);
    expect(bendValue(-18, 18)).toBe(0);
    expect(bendValue(9, 18)).toBe(12288);
    expect(bendValue(40, 18)).toBe(16383);
  });

  it('does not let rounding drift: deltas come from absolute ticks', () => {
    // 300 notes every 333.3 ms: rounding each delta separately would drift by tens of ticks
    const events: TakeEvent[] = [];
    for (let i = 0; i < 300; i++) {
      events.push({ t: i * 333.3, kind: 'on', note: 60, velocity: 0.8 }, { t: i * 333.3 + 100, kind: 'off', note: 60 });
    }
    const parsed = parseMidi(encodeMidi({ name: 'drift', events }));
    const ons = parsed.tracks[0].filter((e) => e.type === 'noteOn');
    expect(ons.at(-1)!.tick).toBe(msToTicks(299 * 333.3));
  });
});

describe('the MIDI file', () => {
  it('writes a valid format-0 file that reads back event for event', () => {
    const events: TakeEvent[] = [
      { t: 0, kind: 'on', note: 60, velocity: 1 },
      { t: 250, kind: 'on', note: 64, velocity: 0.5 },
      { t: 500, kind: 'off', note: 60 },
      { t: 750, kind: 'off', note: 64 },
      { t: 1000, kind: 'on', note: 67, velocity: 0.75 },
      { t: 2000, kind: 'off', note: 67 },
    ];
    const bytes = encodeMidi({ name: 'Steelpan', events, program: GM.steelDrums });
    const midi = parseMidi(bytes);
    expect(midi.format).toBe(0);
    expect(midi.division).toBe(480);
    expect(midi.tracks).toHaveLength(1);
    const track = midi.tracks[0];
    expect(String.fromCharCode(...track.find((e) => e.metaType === 0x03)!.data)).toBe('Steelpan');
    expect(track.find((e) => e.metaType === 0x51)!.data).toEqual([0x07, 0xa1, 0x20]);
    expect(track.find((e) => e.type === 'program')!.data).toEqual([114]);
    expect(notes(track)).toEqual([
      ['noteOn', 0, 60, 127],
      ['noteOn', 240, 64, 64],
      ['noteOff', 480, 60, 64],
      ['noteOff', 720, 64, 64],
      ['noteOn', 960, 67, 95],
      ['noteOff', 1920, 67, 64],
    ]);
    const last = track.at(-1)!;
    expect(last.metaType).toBe(0x2f);
    expect(last.tick).toBe(1920);
    expect(track.every((e) => e.channel === undefined || e.channel === 0)).toBe(true);
  });

  it('omits the program change when there is no honest General MIDI match', () => {
    const track = parseMidi(encodeMidi({ name: 'Glass harp', events: [] })).tracks[0];
    expect(track.some((e) => e.type === 'program')).toBe(false);
  });

  it('writes an empty take as a valid file with only its meta events', () => {
    const midi = parseMidi(encodeMidi({ name: 'Empty', events: [] }));
    expect(midi.tracks[0].map((e) => e.metaType)).toEqual([0x03, 0x51, 0x58, 0x2f]);
    expect(midi.tracks[0].at(-1)!.tick).toBe(0);
  });

  it('sets the pitch-bend range with RPN 0 and writes bends and expression', () => {
    const events: TakeEvent[] = [
      { t: 0, kind: 'bend', semitones: -6 },
      { t: 0, kind: 'expression', value: 0.5 },
      { t: 0, kind: 'on', note: 66, velocity: 100 / 127 },
      { t: 100, kind: 'bend', semitones: 3.5 },
      { t: 200, kind: 'off', note: 66 },
    ];
    const track = parseMidi(encodeMidi({ name: 'Theremin', events, bendRange: 18 })).tracks[0];
    const ccs = track.filter((e) => e.type === 'controller').map((e) => e.data);
    expect(ccs.slice(0, 6)).toEqual([[101, 0], [100, 0], [6, 18], [38, 0], [101, 127], [100, 127]]);
    expect(ccs[6]).toEqual([11, 64]);
    const bends = track.filter((e) => e.type === 'pitchBend').map((e) => [e.tick, e.data[0] | (e.data[1] << 7)]);
    expect(bends).toEqual([[0, 8192], [0, bendValue(-6, 18)], [96, bendValue(3.5, 18)]]);
    // the RPN comes before any bend, and the bend before the note it shapes
    const firstBend = track.findIndex((e) => e.type === 'pitchBend');
    const rpn = track.findIndex((e) => e.type === 'controller' && e.data[0] === 6);
    const on = track.findIndex((e) => e.type === 'noteOn');
    expect(rpn).toBeLessThan(firstBend);
    expect(firstBend).toBeLessThan(on);
  });
});

describe('recording a take', () => {
  it('records held notes with their real timing and velocity', () => {
    const c = clock();
    const rec = new TakeRecorder(c.now);
    rec.start();
    c.advance(100);
    rec.noteOn(60, 0.8);
    c.advance(400);
    rec.noteOn(64, 0.5);
    c.advance(100);
    rec.noteOff(60);
    c.advance(300);
    const take = rec.stop();
    expect(take.noteCount).toBe(2);
    expect(take.events).toEqual([
      { t: 100, kind: 'on', note: 60, velocity: 0.8 },
      { t: 500, kind: 'on', note: 64, velocity: 0.5 },
      { t: 600, kind: 'off', note: 60 },
      { t: 900, kind: 'off', note: 64 }, // still held at Stop: released there
    ]);
    expect(take.durationMs).toBe(900);
  });

  it('gives struck notes the length the instrument rings for', () => {
    const c = clock();
    const rec = new TakeRecorder(c.now);
    rec.start();
    rec.noteOn(70, 1, 1800);
    c.advance(200);
    const take = rec.stop();
    // the ring outlasts Stop and is kept, so the last note is not chopped
    expect(take.events).toEqual([
      { t: 0, kind: 'on', note: 70, velocity: 1 },
      { t: 1800, kind: 'off', note: 70 },
    ]);
  });

  it('ends a ringing note before the same pitch is struck again, and drops its stale ring-out', () => {
    const c = clock();
    const rec = new TakeRecorder(c.now);
    rec.start();
    rec.noteOn(62, 1, 2000);
    c.advance(500);
    rec.noteOn(62, 0.6, 2000);
    c.advance(100);
    const take = rec.stop();
    expect(take.events).toEqual([
      { t: 0, kind: 'on', note: 62, velocity: 1 },
      { t: 500, kind: 'off', note: 62 },
      { t: 500, kind: 'on', note: 62, velocity: 0.6 },
      { t: 2500, kind: 'off', note: 62 }, // the first note's off at 2000 would have cut this one short
    ]);
    // and the file has balanced, non-overlapping pairs
    const track = parseMidi(encodeMidi({ name: 'x', events: take.events })).tracks[0];
    let held = 0;
    for (const e of track) {
      if (e.type === 'noteOn') expect(++held).toBe(1);
      if (e.type === 'noteOff') expect(--held).toBe(0);
    }
  });

  it('handles two fingers on the same held note (glass harp): one note, ended once', () => {
    const take = finaliseTake([
      { t: 0, kind: 'on', note: 72, velocity: 0.5, id: 1 },
      { t: 100, kind: 'on', note: 72, velocity: 0.5, id: 2 },
      { t: 300, kind: 'off', note: 72, ends: 1 },
      { t: 400, kind: 'off', note: 72, ends: 2 },
    ] as Parameters<typeof finaliseTake>[0]);
    expect(take.events.map((e) => [e.t, e.kind])).toEqual([[0, 'on'], [100, 'off'], [100, 'on'], [400, 'off']]);
  });

  it('ignores note-offs for notes it never saw start, and notes outside 0…127', () => {
    const c = clock();
    const rec = new TakeRecorder(c.now);
    rec.start();
    rec.noteOff(60);
    rec.noteOn(128, 1);
    rec.noteOn(-1, 1);
    expect(rec.stop().events).toEqual([]);
  });

  it('records nothing before Record or after Stop, and starts clean each time', () => {
    const c = clock();
    const rec = new TakeRecorder(c.now);
    rec.noteOn(60, 1, 100);
    rec.start();
    rec.noteOn(61, 1, 100);
    rec.stop();
    rec.noteOn(62, 1, 100);
    rec.start();
    const take = rec.stop();
    expect(take.events).toEqual([]);
    expect(take.noteCount).toBe(0);
  });

  it('stops at the time limit and closes held notes at the limit itself', () => {
    const c = clock();
    const hits: string[] = [];
    const rec = new TakeRecorder(c.now, { maxMs: 1000, maxEvents: 100 }, (r) => hits.push(r));
    rec.start();
    rec.noteOn(60, 1);
    c.advance(1250); // the page's timer notices a little late
    rec.tick();
    expect(rec.recording).toBe(false);
    expect(rec.stopReason).toBe('duration');
    expect(hits).toEqual(['duration']);
    rec.noteOn(62, 1);
    expect(rec.stop().events).toEqual([
      { t: 0, kind: 'on', note: 60, velocity: 1 },
      { t: 1000, kind: 'off', note: 60 },
    ]);
  });

  it('stops at the event limit without leaving a note hanging', () => {
    const c = clock();
    const hits: string[] = [];
    const rec = new TakeRecorder(c.now, { maxMs: 60_000, maxEvents: 10 }, (r) => hits.push(r));
    rec.start();
    for (let i = 0; i < 20; i++) {
      rec.noteOn(60 + i, 1);
      c.advance(10);
    }
    expect(rec.recording).toBe(false);
    expect(rec.stopReason).toBe('events');
    expect(hits).toEqual(['events']);
    const take = rec.stop();
    expect(take.events.length).toBeLessThanOrEqual(10);
    const ons = take.events.filter((e) => e.kind === 'on').length;
    const offs = take.events.filter((e) => e.kind === 'off').length;
    expect(ons).toBe(offs);
  });

  it('samples continuous controls at most every 20 ms, only on change, and keeps the last value', () => {
    const c = clock();
    const rec = new TakeRecorder(c.now);
    rec.start();
    rec.bend(0);
    rec.noteOn(66, 0.8);
    for (let i = 1; i <= 10; i++) {
      c.advance(5); // a 200 Hz pointer
      rec.bend(i * 0.1);
    }
    rec.bend(1); // unchanged
    c.advance(5);
    rec.noteOff(66);
    const bends = rec.stop().events.filter((e) => e.kind === 'bend');
    for (let i = 1; i < bends.length - 1; i++) expect(bends[i].t - bends[i - 1].t).toBeGreaterThanOrEqual(CONTROL_INTERVAL_MS);
    expect(bends.at(-1)).toMatchObject({ kind: 'bend', semitones: 1 });
    expect(bends.length).toBeLessThan(6);
  });
});
