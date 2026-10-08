/**
 * LEVER HARP — 15 strings, physically modelled with Karplus–Strong:
 * a burst of filtered noise recirculates through a one-period delay line
 * with a gentle averaging filter, which is exactly how a plucked string
 * loses its high harmonics first. Drag across the strings to strum; flip a
 * string's lever to raise it a semitone (auto-levers handle it for songs).
 */
import { REST, midiToFreq, midiToName } from '../lib/music';
import { createAudioContext, makeImpulse } from '../lib/audio';
import {
  HARP_KEYS, HARP_STRINGS, HARP_VIEW, C_MAJOR_LEVERS, chooseFingering, leverPreset, neckY, pitchOf,
  soundboardY, stringGeometry, stringLabel, type Levers,
} from '../lib/harp';
import type { Song } from '../data/songs';
import { $, capture } from './shared/song-ui';
import { mountGuide, type GuidePlayer } from './shared/guide-player';

/* ───────────────────────────── sound ───────────────────────────── */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

class HarpSynth {
  private ctx: AudioContext | null = null;
  private input!: GainNode;
  private cache = new Map<number, { buffer: AudioBuffer; rate: number }>();

  private init(): AudioContext {
    if (this.ctx) return this.ctx;
    const ctx = createAudioContext();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    comp.connect(ctx.destination);
    // the soundboard: a warm low-mid resonance
    const body = ctx.createBiquadFilter();
    body.type = 'peaking';
    body.frequency.value = 220;
    body.Q.value = 0.9;
    body.gain.value = 3.5;
    body.connect(comp);
    const hall = ctx.createConvolver();
    hall.buffer = makeImpulse(ctx, 2.2, 2.8);
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    hall.connect(wet);
    wet.connect(comp);
    this.input = ctx.createGain();
    this.input.gain.value = 0.7;
    this.input.connect(body);
    this.input.connect(hall);
    this.ctx = ctx;
    return ctx;
  }

  unlock(): void {
    const ctx = this.init();
    if (ctx.state === 'suspended') void ctx.resume();
  }

  /** Karplus–Strong, rendered once per pitch and cached. */
  private string(midi: number): { buffer: AudioBuffer; rate: number } {
    const hit = this.cache.get(midi);
    if (hit) return hit;
    const ctx = this.ctx!;
    const sr = ctx.sampleRate;
    const freq = midiToFreq(midi);
    const period = Math.max(8, Math.floor(sr / freq));
    // the two-point average adds half a sample of delay
    const actual = sr / (period + 0.5);
    const seconds = clamp(4.2 * Math.pow(262 / freq, 0.5), 1.6, 5);
    const buffer = ctx.createBuffer(1, Math.floor(sr * seconds), sr);
    const d = buffer.getChannelData(0);

    let lp = 0;
    let mean = 0;
    for (let i = 0; i < period; i++) {
      lp += (Math.random() * 2 - 1 - lp) * 0.5; // a soft finger, not a pick
      d[i] = lp;
      mean += lp;
    }
    mean /= period;
    for (let i = 0; i < period; i++) d[i] -= mean;

    const t60 = seconds * 0.8;
    const loss = Math.pow(10, -3 / (t60 * actual));
    for (let i = period; i < d.length; i++) {
      d[i] = loss * 0.5 * (d[i - period] + (i - period - 1 >= 0 ? d[i - period - 1] : 0));
    }
    const out = { buffer, rate: freq / actual };
    this.cache.set(midi, out);
    return out;
  }

  pluck(midi: number, velocity = 1): void {
    const ctx = this.init();
    if (ctx.state === 'suspended') void ctx.resume();
    const { buffer, rate } = this.string(midi);
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 1800 + velocity * 7000; // harder plucks are brighter
    const g = ctx.createGain();
    g.gain.value = 0.55 * velocity;
    src.connect(tone);
    tone.connect(g);
    g.connect(this.input);
    src.start(t0);
  }
}

const synth = new HarpSynth();

/* ───────────────────────────── the harp ───────────────────────────── */

const SVG = 'http://www.w3.org/2000/svg';
const svgEl = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}) => {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
};

let levers: Levers = [...C_MAJOR_LEVERS];
let autoLevers = true;
let player: GuidePlayer;

interface StringView {
  path: SVGPathElement;
  lever: SVGGElement;
  label: SVGTextElement;
  x: number;
  top: number;
  bottom: number;
  amp: number;
  phase: number;
}
const views: StringView[] = [];

