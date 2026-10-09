/** Song library + scrolling note strip, shared by every instrument page. */
import { REST } from '../../lib/music';
import { playableCount, type Song } from '../../data/songs';

export function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

export const $as = <T extends HTMLElement>(id: string): T => $(id) as T;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Renders the library; returns a lookup so callers can mark the active song.
 * `unavailable` explains why a song can't be played here (it's shown disabled).
 */
export function renderSongList(
  host: HTMLElement,
  songs: Song[],
  onPick: (song: Song) => void,
  unavailable: (song: Song) => string | null = () => null,
): Map<string, HTMLButtonElement> {
  host.replaceChildren();
  const buttons = new Map<string, HTMLButtonElement>();
  const playable = songs.filter((s) => !unavailable(s));
  const blocked = songs.filter((s) => unavailable(s));
  for (const song of [...playable, ...blocked]) {
    const reason = unavailable(song);
    const button = el('button', reason ? 'song unavailable' : 'song');
    button.type = 'button';
    button.dataset.songId = song.id;
    const main = el('span', 'song-main');
    main.append(
      el('span', 'st', song.title),
      el('span', 'ss', reason ?? `${playableCount(song)} notes · ${song.tempo} BPM · ${song.key}`),
    );
    button.append(main, el('span', `chip ${song.difficulty}`, song.difficulty));
    if (reason) {
      button.disabled = true;
      button.title = reason;
    } else {
      button.addEventListener('click', () => onPick(song));
    }
    buttons.set(song.id, button);
    host.append(button);
  }
  return buttons;
}

export function markActive(buttons: Map<string, HTMLButtonElement>, id: string | null): void {
  buttons.forEach((button, songId) => {
    const active = songId === id;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

/** The horizontal strip of upcoming notes under the guide. */
export class NoteStrip {
  private beats: HTMLElement[] = [];

  constructor(private readonly host: HTMLElement) {}

  build(song: Song): void {
    this.host.replaceChildren();
    this.beats = song.notes.map((n) => {
      const beat = el('div', n.note === REST ? 'beat rest' : 'beat');
      beat.append(el('div', 'bn', n.note === REST ? '·' : n.note), el('div', 'bl', n.lyric || ' '));
      this.host.append(beat);
      return beat;
    });
    this.host.style.transform = 'translateX(0)';
  }

  /** Highlights note i, dims earlier ones and scrolls i under the playhead. */
  mark(i: number): void {
    this.beats.forEach((beat, j) => {
      beat.classList.toggle('cur', j === i);
      beat.classList.toggle('done', j < i);
    });
    const current = this.beats[i];
    if (current) this.host.style.transform = `translateX(${-(current.offsetLeft - 6)}px)`;
  }

  markDone(i: number): void {
    this.beats[i]?.classList.add('done');
  }

  reset(): void {
    this.beats.forEach((beat) => beat.classList.remove('cur', 'done'));
    this.host.style.transform = 'translateX(0)';
  }
}

/** Deep links: ?song=amazing-grace preloads a song. */
export function songIdFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('song');
}

export function setSongInUrl(id: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set('song', id);
  window.history.replaceState(null, '', url);
}

export function setFeedback(node: HTMLElement, kind: 'good' | 'bad' | 'info', ...parts: (string | Node)[]): void {
  node.className = `feedback ${kind}`;
  node.replaceChildren(...parts);
}

/** Bold inline text for feedback messages. */
export const b = (text: string): HTMLElement => el('b', '', text);

/** Pointer capture that never throws (it can, if the pointer was already released). */
export function capture(el: Element, pointerId: number): void {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    /* the gesture still works without capture */
  }
}

/* ───────────── practice mode ───────────── */

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Collapses the song list to the chosen song (or expands it again). */
export function setLibraryCollapsed(collapsed: boolean): void {
  const library = document.getElementById('songs');
  const toggle = document.getElementById('libToggle');
  if (!library || !toggle) return;
  library.classList.toggle('collapsed', collapsed);
  toggle.hidden = false;
  toggle.setAttribute('aria-expanded', String(!collapsed));
  const label = toggle.querySelector('.label');
  if (label) label.textContent = collapsed ? 'Change song' : 'Hide list';
}

/** Wires the "Change song" disclosure once. */
export function initLibraryToggle(): void {
  const toggle = document.getElementById('libToggle');
  toggle?.addEventListener('click', () => {
    const collapsed = document.getElementById('songs')?.classList.contains('collapsed') ?? false;
    setLibraryCollapsed(!collapsed);
  });
}

/**
 * Switches the page into practice mode for a loaded song: the coach shows the
 * transport and note, the list collapses, and the coach is brought into view
 * next to the instrument.
 */
export function enterPractice(scroll = true): void {
  const coach = document.getElementById('coach');
  if (!coach) return;
  coach.dataset.state = 'practice';
  setLibraryCollapsed(true);
  if (!scroll) return;
  // let the layout settle (the coach just changed size), then reveal it
  window.setTimeout(() => {
    const rect = coach.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > window.innerHeight) {
      coach.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
  }, 40);
}

/** Writes to the polite screen-reader status region (only for things worth announcing). */
export function announce(text: string): void {
  const status = document.getElementById('srStatus');
  if (!status) return;
  status.textContent = '';
  window.setTimeout(() => { status.textContent = text; }, 30);
}

/** Note names the way a screen reader should say them: "F♯4" → "F sharp 4". */
export const spoken = (note: string): string => note.replace('#', ' sharp ').replace('♯', ' sharp ');

/** Shows the "last note" readout in the header (hidden until something is played). */
export function showLast(text: string): void {
  const value = document.getElementById('lastNote');
  if (!value) return;
  value.textContent = text;
  value.closest<HTMLElement>('.readout')?.removeAttribute('hidden');
}

/**
 * Global shortcuts (Space, Esc, note keys) must not fire while the user is
 * operating a control — Space on a focused button should press that button.
 */
export function isOperatingControl(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.closest) return false;
  return Boolean(el.closest('button, a[href], input, select, textarea, summary, [role="slider"], [role="button"], [contenteditable="true"]'));
}

/** Sets the progress bar fill (0…1) without animating layout. */
export function setProgressBar(fraction: number): void {
  const fill = document.getElementById('progFill');
  const bar = document.getElementById('progress');
  const f = Math.max(0, Math.min(1, fraction));
  if (fill) fill.style.transform = `scaleX(${f})`;
  bar?.setAttribute('aria-valuenow', String(Math.round(f * 100)));
}
