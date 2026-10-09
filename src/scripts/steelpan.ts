/**
 * STEELPAN — a tenor pan synthesized with additive Web Audio partials.
 * Tuned octave + twelfth ring over a bright, fast-decaying metallic "ping",
 * with a filtered-noise strike transient and a touch of plate shimmer.
 */
import { REST, noteToFreq } from '../lib/music';
import { createAudioContext, makeImpulse, makeNoise } from '../lib/audio';
import { buildPads } from '../lib/steelpan-layout';
import { PIANO_KEYMAP, invertKeymap } from '../lib/keyboard';
import type { Song } from '../data/songs';
import { $, $as, showLast } from './shared/song-ui';
import { mountGuide, type GuidePlayer } from './shared/guide-player';

/* ───────────────────────────── sound ───────────────────────────── */

interface Overtone { ratio: number; gain: number; decay: number; type: OscillatorType }

const PARTIALS: Overtone[] = [
  { ratio: 1.0, gain: 0.85, decay: 2.0, type: 'triangle' }, // fundamental
  { ratio: 2.004, gain: 1.0, decay: 1.7, type: 'sine' }, // tuned octave, hand-hammered detune
  { ratio: 3.006, gain: 0.7, decay: 1.0, type: 'sine' }, // tuned twelfth
  { ratio: 4.0, gain: 0.35, decay: 0.4, type: 'sine' }, // bright top → the "ping"
  { ratio: 5.01, gain: 0.22, decay: 0.28, type: 'sine' },
  { ratio: 6.02, gain: 0.14, decay: 0.18, type: 'sine' },
  { ratio: 8.03, gain: 0.08, decay: 0.12, type: 'sine' },
];
const ATTACK = 0.005;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

class PanSynth {
  private ctx: AudioContext | null = null;
  private dry!: GainNode;
  private reverb!: ConvolverNode;
  private noise!: AudioBuffer;

  private init(): AudioContext {
    if (this.ctx) return this.ctx;
    const ctx = createAudioContext();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 26;
    comp.ratio.value = 3.4;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    comp.connect(ctx.destination);

    // bus → lowpass → tremolo → compressor
    const trem = ctx.createGain();
    trem.gain.value = 1;
    trem.connect(comp);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 8500;
    lp.Q.value = 0.4;
    lp.connect(trem);
    const bus = ctx.createGain();
    bus.gain.value = 0.5;
    bus.connect(lp);

    this.dry = ctx.createGain();
    this.dry.gain.value = 0.92;
    this.dry.connect(bus);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = makeImpulse(ctx, 1.4, 3.0);
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    this.reverb.connect(wet);
    wet.connect(bus);

    // gentle 4.5 Hz "singing" tremolo
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 4.5;
    const depth = ctx.createGain();
    depth.gain.value = 0.05;
    lfo.connect(depth);
    depth.connect(trem.gain);
    lfo.start();

    this.noise = makeNoise(ctx, 0.15);
    this.ctx = ctx;
    return ctx;
  }

  unlock(): void {
    const ctx = this.init();
    if (ctx.state === 'suspended') void ctx.resume();
  }

  strike(freq: number, velocity = 1): void {
    const ctx = this.init();
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime;
    const ringScale = clamp(Math.pow(330 / freq, 0.35), 0.6, 1.4); // high notes ring shorter

    const voice = ctx.createGain();
    voice.connect(this.dry);
    const send = ctx.createGain();
    send.gain.value = 0.9;
    voice.connect(send);
    send.connect(this.reverb);

    for (const p of PARTIALS) {
      const osc = ctx.createOscillator();
      osc.type = p.type;
      const f = freq * p.ratio;
      osc.frequency.setValueAtTime(f * 1.01, t0); // tiny pitch drop on the strike
      osc.frequency.exponentialRampToValueAtTime(f, t0 + 0.05);
      const g = ctx.createGain();
      const decay = p.decay * ringScale;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(Math.max(0.0002, p.gain * velocity * 0.34), t0 + ATTACK);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
      osc.connect(g);
      g.connect(voice);
      osc.start(t0);
      osc.stop(t0 + decay + 0.05);
    }

    // metallic strike: high-passed noise through a bright "ping" band and a woody mallet band
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 300;
    src.connect(hp);
    const bands: [number, number, number, number][] = [
      [clamp(freq * 8, 3000, 6000), 8, 0.25, 0.08],
      [freq * 3, 4, 0.12, 0.12],
    ];
    for (const [centre, q, peak, decay] of bands) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = centre;
      bp.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(peak * velocity, t0 + 0.0015);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + decay);
      hp.connect(bp);
      bp.connect(g);
      g.connect(voice);
    }
    src.start(t0);
    src.stop(t0 + 0.16);
  }
}

