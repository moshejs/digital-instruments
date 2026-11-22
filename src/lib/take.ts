/**
 * Records a take from an instrument's own note events, with no browser APIs, so
 * the timing, limits and note bookkeeping are unit-tested. The page supplies
 * the clock (performance.now) and wires the instrument's note events in.
 *
 * Times are milliseconds from the moment Record was pressed.
 */

export type TakeEvent =
  | { t: number; kind: 'on'; note: number; velocity: number }
  | { t: number; kind: 'off'; note: number }
  /** Continuous pitch (the theremin), in semitones away from its held note. */
  | { t: number; kind: 'bend'; semitones: number }
  /** Continuous loudness 0…1 (the theremin's volume hand). */
  | { t: number; kind: 'expression'; value: number };

export interface TakeLimits {
  maxMs: number;
  maxEvents: number;
}

/** Five minutes or 20,000 events, whichever comes first. */
export const TAKE_LIMITS: TakeLimits = { maxMs: 5 * 60_000, maxEvents: 20_000 };

/** Continuous controls are sampled no faster than this, and only when they change. */
export const CONTROL_INTERVAL_MS = 20;

export type StopReason = 'user' | 'duration' | 'events';

export interface Take {
  events: TakeEvent[];
  /** From Record to the last note's end. */
  durationMs: number;
  noteCount: number;
}

/** Raw capture: an off can name the note-on it ends, so a stale ring-out never cuts a newer note. */
type RawEvent = TakeEvent & { id?: number; ends?: number };

export class TakeRecorder {
  private raw: RawEvent[] = [];
  private startedAt = 0;
  private nextId = 1;
  private held = new Map<number, number>(); // note → id of the note-on still held
  private lastControl: Partial<Record<'bend' | 'expression', { t: number; value: number }>> = {};
  private pendingControl: Partial<Record<'bend' | 'expression', { t: number; value: number }>> = {};
  recording = false;
  stopReason: StopReason | null = null;

  constructor(
    private readonly now: () => number,
    private readonly limits: TakeLimits = TAKE_LIMITS,
    /** Called once when a limit ends the recording. */
    private readonly onLimit: (reason: Exclude<StopReason, 'user'>) => void = () => {},
  ) {}

  start(): void {
    this.raw = [];
    this.held.clear();
    this.lastControl = {};
    this.pendingControl = {};
    this.nextId = 1;
    this.stopReason = null;
    this.startedAt = this.now();
    this.recording = true;
  }

  elapsed(): number {
    return this.recording ? this.now() - this.startedAt : 0;
  }

  /** Ends the recording when the time limit passes; the page calls this on a timer. */
  tick(): void {
    if (this.recording && this.elapsed() >= this.limits.maxMs) this.hitLimit('duration', this.limits.maxMs);
  }

  /**
   * A note starts. Struck and plucked notes have no release, so they pass ringMs:
   * how long the instrument's own voice rings, which becomes the note-off.
   */
  noteOn(note: number, velocity: number, ringMs?: number): void {
    if (!this.room(ringMs === undefined ? 1 : 2)) return;
    if (!Number.isInteger(note) || note < 0 || note > 127) return;
    const t = this.time();
    this.flushControls();
    const id = this.nextId++;
    this.raw.push({ t, kind: 'on', note, velocity: Math.min(1, Math.max(0, velocity)), id });
    if (ringMs === undefined) this.held.set(note, id);
    else this.raw.push({ t: t + Math.max(1, ringMs), kind: 'off', note, ends: id });
  }

  noteOff(note: number): void {
    if (!this.recording) return;
    const id = this.held.get(note);
    if (id === undefined) return;
    this.held.delete(note);
    this.flushControls();
    // an off is always allowed, even at the event limit, so no note is left hanging
    this.raw.push({ t: this.time(), kind: 'off', note, ends: id });
  }

  /** Whether a held note (one without a ring length) is still open in this take. */
  holding(note: number): boolean {
    return this.recording && this.held.has(note);
  }

  bend(semitones: number): void {
    this.control('bend', semitones, 1 / 64); // ~1.5 cents: finer than anyone hears
  }

  expression(value: number): void {
    this.control('expression', Math.min(1, Math.max(0, value)), 1 / 254);
  }

