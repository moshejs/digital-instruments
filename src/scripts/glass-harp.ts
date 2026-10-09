/**
 * GLASS HARP — tuned wine glasses that sing when you circle their rims.
 * A wet finger excites the glass by stick-slip friction, so loudness follows
 * rubbing speed: each pointer's speed drives its own voice (multi-touch chords).
 * A voice is the glass's bending modes (≈ 1 : 2.71 : 5.13) plus a slightly
 * detuned twin for the shimmering beat, and band-passed friction noise.
 * Tapping without rubbing gives the bright "ting" of a struck glass.
 */
import { noteToFreq } from '../lib/music';
import { createAudioContext, makeImpulse, makeNoise } from '../lib/audio';
import { buildGlasses } from '../lib/glass-layout';
import { PIANO_KEYMAP, invertKeymap } from '../lib/keyboard';
import { $, capture, showLast } from './shared/song-ui';
import { mountGuide, type GuidePlayer } from './shared/guide-player';

/* ───────────────────────────── sound ───────────────────────────── */

const MODES = [
  { ratio: 1, gain: 1 },
  { ratio: 1.0011, gain: 0.55 }, // a hair sharp: the slow shimmer of a real glass
  { ratio: 2.71, gain: 0.13 },
  { ratio: 5.13, gain: 0.035 },
];

class GlassEngine {
  ctx: AudioContext | null = null;
  bus!: GainNode;
  noise!: AudioBuffer;

  init(): AudioContext {
    if (this.ctx) return this.ctx;
    const ctx = createAudioContext();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);
    const hall = ctx.createConvolver();
    hall.buffer = makeImpulse(ctx, 2.8, 2.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    hall.connect(wet);
    wet.connect(comp);
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.5;
    this.bus.connect(comp);
    this.bus.connect(hall);
    this.noise = makeNoise(ctx, 1.5);
    this.ctx = ctx;
    return ctx;
  }

  unlock(): void {
    const ctx = this.init();
    if (ctx.state === 'suspended') void ctx.resume();
  }

  /** A struck glass: bright attack, long ring. */
  ting(freq: number, velocity: number): void {
    const ctx = this.init();
    const t0 = ctx.currentTime;
    for (const [ratio, gain, decay] of [[1, 0.5, 2.4], [2.71, 0.22, 0.9], [5.13, 0.1, 0.35]] as const) {
      const osc = ctx.createOscillator();
      osc.frequency.value = freq * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(gain * velocity * 0.45, t0 + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
      osc.connect(g);
      g.connect(this.bus);
      osc.start(t0);
      osc.stop(t0 + decay + 0.05);
    }
  }
}

const engine = new GlassEngine();

/** One singing glass. Lives until it is released and has rung out. */
class GlassVoice {
  private readonly oscs: OscillatorNode[] = [];
  private readonly src: AudioBufferSourceNode;
  private readonly amp: GainNode;
  private readonly fric: GainNode;
  released = false;

  constructor(freq: number) {
    const ctx = engine.init();
    this.amp = ctx.createGain();
    this.amp.gain.value = 0;
    this.amp.connect(engine.bus);
    for (const m of MODES) {
      const osc = ctx.createOscillator();
      osc.frequency.value = freq * m.ratio;
      const g = ctx.createGain();
      g.gain.value = m.gain * 0.32;
      osc.connect(g);
      g.connect(this.amp);
      osc.start();
      this.oscs.push(osc);
    }
    // the finger on the rim: narrow-band noise centred on the note
    this.src = ctx.createBufferSource();
    this.src.buffer = engine.noise;
    this.src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = 22;
    this.fric = ctx.createGain();
    this.fric.gain.value = 0;
    this.src.connect(bp);
    bp.connect(this.fric);
    this.fric.connect(engine.bus);
    this.src.start();
  }

  /** 0 … 1 rubbing intensity. Glass responds slowly, so the level eases in. */
  setLevel(level: number, ease = 0.09): void {
    const t = engine.ctx!.currentTime;
    this.amp.gain.setTargetAtTime(level, t, ease);
    this.fric.gain.setTargetAtTime(level * 0.35, t, ease * 0.6);
  }

