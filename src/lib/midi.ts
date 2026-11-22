/**
 * A Standard MIDI File writer: format 0, one track, everything on channel 1.
 * No dependencies, no browser APIs, so it is unit-tested byte for byte.
 *
 * Takes arrive in milliseconds; the file runs at a fixed 120 BPM with 480 ticks
 * per quarter note, so one tick is 1.04 ms and a take keeps its real timing.
 */
import type { TakeEvent } from './take';

export const PPQ = 480;
export const BPM = 120;
/** Microseconds per quarter note at BPM. */
export const TEMPO_US = Math.round(60_000_000 / BPM);

/** General MIDI program numbers (0-based, as written in the file). */
export const GM = {
  orchestralHarp: 46,
  kalimba: 108,
  steelDrums: 114,
} as const;

export interface MidiTake {
  /** Track name, stored as a meta event. */
  name: string;
  /** Finalised events (see finaliseTake), times in milliseconds from the start. */
  events: readonly TakeEvent[];
  /** General MIDI program; omitted when no GM sound is an honest match. */
  program?: number;
  /** Pitch-bend range in semitones, sent as RPN 0 so bends land where they were played. */
  bendRange?: number;
}

/** A variable-length quantity: 7 bits per byte, most significant first, high bit set on all but the last. */
export function vlq(value: number): number[] {
  if (!Number.isInteger(value) || value < 0 || value > 0x0fffffff) throw new RangeError(`VLQ out of range: ${value}`);
  const bytes = [value & 0x7f];
  for (let v = value >>> 7; v > 0; v >>>= 7) bytes.unshift((v & 0x7f) | 0x80);
  return bytes;
}

export const msToTicks = (ms: number): number => Math.max(0, Math.round((ms * PPQ * BPM) / 60_000));

/** 0…1 → 1…127. A note-on with velocity 0 means note-off, so the floor is 1. */
export const midiVelocity = (v: number): number => Math.min(127, Math.max(1, Math.round(v * 127)));

/** Semitones of bend → the 14-bit pitch-bend value, centre 8192. */
export function bendValue(semitones: number, range: number): number {
  return Math.min(16383, Math.max(0, Math.round(8192 + (semitones / range) * 8192)));
}

const ascii = (s: string): number[] => [...s].map((c) => {
  const code = c.charCodeAt(0);
  return code >= 0x20 && code < 0x7f ? code : 0x3f; // '?' for anything outside printable ASCII
});

const u32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const u16 = (n: number) => [(n >>> 8) & 0xff, n & 0xff];
const cc = (controller: number, value: number) => [0xb0, controller, value];

export function encodeMidi(take: MidiTake): Uint8Array {
  // every message at an absolute tick, in order; deltas are taken afterwards so rounding never accumulates
  const timed: { tick: number; bytes: number[] }[] = [];
  const at = (tick: number, bytes: number[]) => timed.push({ tick, bytes });

  const name = ascii(take.name);
  at(0, [0xff, 0x03, ...vlq(name.length), ...name]);
  at(0, [0xff, 0x51, 0x03, (TEMPO_US >> 16) & 0xff, (TEMPO_US >> 8) & 0xff, TEMPO_US & 0xff]);
  at(0, [0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08]); // 4/4, 24 clocks per click, 8 32nds per quarter
  if (take.program !== undefined) at(0, [0xc0, take.program & 0x7f]);
  if (take.bendRange !== undefined) {
    const semis = Math.min(127, Math.max(1, Math.floor(take.bendRange)));
    const cents = Math.round((take.bendRange - semis) * 100) & 0x7f;
    // RPN 0 (pitch-bend sensitivity), data entry, then the null RPN so later CC 6 can't change it
    at(0, [...cc(101, 0), ...cc(100, 0), ...cc(6, semis), ...cc(38, cents), ...cc(101, 127), ...cc(100, 127)]);
    at(0, [0xe0, 0x00, 0x40]); // start from the centre
  }

  let end = 0;
  for (const e of take.events) {
    const tick = msToTicks(e.t);
    end = Math.max(end, tick);
    switch (e.kind) {
      case 'on':
        at(tick, [0x90, e.note & 0x7f, midiVelocity(e.velocity)]);
        break;
      case 'off':
        at(tick, [0x80, e.note & 0x7f, 0x40]);
        break;
      case 'bend': {
        const v = bendValue(e.semitones, take.bendRange ?? 2);
        at(tick, [0xe0, v & 0x7f, (v >> 7) & 0x7f]);
        break;
      }
      case 'expression':
        at(tick, cc(11, Math.min(127, Math.max(0, Math.round(e.value * 127)))));
        break;
    }
  }

  const track: number[] = [];
  let prev = 0;
  for (const { tick, bytes } of timed) {
    // messages sharing a tick were pushed as one run; split multi-message runs with zero deltas
    const delta = tick - prev;
    prev = tick;
    splitMessages(bytes).forEach((msg, i) => track.push(...vlq(i === 0 ? delta : 0), ...msg));
  }
  track.push(...vlq(end - prev), 0xff, 0x2f, 0x00);

  return Uint8Array.from([
    ...ascii('MThd'), ...u32(6), ...u16(0), ...u16(1), ...u16(PPQ),
    ...ascii('MTrk'), ...u32(track.length), ...track,
  ]);
}

/** Splits a run of channel messages (status + 2 data bytes each); meta events stay whole. */
function splitMessages(bytes: number[]): number[][] {
  if (bytes[0] === 0xff) return [bytes];
  const out: number[][] = [];
  for (let i = 0; i < bytes.length;) {
    const status = bytes[i] & 0xf0;
    const len = status === 0xc0 || status === 0xd0 ? 2 : 3;
    out.push(bytes.slice(i, i + len));
    i += len;
  }
  return out;
}
