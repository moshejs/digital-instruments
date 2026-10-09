/**
 * KALIMBA — a 17-key thumb piano.
 * Each tine is a clamped-free steel bar, so its overtones fall at the
 * cantilever-beam mode ratios 1 : 6.27 : 17.55. The high modes die within a
 * fraction of a second, leaving the long, pure fundamental; a short click
 * models the thumb leaving the tine, and a peaking filter the wooden box.
 */
import { REST, noteToFreq } from '../lib/music';
import { createAudioContext, makeImpulse, makeNoise } from '../lib/audio';
import { buildTines, kalimbaNumber, KALIMBA_KEYMAP } from '../lib/kalimba-layout';
import { invertKeymap } from '../lib/keyboard';
import type { Song } from '../data/songs';
import { $, capture, showLast } from './shared/song-ui';
import { mountGuide, type GuidePlayer } from './shared/guide-player';

/* ───────────────────────────── sound ───────────────────────────── */

const MODES = [
  { ratio: 1, gain: 1, decay: 2.6 },
  { ratio: 6.267, gain: 0.2, decay: 0.28 },
  { ratio: 17.55, gain: 0.05, decay: 0.08 },
];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

class KalimbaSynth {
  private ctx: AudioContext | null = null;
  private input!: GainNode;
  private noise!: AudioBuffer;

  private init(): AudioContext {
    if (this.ctx) return this.ctx;
    const ctx = createAudioContext();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    comp.connect(ctx.destination);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 9500;
    lp.connect(comp);
    // the hollow wooden box: a warm resonance around 300 Hz
    const body = ctx.createBiquadFilter();
    body.type = 'peaking';
    body.frequency.value = 300;
    body.Q.value = 1.1;
    body.gain.value = 5;
    body.connect(lp);

    const room = ctx.createConvolver();
    room.buffer = makeImpulse(ctx, 1.1, 3.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.16;
    room.connect(wet);
    wet.connect(lp);

    this.input = ctx.createGain();
    this.input.gain.value = 0.42;
    this.input.connect(body);
    this.input.connect(room);
    this.noise = makeNoise(ctx, 0.05);
    this.ctx = ctx;
    return ctx;
  }

  unlock(): void {
    const ctx = this.init();
    if (ctx.state === 'suspended') void ctx.resume();
  }

  pluck(freq: number, velocity = 1): void {
    const ctx = this.init();
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime;
    const ring = clamp(Math.pow(262 / freq, 0.4), 0.5, 1.3); // short tines ring for less time

    for (const m of MODES) {
      const f = freq * m.ratio;
      if (f > ctx.sampleRate / 2.2) continue;
      const osc = ctx.createOscillator();
      osc.frequency.value = f;
      const g = ctx.createGain();
      const decay = m.decay * ring;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(m.gain * velocity * 0.5, t0 + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
      osc.connect(g);
      g.connect(this.input);
      osc.start(t0);
      osc.stop(t0 + decay + 0.05);
    }

    // the thumb leaving the tine: a tiny high-passed click
    const click = ctx.createBufferSource();
    click.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2500;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.09 * velocity, t0);
    cg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.012);
    click.connect(hp);
    hp.connect(cg);
    cg.connect(this.input);
    click.start(t0);
    click.stop(t0 + 0.02);
  }
}

const synth = new KalimbaSynth();

/* ───────────────────────────── the instrument ───────────────────────────── */

const NOTE_TO_KEY = invertKeymap(KALIMBA_KEYMAP);
const tineEls = new Map<string, HTMLButtonElement>();
const ringTimers = new Map<string, number>();
let player: GuidePlayer;