  release(): void {
    if (this.released) return;
    this.released = true;
    const t = engine.ctx!.currentTime;
    this.amp.gain.cancelScheduledValues(t);
    this.amp.gain.setTargetAtTime(0, t, 0.55); // the glass keeps ringing after the finger lifts
    this.fric.gain.cancelScheduledValues(t);
    this.fric.gain.setTargetAtTime(0, t, 0.04);
    const stopAt = t + 3.5;
    this.oscs.forEach((o) => o.stop(stopAt));
    this.src.stop(stopAt);
  }
}

/* ───────────────────────────── the table ───────────────────────────── */

const glassEls = new Map<string, HTMLButtonElement>();
const singing = new Map<string, number>(); // note → active voice count (for the glow)
let player: GuidePlayer;

interface Rub {
  note: string;
  voice: GlassVoice;
  x: number;
  y: number;
  t: number;
  moved: number;
  level: number;
  sungMs: number;
  counted: boolean;
  /** time spent circling the target too slowly to sing, for the coaching hint */
  slowMs: number;
  hinted: boolean;
}
const rubs = new Map<number, Rub>(); // pointerId → rub

function setSinging(note: string, delta: number, level?: number): void {
  const el = glassEls.get(note);
  if (!el) return;
  const n = Math.max(0, (singing.get(note) ?? 0) + delta);
  singing.set(note, n);
  el.classList.toggle('sing', n > 0);
  if (level !== undefined) el.style.setProperty('--level', level.toFixed(2));
}

function renderGlasses(): void {
  const table = $('table');
  for (const g of buildGlasses()) {
    const glass = document.createElement('button');
    glass.type = 'button';
    glass.className = `glass ${g.row}`;
    glass.dataset.note = g.note;
    glass.style.setProperty('--x', `${g.x}%`);
    glass.style.setProperty('--water', g.water.toFixed(3));
    glass.setAttribute('aria-label', `Glass ${g.note}`);
    glass.innerHTML =
      '<span class="bowl"><span class="water"></span><span class="ripple"></span><span class="shine"></span></span>' +
      '<span class="rim"></span><span class="stem"></span><span class="foot"></span>';
    const label = document.createElement('span');
    label.className = 'lbl';
    label.textContent = g.note.replace('#', '♯');
    glass.append(label);

    glass.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      capture(glass, e.pointerId);
      startRub(e.pointerId, g.note, e.clientX, e.clientY);
    });
    glass.addEventListener('pointermove', (e) => moveRub(e.pointerId, e.clientX, e.clientY));
    const end = (e: PointerEvent) => endRub(e.pointerId);
    glass.addEventListener('pointerup', end);
    glass.addEventListener('pointercancel', end);
    glass.addEventListener('lostpointercapture', end);
    glass.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
        e.preventDefault();
        e.stopPropagation();
        keySing(`focus:${g.note}`, g.note);
      }
    });
    glass.addEventListener('keyup', (e) => {
      if (e.key === 'Enter' || e.key === ' ') keyRelease(`focus:${g.note}`);
    });
    glassEls.set(g.note, glass);
    table.append(glass);
  }
}

function startRub(id: number, note: string, x: number, y: number): void {
  engine.unlock();
  endRub(id);
  engine.ting(noteToFreq(note), 0.5); // the first touch taps the glass
  const rub: Rub = { note, voice: new GlassVoice(noteToFreq(note)), x, y, t: performance.now(), moved: 0, level: 0, sungMs: 0, counted: false, slowMs: 0, hinted: false };
  rubs.set(id, rub);
  setSinging(note, +1, 0);
  showLast(note.replace('#', '♯'));
}

function moveRub(id: number, x: number, y: number): void {
  const rub = rubs.get(id);
  if (!rub) return;
  const now = performance.now();
  const dt = Math.max(1, now - rub.t);
  const speed = Math.hypot(x - rub.x, y - rub.y) / dt; // px per ms
  rub.x = x;
  rub.y = y;
  rub.t = now;
  rub.moved = now;
  const target = Math.min(1, speed / 1.1);
  rub.level += (target - rub.level) * 0.3;
  rub.voice.setLevel(rub.level * 0.9);
  setSinging(rub.note, 0, rub.level);
  if (rub.level > 0.18) {
    rub.sungMs += dt;
    if (!rub.counted && rub.sungMs > 260) {
      rub.counted = true; // one sustained ring counts as one note in the guide
      player.checkHit(rub.note);
    }
  } else if (isGuidingOn(rub.note)) {
    // circling the right glass, but too slowly to make it sing: say so instead of failing silently
    rub.slowMs += dt;
    if (!rub.hinted && rub.slowMs > 700) {
      rub.hinted = true;
      player.feedback('info', 'Circle a little faster — the glass needs speed to sing.');
    }
  }
}

const isGuidingOn = (note: string) => player.mode === 'guide' && player.targetNote === note;

