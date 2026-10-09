/**
 * The Listen / Play Along engine for note-based instruments (steelpan, kalimba,
 * glass harp, harp). Each instrument supplies a GuideHost that knows how to make
 * sound and light itself up; this module owns the coach, the library and the
 * guide logic. It drives CoachBand.astro, SongLibrary.astro and SettingsCard.astro.
 */
import { REST } from '../../lib/music';
import { SONGS, findSong, playableCount, type Song } from '../../data/songs';
import { unavailableReason, type InstrumentSlug } from '../../data/availability';
import {
  $, $as, NoteStrip, announce, b, enterPractice, revealInstrument, initLibraryToggle, isOperatingControl, markActive,
  renderSongList, setFeedback, setProgressBar, setSongInUrl, songIdFromUrl, spoken,
} from './song-ui';

export interface GuideHost {
  /** Called on any user gesture that starts playback, to unlock Web Audio. */
  unlock(): void;
  /** Play a note on the app's behalf (Listen, Hint). */
  perform(note: string, opts: { durationMs: number; velocity: number }): void;
  /** Light the note the player should play next; null clears it. */
  showTarget(note: string | null): void;
  /** Visual feedback when the player plays the wrong note. */
  showWrong?(note: string): void;
  /** Prepare the instrument for a song (e.g. set harp levers). */
  onLoad?(song: Song): void;
  /** Stop anything the app is sustaining (glass harp). */
  silence?(): void;
  /** A little flourish when a song ends. */
  celebrate?(song: Song): void;
  /** Show notes in the instrument's own notation (kalimba tabs); defaults to note names. */
  formatNote?(note: string): string;
}

export interface GuideCopy {
  /** Instruction for Play Along, e.g. ["Strike the ", "glowing pad", " to play each note."] */
  instruction: [string, string, string];
  /** Shown after finishing a guided song. */
  done: string;
}

type Mode = 'idle' | 'listen' | 'guide';
const pretty = (note: string) => note.replace('#', '♯');

export class GuidePlayer {
  song: Song | null = null;
  mode: Mode = 'idle';
  tempo = 100;
  private idx = 0;
  private target: string | null = null;
  private praised = false;
  private timers: number[] = [];
  private readonly strip = new NoteStrip($('strip'));
  private readonly el = {
    title: $('pTitle'), meta: $('pMeta'), desc: $('pDesc'),
    listen: $as<HTMLButtonElement>('btnListen'), guide: $as<HTMLButtonElement>('btnGuide'),
    stop: $as<HTMLButtonElement>('btnStop'), hint: $as<HTMLButtonElement>('btnHint'),
    now: $('guideNow'), gnNote: $('gnNote'), gnLyric: $('gnLyric'), gnCount: $('gnCount'),
    feedback: $('feedback'), tempo: $as<HTMLInputElement>('tempo'), tempoVal: $('tempoVal'),
  };

  constructor(private readonly host: GuideHost, private readonly copy: GuideCopy) {}

  get targetNote(): string | null {
    return this.target;
  }

  /** A note as this instrument writes it. */
  private fmt(note: string): string {
    return this.host.formatNote ? this.host.formatNote(note) : pretty(note);
  }

  /** Re-render the coach after the instrument's notation setting changes. */
  refreshNotation(): void {
    if (!this.song) return;
    this.strip.build(this.song, (n) => this.fmt(n));
    if (this.mode === 'idle') return;
    this.strip.mark(this.idx);
    const n = this.song.notes[this.idx];
    if (n && n.note !== REST) this.el.gnNote.textContent = this.fmt(n.note);
  }

  feedback(kind: 'good' | 'bad' | 'info', ...parts: (string | Node)[]): void {
    setFeedback(this.el.feedback, kind, ...parts);
  }

  setTempo(bpm: number): void {
    this.tempo = bpm;
    this.el.tempo.value = String(bpm);
    this.el.tempoVal.textContent = `${bpm} BPM`;
  }

  load(song: Song, { scroll = true } = {}): void {
    this.stop();
    this.song = song;
    this.setTempo(song.tempo);
    this.el.title.textContent = song.title;
    this.el.meta.textContent = `${song.key} · ${playableCount(song)} notes`;
    this.el.desc.textContent = song.description;
    for (const btn of [this.el.listen, this.el.guide, this.el.hint]) btn.disabled = false;
    this.strip.build(song, (n) => this.fmt(n));
    this.showIdle('Ready');
    this.host.onLoad?.(song);
    enterPractice(scroll);
    this.feedback('info', b('Listen'), ' to hear it first, then ', b('Play along'), ' to learn it.');
    announce(`${song.title} loaded. Listen to hear it, or Play along to learn it.`);
  }

  private showIdle(message: string): void {
    this.strip.reset();
    setProgressBar(0);
    this.el.now.classList.add('idle');
    this.el.gnNote.textContent = '—';
    this.el.gnLyric.textContent = message;
    this.el.gnCount.textContent = `${this.song ? this.song.notes.length : 0} notes`;
  }

  private showNote(i: number, fallback: string): void {
    const n = this.song!.notes[i];
    this.strip.mark(i);
    setProgressBar(i / this.song!.notes.length);
    this.el.gnNote.textContent = n.note === REST ? '·' : this.fmt(n.note);
    this.el.gnLyric.textContent = n.lyric || (n.note === REST ? '(rest)' : fallback);
    this.el.gnCount.textContent = `note ${i + 1} of ${this.song!.notes.length}`;
  }

  private clearTimers(): void {
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [];
  }

  private setTarget(note: string | null): void {
    this.target = note;
    this.host.showTarget(note);
  }

