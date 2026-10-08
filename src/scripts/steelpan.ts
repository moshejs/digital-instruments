/**
 * STEELPAN — a tenor pan synthesized with additive Web Audio partials.
 * Tuned octave + twelfth ring over a bright, fast-decaying metallic "ping",
 * with a filtered-noise strike transient and a touch of plate shimmer.
 */
import { REST, noteToFreq } from '../lib/music';
import { createAudioContext, makeImpulse, makeNoise } from '../lib/audio';
import { buildPads, KEYMAP, NOTE_TO_KEY } from '../lib/steelpan-layout';
import { SONGS, findSong, playableCount, type Song } from '../data/songs';
import { $, $as, NoteStrip, b, markActive, renderSongList, setFeedback, setSongInUrl, songIdFromUrl } from './shared/song-ui';

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

const padEls = new Map<string, HTMLButtonElement>();
const flashTimers = new Map<string, number>();
let panGlowTimer = 0;

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
      hitPad(p.note, 'touch');
    });
    pad.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        hitPad(p.note, 'key');
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

type HitSource = 'touch' | 'key' | 'auto';

function hitPad(note: string, src: HitSource): void {
  if (note === REST) return;
  synth.strike(noteToFreq(note), src === 'auto' ? 0.92 : 1);
  flashPad(note);
  $('freeNote').textContent = note;
  if (player.mode === 'guide' && src !== 'auto') player.checkHit(note);
}

/* ───────────────────────────── player ───────────────────────────── */

type Mode = 'idle' | 'listen' | 'guide';

class Player {
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
    feedback: $('feedback'),
  };

  feedback(kind: 'good' | 'bad' | 'info', ...parts: (string | Node)[]): void {
    setFeedback(this.el.feedback, kind, ...parts);
  }

  load(song: Song): void {
    this.stop();
    this.song = song;
    setTempo(song.tempo);
    this.el.title.textContent = song.title;
    this.el.meta.textContent = `${song.key} · ${playableCount(song)} notes`;
    this.el.desc.textContent = song.description;
    for (const btn of [this.el.listen, this.el.guide, this.el.stop, this.el.hint]) btn.disabled = false;
    this.strip.build(song);
    this.showIdle('Ready when you are');
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
    const total = this.song?.notes.length ?? 1;
    this.el.prog.style.width = `${(100 * i) / total}%`;
  }

  private showNote(i: number, fallbackLyric: string): void {
    const n = this.song!.notes[i];
    this.strip.mark(i);
    this.setProgress(i);
    this.el.gnNote.textContent = n.note === REST ? '·' : n.note;
    this.el.gnLyric.textContent = n.lyric || (n.note === REST ? '(rest)' : fallbackLyric);
    this.el.gnCount.textContent = `note ${i + 1} / ${this.song!.notes.length}`;
  }

  private clearTimers(): void {
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [];
  }

  private clearTarget(): void {
    this.target = null;
    padEls.forEach((pad) => pad.classList.remove('target'));
  }

  stop(): void {
    this.clearTimers();
    this.clearTarget();
    if (this.song && this.mode !== 'idle') this.showIdle('Stopped');
    this.mode = 'idle';
    setListenButton(false);
  }

  listen(): void {
    if (!this.song) return;
    const song = this.song;
    this.clearTimers();
    this.clearTarget();
    this.mode = 'listen';
    this.el.now.classList.remove('idle');
    setListenButton(true);
    synth.unlock();
    const beatMs = 60000 / this.tempo;
    let t = 260;
    song.notes.forEach((n, i) => {
      this.timers.push(window.setTimeout(() => {
        this.idx = i;
        this.showNote(i, '');
        if (n.note !== REST) hitPad(n.note, 'auto');
      }, t));
      t += n.beats * beatMs;
    });
    this.timers.push(window.setTimeout(() => this.finish('listen'), t + 120));
  }

  guide(): void {
    if (!this.song) return;
    this.clearTimers();
    this.mode = 'guide';
    this.el.now.classList.remove('idle');
    setListenButton(false);
    synth.unlock();
    this.feedback('info', 'Strike the ', b('glowing pad'), ' to play each note.');
    this.advanceTo(0);
  }

  private advanceTo(i: number): void {
    const song = this.song!;
    this.clearTarget();
    if (i >= song.notes.length) return this.finish('guide');
    this.idx = i;
    const n = song.notes[i];
    this.showNote(i, 'play it');
    if (n.note === REST) {
      const beatMs = 60000 / this.tempo;
      this.timers.push(window.setTimeout(() => this.advanceTo(i + 1), Math.min(n.beats * beatMs, 450)));
      return;
    }
    this.target = n.note;
    padEls.get(n.note)?.classList.add('target');
  }

  checkHit(note: string): void {
    if (this.mode !== 'guide' || !this.target) return;
    if (note === this.target) {
      this.strip.markDone(this.idx);
      this.setProgress(this.idx + 1);
      this.feedback('good', 'Nice — keep going!');
      this.advanceTo(this.idx + 1);
    } else {
      const pad = padEls.get(note);
      if (pad) {
        pad.classList.remove('wrong');
        void pad.offsetWidth;
        pad.classList.add('wrong');
        window.setTimeout(() => pad.classList.remove('wrong'), 320);
      }
      this.feedback('bad', `That was ${note} — you want `, b(this.target), '.');
    }
  }

  hint(): void {
    if (!this.song) return;
    const note = this.mode === 'guide' ? this.target : this.song.notes.find((n) => n.note !== REST)?.note;
    if (!note) return;
    synth.strike(noteToFreq(note), 0.55);
    flashPad(note);
  }

  private finish(mode: 'listen' | 'guide'): void {
    const song = this.song!;
    this.clearTarget();
    this.setProgress(song.notes.length);
    this.strip.mark(song.notes.length - 1);
    this.el.gnNote.textContent = '★';
    this.el.gnLyric.textContent = mode === 'guide' ? 'You played it!' : "That's the tune!";
    this.el.gnCount.textContent = 'complete';
    if (mode === 'guide') this.feedback('good', 'You played the whole song. Encore?');
    else this.feedback('good', 'Now try ', b('Play Along'), ' to play it yourself.');
    this.mode = 'idle';
    setListenButton(false);
    // a celebratory shimmer across the pan
    song.notes.filter((n) => n.note !== REST).slice(0, 10)
      .forEach((n, k) => this.timers.push(window.setTimeout(() => flashPad(n.note), 60 * k)));
  }
}