function renderTines(): void {
  const host = $('tines');
  for (const t of buildTines()) {
    const tine = document.createElement('button');
    tine.type = 'button';
    tine.className = 'tine';
    tine.dataset.note = t.note;
    tine.style.setProperty('--slot', String(t.slot));
    tine.style.setProperty('--len', String(t.length));
    tine.setAttribute('aria-label', `Tine ${t.note}`);

    const { digit, dots } = kalimbaNumber(t.note);
    const num = document.createElement('span');
    num.className = 'num';
    num.dataset.dots = '•'.repeat(dots);
    num.textContent = String(digit);
    const letter = document.createElement('span');
    letter.className = 'letter';
    letter.textContent = t.note;
    const key = document.createElement('span');
    key.className = 'key';
    key.textContent = (NOTE_TO_KEY[t.note] ?? '').toUpperCase();
    // the button is the whole column (a tall thumb target); the steel tine is drawn inside it
    const bar = document.createElement('span');
    bar.className = 'bar';
    bar.append(num, letter, key);
    tine.append(bar);

    tine.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        play(t.note);
      }
    });
    tineEls.set(t.note, tine);
    host.append(tine);
  }

  // tap a tine, or keep the finger down and sweep across several
  let sweeping = false;
  let last: string | null = null;
  const tineAt = (x: number, y: number) =>
    (document.elementFromPoint(x, y)?.closest('.tine') as HTMLElement | null)?.dataset.note ?? null;
  host.addEventListener('pointerdown', (e) => {
    const note = tineAt(e.clientX, e.clientY);
    if (!note) return;
    e.preventDefault();
    sweeping = true;
    last = note;
    capture(host, e.pointerId);
    play(note);
  });
  host.addEventListener('pointermove', (e) => {
    if (!sweeping) return;
    const note = tineAt(e.clientX, e.clientY);
    if (note && note !== last) play(note, 0.8);
    last = note;
  });
  const end = () => { sweeping = false; last = null; };
  host.addEventListener('pointerup', end);
  host.addEventListener('pointercancel', end);
}

function ringTine(note: string): void {
  const tine = tineEls.get(note);
  if (!tine) return;
  tine.classList.remove('ring');
  void tine.offsetWidth;
  tine.classList.add('ring');
  window.clearTimeout(ringTimers.get(note));
  ringTimers.set(note, window.setTimeout(() => tine.classList.remove('ring'), 900));
}

function sound(note: string, velocity: number): void {
  synth.pluck(noteToFreq(note), velocity);
  ringTine(note);
  showLast(note);
}

/** The player plucks a tine. */
function play(note: string, velocity = 1): void {
  synth.unlock();
  sound(note, velocity);
  player.checkHit(note);
}

/* ───────────────────────────── controls ───────────────────────────── */

function initNotation(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-notation]');
  const apply = (mode: string) => {
    document.body.dataset.notation = mode;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.notation === mode)));
    try { localStorage.setItem('mdi-kalimba-notation', mode); } catch { /* ignore */ }
  };
  buttons.forEach((b) => b.addEventListener('click', () => apply(b.dataset.notation!)));
  let saved = 'numbers';
  try { saved = localStorage.getItem('mdi-kalimba-notation') ?? saved; } catch { /* ignore */ }
  apply(saved === 'letters' ? 'letters' : 'numbers');

  const keys = $('swKeys') as HTMLInputElement;
  const applyKeys = () => document.body.classList.toggle('show-keys', keys.checked);
  keys.addEventListener('change', applyKeys);
  applyKeys();
}

function initKeyboard(): void {
  const held = new Set<string>();
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target as HTMLElement | null)?.tagName ?? '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const key = e.key.toLowerCase();
    const note = KALIMBA_KEYMAP[key];
    if (note && !held.has(key)) {
      held.add(key);
      play(note);
    }
  });
  window.addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));
}

function init(): void {
  renderTines();
  player = mountGuide(
    'kalimba',
    {
      unlock: () => synth.unlock(),
      perform: (note, { velocity }) => sound(note, velocity),
      showTarget: (note) => {
        tineEls.forEach((t) => t.classList.remove('target'));
        if (note) tineEls.get(note)?.classList.add('target');
      },
      showWrong: (note) => {
        const tine = tineEls.get(note);
        if (!tine) return;
        tine.classList.remove('wrong');
        void tine.offsetWidth;
        tine.classList.add('wrong');
      },
      celebrate: (song: Song) => {
        // a little arpeggio sweep up the tines
        song.notes.filter((n) => n.note !== REST).slice(-6)
          .forEach((n, k) => window.setTimeout(() => ringTine(n.note), 80 * k));
      },
    },
    { instruction: ['Pluck the ', 'glowing tine', ' to play each note.'], done: 'Lovely playing. Try another song?' },
  );
  initNotation();
  initKeyboard();
}

init();