  /** One Stop control: while listening, Listen shows "Listening…" and is pressed. */
  private setMode(mode: Mode): void {
    this.mode = mode;
    const listening = mode === 'listen';
    this.el.listen.setAttribute('aria-pressed', String(listening));
    this.el.listen.querySelector('.label')!.textContent = listening ? 'Listening…' : 'Listen';
    this.el.guide.setAttribute('aria-pressed', String(mode === 'guide'));
    this.el.stop.disabled = mode === 'idle';
    this.el.now.classList.toggle('idle', mode === 'idle');
  }

  stop(): void {
    this.clearTimers();
    this.setTarget(null);
    this.host.silence?.();
    if (this.song && this.mode !== 'idle') this.showIdle('Stopped');
    this.setMode('idle');
  }

  toggleListen(): void {
    if (!this.song) return;
    if (this.mode === 'listen') this.stop();
    else this.listen();
  }

  listen(): void {
    if (!this.song) return;
    const song = this.song;
    this.clearTimers();
    this.setTarget(null);
    this.setMode('listen');
    this.host.unlock();
    const beatMs = 60000 / this.tempo;
    let t = 260;
    song.notes.forEach((n, i) => {
      const durationMs = n.beats * beatMs;
      this.timers.push(window.setTimeout(() => {
        this.idx = i;
        this.showNote(i, '');
        if (n.note !== REST) this.host.perform(n.note, { durationMs, velocity: 0.92 });
      }, t));
      t += durationMs;
    });
    this.timers.push(window.setTimeout(() => this.finish('listen'), t + 120));
  }

  guide(): void {
    if (!this.song) return;
    this.clearTimers();
    this.host.silence?.();
    this.setMode('guide');
    this.host.unlock();
    this.praised = false;
    const [before, bold, after] = this.copy.instruction;
    this.feedback('info', before, b(bold), after);
    revealInstrument();
    this.advanceTo(0);
  }

  private advanceTo(i: number): void {
    const song = this.song!;
    this.setTarget(null);
    if (i >= song.notes.length) return this.finish('guide');
    this.idx = i;
    const n = song.notes[i];
    this.showNote(i, 'play it');
    if (n.note === REST) {
      const beatMs = 60000 / this.tempo;
      this.timers.push(window.setTimeout(() => this.advanceTo(i + 1), Math.min(n.beats * beatMs, 450)));
      return;
    }
    this.setTarget(n.note);
    announce(`Play ${spoken(n.note)}`);
  }

  /** Instruments call this whenever the player sounds a note. */
  checkHit(note: string): void {
    if (this.mode !== 'guide' || !this.target) return;
    if (note === this.target) {
      this.strip.markDone(this.idx);
      // praise once, then stay quiet so the line doesn't flicker on every note
      if (!this.praised) {
        this.feedback('good', 'Nice — keep going.');
        this.praised = true;
      }
      this.advanceTo(this.idx + 1);
    } else {
      this.praised = false;
      this.host.showWrong?.(note);
      this.feedback('bad', `That was ${this.fmt(note)} — you want `, b(this.fmt(this.target)), '.');
      announce(`That was ${spoken(note)}. You want ${spoken(this.target)}.`);
    }
  }

  hint(): void {
    if (!this.song) return;
    this.host.unlock();
    const note = this.mode === 'guide' ? this.target : this.song.notes.find((n) => n.note !== REST)?.note;
    if (note) this.host.perform(note, { durationMs: 700, velocity: 0.55 });
  }

  private finish(mode: 'listen' | 'guide'): void {
    const song = this.song!;
    this.clearTimers();
    this.setTarget(null);
    setProgressBar(1);
    this.strip.mark(song.notes.length - 1);
    this.setMode('idle');
    this.el.now.classList.remove('idle');
    this.el.gnNote.textContent = '★';
    this.el.gnLyric.textContent = mode === 'guide' ? 'You played it!' : "That's the tune!";
    this.el.gnCount.textContent = 'complete';
    if (mode === 'guide') this.feedback('good', this.copy.done);
    else this.feedback('good', 'Now press ', b('Play along'), ' to play it yourself.');
    announce(mode === 'guide' ? `You played ${song.title}!` : `Finished. Now press Play along to play it yourself.`);
    this.host.celebrate?.(song);
  }
}

/**
 * Builds the song library, wires the transport, tempo, deep links and the
 * Space / Esc shortcuts, and returns the player.
 */
export function mountGuide(slug: InstrumentSlug, host: GuideHost, copy: GuideCopy): GuidePlayer {
  const player = new GuidePlayer(host, copy);
  const buttons = renderSongList(
    $('songList'),
    SONGS,
    (song) => {
      markActive(buttons, song.id);
      setSongInUrl(song.id);
      host.unlock();
      player.load(song);
    },
    (song) => unavailableReason(slug, song),
  );
  initLibraryToggle();

  $('btnListen').addEventListener('click', () => player.toggleListen());
  $('btnGuide').addEventListener('click', () => player.guide());
  $('btnStop').addEventListener('click', () => player.stop());
  $('btnHint').addEventListener('click', () => player.hint());
  $as<HTMLInputElement>('tempo').addEventListener('input', (e) =>
    player.setTempo(Number((e.target as HTMLInputElement).value)));

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') return player.stop();
    if (e.code === 'Space' && !isOperatingControl(e.target)) {
      e.preventDefault();
      player.toggleListen();
    }
  });

  const linked = findSong(songIdFromUrl());
  if (linked && !unavailableReason(slug, linked)) {
    markActive(buttons, linked.id);
    player.load(linked, { scroll: false });
  }
  return player;
}
