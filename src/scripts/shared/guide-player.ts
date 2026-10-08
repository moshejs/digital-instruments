/**
 * The Listen / Play Along engine for note-based instruments (steelpan, kalimba,
 * glass harp, harp). Each instrument supplies a GuideHost that knows how to make
 * sound and light itself up; this module owns the song panel and the guide logic.
 *
 * It drives the panel rendered by SongPanel.astro (element ids below).
 */
import { REST } from '../../lib/music';
import { SONGS, findSong, playableCount, type Song } from '../../data/songs';
import { unavailableReason, type InstrumentSlug } from '../../data/availability';
import { $, $as, NoteStrip, b, markActive, renderSongList, setFeedback, setSongInUrl, songIdFromUrl } from './song-ui';

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
}

export interface GuideCopy {
  /** Instruction for Play Along, e.g. ["Strike the ", "glowing pad", " to play each note."] */
  instruction: [string, string, string];
  /** Shown after finishing a guided song. */
  done: string;
}

type Mode = 'idle' | 'listen' | 'guide';

export class GuidePlayer {
  song: Song | null = null;
  mode: Mode = 'idle';
  tempo = 100;
  private idx = 0;
  private target: string | null = null;
  private timers: number[] = [];
  private readonly strip = new NoteStrip($('strip'));
  private readonly el = {
    title: $('pTitle'), meta: $('pMeta'), desc: $('pDesc'),
    listen: $as<HTMLButtonElement>('btnListen'), guide: $as<HTMLButtonElement>('btnGuide'),
    stop: $as<HTMLButtonElement>('btnStop'), hint: $as<HTMLButtonElement>('btnHint'),
    prog: $('progFill'), now: $('guideNow'), gnNote: $('gnNote'), gnLyric: $('gnLyric'), gnCount: $('gnCount'),
    feedback: $('feedback'), tempo: $as<HTMLInputElement>('tempo'), tempoVal: $('tempoVal'),
  };

  constructor(private readonly host: GuideHost, private readonly copy: GuideCopy) {}

  /** The note the guide is waiting for, if any. */
  get targetNote(): string | null {
    return this.target;
  }

  feedback(kind: 'good' | 'bad' | 'info', ...parts: (string | Node)[]): void {
    setFeedback(this.el.feedback, kind, ...parts);
  }

  setTempo(bpm: number): void {
    this.tempo = bpm;
    this.el.tempo.value = String(bpm);
    this.el.tempoVal.textContent = `${bpm} BPM`;
  }

  load(song: Song): void {
    this.stop();
    this.song = song;
    this.setTempo(song.tempo);
    this.el.title.textContent = song.title;
    this.el.meta.textContent = `${song.key} · ${playableCount(song)} notes`;
    this.el.desc.textContent = song.description;
    for (const btn of [this.el.listen, this.el.guide, this.el.stop, this.el.hint]) btn.disabled = false;
    this.strip.build(song);
    this.showIdle('Ready when you are');
    this.host.onLoad?.(song);
    this.feedback('info', 'Loaded. Press ', b('Listen'), ' to hear it, or ', b('Play Along'), ' to learn it.');
  }

  private showIdle(message: string): void {
    this.strip.reset();
    this.setProgress(0);
    this.el.now.classList.add('idle');
    this.el.gnNote.textContent = '—';
    this.el.gnLyric.textContent = message;
    this.el.gnCount.textContent = '—';
  }

  private setProgress(i: number): void {
    this.el.prog.style.width = `${(100 * i) / (this.song?.notes.length ?? 1)}%`;
  }

  private showNote(i: number, fallback: string): void {
    const n = this.song!.notes[i];
    this.strip.mark(i);
    this.setProgress(i);
    this.el.gnNote.textContent = n.note === REST ? '·' : n.note.replace('#', '♯');
    this.el.gnLyric.textContent = n.lyric || (n.note === REST ? '(rest)' : fallback);
    this.el.gnCount.textContent = `note ${i + 1} / ${this.song!.notes.length}`;
  }

  private clearTimers(): void {
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [];
  }

  private setTarget(note: string | null): void {
    this.target = note;
    this.host.showTarget(note);
  }

  private setListenButton(playing: boolean): void {
    const icon = document.createElement('span');
    icon.className = 'ic';
    icon.textContent = playing ? '❚❚' : '▶';
    this.el.listen.replaceChildren(icon, playing ? 'Stop' : 'Listen');
  }

  stop(): void {
    this.clearTimers();
    this.setTarget(null);
    this.host.silence?.();
    if (this.song && this.mode !== 'idle') this.showIdle('Stopped');
    this.mode = 'idle';
    this.setListenButton(false);
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
    this.mode = 'listen';
    this.el.now.classList.remove('idle');
    this.setListenButton(true);
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
    this.mode = 'guide';
    this.el.now.classList.remove('idle');
    this.setListenButton(false);
    this.host.unlock();
    const [before, bold, after] = this.copy.instruction;
    this.feedback('info', before, b(bold), after);
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
  }

  /** Instruments call this whenever the player sounds a note. */
  checkHit(note: string): void {
    if (this.mode !== 'guide' || !this.target) return;
    if (note === this.target) {
      this.strip.markDone(this.idx);
      this.setProgress(this.idx + 1);
      this.feedback('good', 'Nice — keep going!');
      this.advanceTo(this.idx + 1);
    } else {
      this.host.showWrong?.(note);
      this.feedback('bad', `That was ${note.replace('#', '♯')} — you want `, b(this.target.replace('#', '♯')), '.');
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
    this.setProgress(song.notes.length);
    this.strip.mark(song.notes.length - 1);
    this.el.gnNote.textContent = '★';
    this.el.gnLyric.textContent = mode === 'guide' ? 'You played it!' : "That's the tune!";
    this.el.gnCount.textContent = 'complete';
    if (mode === 'guide') this.feedback('good', this.copy.done);
    else this.feedback('good', 'Now try ', b('Play Along'), ' to play it yourself.');
    this.mode = 'idle';
    this.setListenButton(false);
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

  $('btnListen').addEventListener('click', () => player.toggleListen());
  $('btnGuide').addEventListener('click', () => player.guide());
  $('btnStop').addEventListener('click', () => player.stop());
  $('btnHint').addEventListener('click', () => player.hint());
  $as<HTMLInputElement>('tempo').addEventListener('input', (e) =>
    player.setTempo(Number((e.target as HTMLInputElement).value)));

  window.addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement | null)?.tagName ?? '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'Space') {
      e.preventDefault();
      player.toggleListen();
    } else if (e.key === 'Escape') player.stop();
  });

  const linked = findSong(songIdFromUrl());
  if (linked && !unavailableReason(slug, linked)) {
    markActive(buttons, linked.id);
    player.load(linked);
  }
  return player;
}
