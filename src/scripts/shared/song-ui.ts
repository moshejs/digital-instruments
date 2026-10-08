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

/** Renders the library; returns a lookup so callers can mark the active song. */
export function renderSongList(
  host: HTMLElement,
  songs: Song[],
  onPick: (song: Song) => void,
): Map<string, HTMLButtonElement> {
  host.replaceChildren();
  const buttons = new Map<string, HTMLButtonElement>();
  for (const song of songs) {
    const button = el('button', 'song');
    button.type = 'button';
    button.dataset.songId = song.id;
    const main = el('span', 'song-main');
    main.append(
      el('span', 'st', song.title),
      el('span', 'ss', `${playableCount(song)} notes · ${song.tempo} BPM · ${song.key}`),
    );
    button.append(main, el('span', `chip ${song.difficulty}`, song.difficulty));
    button.addEventListener('click', () => onPick(song));
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