  stop(reason: StopReason = 'user'): Take {
    if (this.recording) this.finish(reason, this.time());
    return finaliseTake(this.raw);
  }

  /* ───────── internals ───────── */

  private time(): number {
    return Math.max(0, this.now() - this.startedAt);
  }

  /** Closes the take at `end`: pending control values are written and held notes released there. */
  private finish(reason: StopReason, end: number): void {
    this.recording = false;
    this.stopReason = reason;
    for (const kind of ['bend', 'expression'] as const) {
      const p = this.pendingControl[kind];
      if (p) this.push(kind, Math.min(end, p.t), p.value);
    }
    this.pendingControl = {};
    for (const [note, id] of this.held) this.raw.push({ t: end, kind: 'off', note, ends: id });
    this.held.clear();
  }

  /** Checks both limits before adding n events; ends the take if either is reached. */
  private room(n: number): boolean {
    if (!this.recording) return false;
    if (this.elapsed() >= this.limits.maxMs) {
      this.hitLimit('duration', this.limits.maxMs);
      return false;
    }
    // keep room for what finish() may still write: an off per held note and two control values
    if (this.raw.length + n + this.held.size + 2 > this.limits.maxEvents) {
      this.hitLimit('events', this.time());
      return false;
    }
    return true;
  }

  private hitLimit(reason: 'duration' | 'events', end: number): void {
    if (!this.recording) return;
    this.finish(reason, end);
    this.onLimit(reason);
  }

  private control(kind: 'bend' | 'expression', value: number, epsilon: number): void {
    if (!this.recording) return;
    const t = this.time();
    const last = this.lastControl[kind];
    if (last && Math.abs(last.value - value) < epsilon) {
      delete this.pendingControl[kind];
      return;
    }
    if (last && t - last.t < CONTROL_INTERVAL_MS) {
      this.pendingControl[kind] = { t, value }; // the latest value is written once the interval passes
      return;
    }
    if (!this.room(1)) return;
    delete this.pendingControl[kind];
    this.push(kind, t, value);
  }

  private push(kind: 'bend' | 'expression', t: number, value: number): void {
    this.lastControl[kind] = { t, value };
    this.raw.push(kind === 'bend' ? { t, kind, semitones: value } : { t, kind, value });
  }

  /** Writes any value held back by the sampling interval before a note starts or ends. */
  private flushControls(): void {
    for (const kind of ['bend', 'expression'] as const) {
      const p = this.pendingControl[kind];
      if (p) {
        delete this.pendingControl[kind];
        this.push(kind, this.time(), p.value);
      }
    }
  }
}

/**
 * Orders the events in time and makes the note bookkeeping MIDI-safe:
 * - a note struck again while it still sounds is ended first (MIDI can't hold one pitch twice on a channel);
 * - an off that belongs to an earlier, already-ended note is dropped, so it can't cut the new one short;
 * - at the same instant, offs come before ons and controls before notes.
 */
export function finaliseTake(raw: readonly RawEvent[]): Take {
  const order = (e: RawEvent) => (e.kind === 'off' ? 0 : e.kind === 'on' ? 2 : 1);
  const sorted = raw.map((e, i) => ({ e, i })).sort((a, b) => a.e.t - b.e.t || order(a.e) - order(b.e) || a.i - b.i);
  const held = new Map<number, number | undefined>();
  const events: TakeEvent[] = [];
  let noteCount = 0;
  for (const { e } of sorted) {
    if (e.kind === 'on') {
      if (held.has(e.note)) events.push({ t: e.t, kind: 'off', note: e.note });
      held.set(e.note, e.id);
      events.push({ t: e.t, kind: 'on', note: e.note, velocity: e.velocity });
      noteCount++;
    } else if (e.kind === 'off') {
      if (!held.has(e.note)) continue;
      if (e.ends !== undefined && held.get(e.note) !== e.ends) continue;
      held.delete(e.note);
      events.push({ t: e.t, kind: 'off', note: e.note });
    } else {
      events.push(e.kind === 'bend' ? { t: e.t, kind: 'bend', semitones: e.semitones } : { t: e.t, kind: 'expression', value: e.value });
    }
  }
  const last = events.at(-1);
  for (const note of held.keys()) events.push({ t: last?.t ?? 0, kind: 'off', note });
  return { events, durationMs: events.at(-1)?.t ?? 0, noteCount };
}