const synth = new PanSynth();

/* ───────────────────────────── the pan ───────────────────────────── */

const NOTE_TO_KEY = invertKeymap(PIANO_KEYMAP);
const padEls = new Map<string, HTMLButtonElement>();
const flashTimers = new Map<string, number>();
let panGlowTimer = 0;
let player: GuidePlayer;

function renderPan(): void {
  const host = $('pads');
  for (const p of buildPads()) {
    const pad = document.createElement('button');
    pad.type = 'button';
    pad.className = `pad ring-${p.ring}`;
    Object.assign(pad.style, { left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, height: `${p.h}%` });
    pad.setAttribute('aria-label', p.note.replace('#', ' sharp '));
    const label = document.createElement('span');
    label.className = 'lbl';
    label.textContent = p.note;
    pad.append(label);
    const key = NOTE_TO_KEY[p.note];
    if (key) {
      const k = document.createElement('span');
      k.className = 'key';
      k.textContent = key.toUpperCase();
      pad.append(k);
    }
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      hitPad(p.note);
    });
    pad.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        hitPad(p.note);
      }
    });
    padEls.set(p.note, pad);
    host.append(pad);
  }
}

function flashPad(note: string, cls = 'struck'): void {
  const pad = padEls.get(note);
  if (!pad) return;
  pad.classList.remove(cls);
  void pad.offsetWidth; // restart the animation
  pad.classList.add(cls);
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  pad.append(ripple);
  window.setTimeout(() => ripple.remove(), 560);
  window.clearTimeout(flashTimers.get(note));
  flashTimers.set(note, window.setTimeout(() => pad.classList.remove(cls), 260));
  const pan = $('pan');
  pan.classList.add('lit');
  window.clearTimeout(panGlowTimer);
  panGlowTimer = window.setTimeout(() => pan.classList.remove('lit'), 170);
}

/** The player strikes a pad (mouse, touch or keyboard). */
function hitPad(note: string): void {
  synth.strike(noteToFreq(note), 1);
  flashPad(note);
  showLast(note);
  player.checkHit(note);
}

/* ───────────────────────────── controls ───────────────────────────── */

const THEME_KEY = 'mdi-steelpan-theme';

function initTheme(): void {
  const root = document.documentElement;
  const current = (): 'light' | 'dark' =>
    (root.dataset.theme as 'light' | 'dark' | undefined) ??
    (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  // the button names the action it will take, not the current state
  const apply = (theme: 'light' | 'dark') => {
    root.dataset.theme = theme;
    $('iconSun').hidden = theme === 'light';
    $('iconMoon').hidden = theme === 'dark';
    $('themeLabel').textContent = theme === 'dark' ? 'Switch to daylight' : 'Switch to stage lights';
  };
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
  } catch { /* storage unavailable — fall back to the OS preference */ }
  apply(current());
  $('themeToggle').addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    apply(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
  });
}

function initKeyboard(): void {
  const held = new Set<string>();
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target as HTMLElement | null)?.tagName ?? '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const key = e.key.toLowerCase();
    const note = PIANO_KEYMAP[key];
    if (note && !held.has(key)) {
      held.add(key);
      hitPad(note);
    }
  });
  window.addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));
}

function init(): void {
  renderPan();
  player = mountGuide(
    'steelpan',
    {
      unlock: () => synth.unlock(),
      perform: (note, { velocity }) => {
        synth.strike(noteToFreq(note), velocity);
        flashPad(note);
        showLast(note);
      },
      showTarget: (note) => {
        padEls.forEach((pad) => pad.classList.remove('target'));
        if (note) padEls.get(note)?.classList.add('target');
      },
      showWrong: (note) => {
        const pad = padEls.get(note);
        if (!pad) return;
        pad.classList.remove('wrong');
        void pad.offsetWidth;
        pad.classList.add('wrong');
        window.setTimeout(() => pad.classList.remove('wrong'), 320);
      },
      celebrate: (song: Song) => {
        song.notes.filter((n) => n.note !== REST).slice(0, 10)
          .forEach((n, k) => window.setTimeout(() => flashPad(n.note), 60 * k));
      },
    },
    { instruction: ['Strike the ', 'glowing pad', ' to play each note.'], done: 'You played the whole song. Encore?' },
  );

  const names = $as<HTMLInputElement>('swNames');
  const keys = $as<HTMLInputElement>('swKeys');
  const applyToggles = () => {
    document.body.classList.toggle('show-names', names.checked);
    document.body.classList.toggle('show-keys', keys.checked);
  };
  names.addEventListener('change', applyToggles);
  keys.addEventListener('change', applyToggles);
  applyToggles();

  initTheme();
  initKeyboard();
}

init();