function renderHarp(): SVGSVGElement {
  const svg = $('harp') as unknown as SVGSVGElement;
  svg.setAttribute('viewBox', `0 0 ${HARP_VIEW.width} ${HARP_VIEW.height}`);

  const defs = svgEl('defs');
  defs.innerHTML = `
    <linearGradient id="wood" x1="0" x2="1"><stop offset="0" stop-color="#6b3c26"/><stop offset=".5" stop-color="#8a4f31"/><stop offset="1" stop-color="#4a2516"/></linearGradient>
    <linearGradient id="board" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#d9b07a"/><stop offset="1" stop-color="#b98a52"/></linearGradient>
    <linearGradient id="gilt" x1="0" x2="1"><stop offset="0" stop-color="#8f6a2a"/><stop offset=".5" stop-color="#f3d38a"/><stop offset="1" stop-color="#8f6a2a"/></linearGradient>`;
  svg.append(defs);

  // pillar, neck and soundboard
  const neck = Array.from({ length: 41 }, (_, k) => {
    const x = 120 + k * 20;
    return `${k ? 'L' : 'M'}${x},${neckY(x).toFixed(1)}`;
  }).join(' ');
  svg.append(
    svgEl('path', { d: `M86,96 Q120,60 150,${neckY(150) - 6} L150,700 L96,700 Z`, fill: 'url(#wood)', class: 'pillar' }),
    svgEl('path', { d: neck, fill: 'none', stroke: 'url(#wood)', 'stroke-width': 34, 'stroke-linecap': 'round', class: 'neck' }),
    svgEl('path', { d: neck, fill: 'none', stroke: 'url(#gilt)', 'stroke-width': 3, transform: 'translate(0,15)', opacity: 0.8 }),
    svgEl('path', {
      d: `M150,${soundboardY(150) + 6} L940,${soundboardY(940) - 30} L956,${soundboardY(956) - 4} L170,${soundboardY(170) + 36} Z`,
      fill: 'url(#board)', class: 'soundboard',
    }),
    svgEl('path', { d: `M90,700 L560,700 L540,716 L104,716 Z`, fill: 'url(#wood)' }),
  );

  const strings = svgEl('g', { class: 'strings' });
  HARP_STRINGS.forEach((s, i) => {
    const { x, top, bottom } = stringGeometry(i);
    const width = 3.2 - (i / (HARP_STRINGS.length - 1)) * 1.6; // bass strings are thicker
    const path = svgEl('path', { d: `M${x},${top} L${x},${bottom}`, class: `str ${s.colour}`, 'stroke-width': width.toFixed(2) });
    const lever = svgEl('g', { class: 'lever', role: 'button', tabindex: 0, 'aria-label': `Lever for the ${s.name} string` });
    lever.append(svgEl('circle', { cx: x + 10, cy: top + 4, r: 7 }), svgEl('rect', { x: x + 6, y: top - 10, width: 8, height: 10, rx: 3 }));
    lever.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      setLever(i, !levers[i]);
    });
    lever.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        setLever(i, !levers[i]);
      }
    });
    const label = svgEl('text', { x, y: bottom + 30, class: 'slabel', 'text-anchor': 'middle' });
    strings.append(path, lever, label);
    views.push({ path, lever, label, x, top, bottom, amp: 0, phase: 0 });
  });
  svg.append(strings);
  return svg;
}

function setLever(i: number, up: boolean): void {
  levers[i] = up;
  const v = views[i];
  v.lever.classList.toggle('up', up);
  v.lever.setAttribute('aria-pressed', String(up));
  v.label.textContent = stringLabel(i, up);
}

function setAllLevers(next: Levers): void {
  next.forEach((up, i) => setLever(i, up));
}

/* string vibration: a decaying sideways bow drawn every frame */
const ringing = new Set<number>();

function animate(): void {
  for (const i of ringing) {
    const v = views[i];
    v.phase += 0.9 + (1 - i / HARP_STRINGS.length) * 0.5;
    v.amp *= 0.93;
    const mid = (v.top + v.bottom) / 2;
    const dx = v.amp * Math.sin(v.phase);
    v.path.setAttribute('d', `M${v.x},${v.top} Q${(v.x + dx * 2).toFixed(2)},${mid.toFixed(1)} ${v.x},${v.bottom}`);
    if (v.amp < 0.15) {
      ringing.delete(i);
      v.path.setAttribute('d', `M${v.x},${v.top} L${v.x},${v.bottom}`);
      v.path.classList.remove('sounding');
    }
  }
  requestAnimationFrame(animate);
}

function sound(i: number, velocity: number): string {
  const midi = pitchOf(i, levers[i]);
  synth.pluck(midi, velocity);
  const v = views[i];
  v.amp = Math.min(14, 5 + velocity * 9) * (0.6 + (v.bottom - v.top) / 900);
  v.path.classList.add('sounding');
  ringing.add(i);
  const note = midiToName(midi);
  $('lastNote').textContent = stringLabel(i, levers[i]) + note.slice(-1);
  return note;
}