let player: Player;

/* ───────────────────────────── controls ───────────────────────────── */

let listenPlaying = false;

function setListenButton(playing: boolean): void {
  listenPlaying = playing;
  const btn = $('btnListen');
  btn.replaceChildren(Object.assign(document.createElement('span'), { className: 'ic', textContent: playing ? '❚❚' : '▶' }), playing ? 'Stop' : 'Listen');
}

function toggleListen(): void {
  if (!player.song) return;
  if (listenPlaying || player.mode === 'listen') player.stop();
  else player.listen();
}

function setTempo(bpm: number): void {
  player.tempo = bpm;
  $as<HTMLInputElement>('tempo').value = String(bpm);
  $('tempoVal').textContent = `${bpm} BPM`;
}

const THEME_KEY = 'mdi-steelpan-theme';

function initTheme(): void {
  const root = document.documentElement;
  const current = (): 'light' | 'dark' =>
    (root.dataset.theme as 'light' | 'dark' | undefined) ??
    (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  const apply = (theme: 'light' | 'dark') => {
    root.dataset.theme = theme;
    $('themeIcon').textContent = theme === 'dark' ? '◐' : '☀';
    $('themeLabel').textContent = theme === 'dark' ? 'Stage' : 'Daylight';
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
    if (e.code === 'Space') {
      e.preventDefault();
      toggleListen();
      return;
    }
    if (e.key === 'Escape') return player.stop();
    const key = e.key.toLowerCase();
    const note = KEYMAP[key];
    if (note && !held.has(key)) {
      held.add(key);
      hitPad(note, 'key');
    }
  });
  window.addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));
}

function init(): void {
  renderPan();
  player = new Player();

  const buttons = renderSongList($('songList'), SONGS, (song) => {
    markActive(buttons, song.id);
    setSongInUrl(song.id);
    synth.unlock();
    player.load(song);
  });

  $('btnListen').addEventListener('click', toggleListen);
  $('btnGuide').addEventListener('click', () => player.guide());
  $('btnStop').addEventListener('click', () => player.stop());
  $('btnHint').addEventListener('click', () => player.hint());
  $as<HTMLInputElement>('tempo').addEventListener('input', (e) => setTempo(Number((e.target as HTMLInputElement).value)));

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

  const linked = findSong(songIdFromUrl());
  if (linked) {
    markActive(buttons, linked.id);
    player.load(linked);
  }
}

init();