function endRub(id: number): void {
  const rub = rubs.get(id);
  if (!rub) return;
  rubs.delete(id);
  rub.voice.release();
  setSinging(rub.note, -1, 0);
  if (!rub.counted && !rub.hinted && rub.sungMs === 0 && isGuidingOn(rub.note)) {
    player.feedback('info', 'Tapping gives a ting — circle the rim to make the glass sing.');
  }
}

/**
 * When a finger stops moving on the rim, the glass fades as it would in real life.
 * Time-based (not per frame), so it fades at the same rate on 60 Hz and 120 Hz screens.
 */
let lastDecay = performance.now();
function decayTick(): void {
  const now = performance.now();
  const factor = Math.pow(0.88, (now - lastDecay) / 16.7);
  lastDecay = now;
  for (const rub of rubs.values()) {
    if (now - rub.moved > 70 && rub.level > 0.001) {
      rub.level *= factor;
      rub.voice.setLevel(rub.level * 0.9);
      setSinging(rub.note, 0, rub.level);
    }
  }
}

/* keyboard: holding a key keeps a glass singing at a steady level */
const keyVoices = new Map<string, { note: string; voice: GlassVoice }>();

function keySing(id: string, note: string): void {
  if (keyVoices.has(id)) return;
  engine.unlock();
  const voice = new GlassVoice(noteToFreq(note));
  voice.setLevel(0.7, 0.12);
  keyVoices.set(id, { note, voice });
  setSinging(note, +1, 0.7);
  showLast(note.replace('#', '♯'));
  player.checkHit(note);
}

function keyRelease(id: string): void {
  const held = keyVoices.get(id);
  if (!held) return;
  keyVoices.delete(id);
  held.voice.release();
  setSinging(held.note, -1, 0);
}

function initKeyboard(): void {
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target as HTMLElement | null)?.tagName ?? '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const key = e.key.toLowerCase();
    const note = PIANO_KEYMAP[key];
    if (note) keySing(`key:${key}`, note);
  });
  window.addEventListener('keyup', (e) => keyRelease(`key:${e.key.toLowerCase()}`));
  window.addEventListener('blur', () => [...keyVoices.keys()].forEach(keyRelease));
}

/**
 * Phones: the table is wider than the screen and scrolls sideways. Keep the
 * glass that matters (the next target, or the one sounding) centred in view.
 */
function followGlass(note: string): void {
  const scroller = document.querySelector<HTMLElement>('.table-scroll');
  const glass = glassEls.get(note);
  if (!scroller || !glass || scroller.scrollWidth <= scroller.clientWidth + 1) return;
  const left = glass.offsetLeft + glass.offsetWidth / 2 - scroller.clientWidth / 2;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  scroller.scrollTo({ left: Math.max(0, left), behavior: reduce ? 'instant' : 'smooth' });
}

/* the app's own performance (Listen / Hint) */
const autoVoices = new Set<GlassVoice>();

function perform(note: string, durationMs: number, velocity: number): void {
  engine.unlock();
  const voice = new GlassVoice(noteToFreq(note));
  autoVoices.add(voice);
  voice.setLevel(0.75 * velocity, 0.06);
  setSinging(note, +1, 0.75);
  followGlass(note);
  showLast(note.replace('#', '♯'));
  window.setTimeout(() => {
    voice.release();
    autoVoices.delete(voice);
    setSinging(note, -1, 0);
  }, Math.max(220, durationMs * 0.92));
}

function init(): void {
  renderGlasses();
  window.setInterval(decayTick, 33);
  const NOTE_TO_KEY = invertKeymap(PIANO_KEYMAP);
  glassEls.forEach((el, note) => el.setAttribute('aria-keyshortcuts', NOTE_TO_KEY[note]?.toUpperCase() ?? ''));

  player = mountGuide(
    'glass-harp',
    {
      unlock: () => engine.unlock(),
      perform: (note, { durationMs, velocity }) => perform(note, durationMs, velocity),
      showTarget: (note) => {
        glassEls.forEach((g) => g.classList.remove('target'));
        if (note) {
          glassEls.get(note)?.classList.add('target');
          followGlass(note);
        }
      },
      showWrong: (note) => {
        const g = glassEls.get(note);
        if (!g) return;
        g.classList.remove('wrong');
        void g.offsetWidth;
        g.classList.add('wrong');
      },
      silence: () => autoVoices.forEach((v) => v.release()),
    },
    { instruction: ['Circle the rim of the ', 'glowing glass', ' until it sings.'], done: 'A whole song on glass. Beautiful.' },
  );

  const labels = $('swNames') as HTMLInputElement;
  const apply = () => document.body.classList.toggle('show-names', labels.checked);
  labels.addEventListener('change', apply);
  apply();
  initKeyboard();
}

init();