/** The player plucks a string. */
function pluck(i: number, velocity = 1): void {
  synth.unlock();
  player.checkHit(sound(i, velocity));
}

function initPlaying(svg: SVGSVGElement): void {
  const toSvg = (e: PointerEvent) => {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM()!.inverse());
  };
  const spacing = views[1].x - views[0].x;
  let last: { x: number; y: number; t: number } | null = null;

  svg.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    capture(svg, e.pointerId);
    const p = toSvg(e);
    last = { x: p.x, y: p.y, t: performance.now() };
    let best = -1;
    let bestD = spacing / 2;
    views.forEach((v, i) => {
      const d = Math.abs(v.x - p.x);
      if (d < bestD && p.y > v.top - 24 && p.y < v.bottom + 24) {
        bestD = d;
        best = i;
      }
    });
    if (best >= 0) pluck(best, 0.85);
  });

  svg.addEventListener('pointermove', (e) => {
    if (!last) return;
    const p = toSvg(e);
    const now = performance.now();
    const speed = Math.hypot(p.x - last.x, p.y - last.y) / Math.max(1, now - last.t);
    const velocity = clamp(0.45 + speed * 0.35, 0.45, 1);
    views.forEach((v, i) => {
      const crossed = (last!.x < v.x && p.x >= v.x) || (last!.x > v.x && p.x <= v.x);
      if (!crossed) return;
      const y = last!.y + ((p.y - last!.y) * (v.x - last!.x)) / (p.x - last!.x || 1);
      if (y > v.top - 10 && y < v.bottom + 10) pluck(i, velocity);
    });
    last = { x: p.x, y: p.y, t: now };
  });
  const end = () => { last = null; };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
}

function initKeyboard(): void {
  const held = new Set<string>();
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target as HTMLElement | null)?.tagName ?? '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    // e.code keeps working with Shift held (Shift+1 would otherwise be "!")
    const key = e.code.startsWith('Digit') ? e.code.slice(5) : e.code.startsWith('Key') ? e.code.slice(3).toLowerCase() : '';
    const i = HARP_KEYS.indexOf(key);
    if (i < 0 || held.has(key)) return;
    held.add(key);
    if (e.shiftKey) setLever(i, !levers[i]); // Shift + key flips that string's lever
    else pluck(i);
  });
  window.addEventListener('keyup', (e) => {
    const key = e.code.startsWith('Digit') ? e.code.slice(5) : e.code.startsWith('Key') ? e.code.slice(3).toLowerCase() : '';
    held.delete(key);
  });
}

function init(): void {
  const svg = renderHarp();
  setAllLevers(levers);
  initPlaying(svg);
  initKeyboard();
  requestAnimationFrame(animate);

  const clearMarks = () => views.forEach((v) => {
    v.path.classList.remove('target');
    v.lever.classList.remove('needs');
    v.label.classList.remove('target');
  });

  player = mountGuide(
    'harp',
    {
      unlock: () => synth.unlock(),
      onLoad: (song: Song) => {
        if (autoLevers) setAllLevers(leverPreset(song.notes.filter((n) => n.note !== REST).map((n) => n.note)));
      },
      perform: (note, { velocity }) => {
        const f = chooseFingering(note, levers);
        if (!f) return;
        if (levers[f.index] !== f.lever) setLever(f.index, f.lever); // the app flips levers as it plays
        sound(f.index, velocity);
      },
      showTarget: (note) => {
        clearMarks();
        if (!note) return;
        const f = chooseFingering(note, levers);
        if (!f) return;
        if (levers[f.index] !== f.lever) {
          if (autoLevers) setLever(f.index, f.lever);
          else views[f.index].lever.classList.add('needs');
        }
        views[f.index].path.classList.add('target');
        views[f.index].label.classList.add('target');
      },
      showWrong: (note) => {
        const i = views.findIndex((_, k) => midiToName(pitchOf(k, levers[k])) === note);
        if (i >= 0) {
          views[i].label.classList.remove('wrong');
          void views[i].label.getBoundingClientRect();
          views[i].label.classList.add('wrong');
        }
      },
      celebrate: () => {
        // the classic harp flourish: a glissando up every string
        views.forEach((_, i) => window.setTimeout(() => sound(i, 0.5), 45 * i));
      },
    },
    { instruction: ['Pluck the ', 'glowing string', ' — or sweep across to find it.'], done: 'Bravo — a full song on the harp.' },
  );

  const auto = $('swAuto') as HTMLInputElement;
  auto.addEventListener('change', () => {
    autoLevers = auto.checked;
    if (autoLevers && player.song) setAllLevers(leverPreset(player.song.notes.filter((n) => n.note !== REST).map((n) => n.note)));
  });
  $('btnReset').addEventListener('click', () => setAllLevers(C_MAJOR_LEVERS));
}

init();
