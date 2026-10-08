/**
 * AETHERWAVE — a theremin: one continuous voice you play without touching.
 * Pointer (or phone tilt) → pitch and volume, with portamento glide,
 * a vibrato LFO, a timbre crossfade and an oscilloscope of the real output.
 */
import { REST, centsBetween, freqInfo, midiToFreq, noteToFreq, snapFreq, type ScaleMode } from '../lib/music';
import { createAudioContext, makeImpulse } from '../lib/audio';
import { FIELD_MAX_MIDI, FIELD_MIN_MIDI, freqToX, tiltToControl, xToFreq, yToVolume } from '../lib/theremin-field';
import { SONGS, findSong, playableCount, type Song } from '../data/songs';
import { $, $as, NoteStrip, b, markActive, renderSongList, setFeedback, setSongInUrl, songIdFromUrl, capture } from './shared/song-ui';

/* ───────────────────────────── sound ───────────────────────────── */

const MASTER = 0.3;

class ThereminSynth {
  ready = false;
  private ctx!: AudioContext;
  private osc1!: OscillatorNode;
  private osc2!: OscillatorNode;
  private g1!: GainNode;
  private g2!: GainNode;
  private tone!: BiquadFilterNode;
  private vca!: GainNode;
  private dry!: GainNode;
  private reverb!: ConvolverNode;
  private wet!: GainNode;
  private lfo!: OscillatorNode;
  private lfoDepth!: GainNode;
  private analyser!: AnalyserNode;
  private scopeBuf!: Float32Array<ArrayBuffer>;
  glide = 0.03;
  private timbre = 0.42;

  init(): void {
    if (this.ready) return;
    const ctx = createAudioContext();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -8;
    comp.knee.value = 18;
    comp.ratio.value = 10;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.scopeBuf = new Float32Array(this.analyser.fftSize);
    comp.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    this.dry = ctx.createGain();
    this.dry.connect(comp);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = makeImpulse(ctx, 2.2, 2.6);
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.24;
    this.reverb.connect(this.wet);
    this.wet.connect(comp);

    this.vca = ctx.createGain();
    this.vca.gain.value = 0;
    this.vca.connect(this.dry);
    this.vca.connect(this.reverb);
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass';
    this.tone.frequency.value = 3600;
    this.tone.Q.value = 0.6;
    this.tone.connect(this.vca);

    // two voices crossfaded for timbre: a pure sine and a vocal, harmonic-rich wave
    this.osc1 = ctx.createOscillator();
    this.osc1.type = 'sine';
    this.osc2 = ctx.createOscillator();
    const harmonics = [0, 1, 0.5, 0.34, 0.26, 0.13, 0.09, 0.05, 0.03];
    this.osc2.setPeriodicWave(ctx.createPeriodicWave(new Float32Array(harmonics.length), new Float32Array(harmonics)));
    this.g1 = ctx.createGain();
    this.g2 = ctx.createGain();
    this.osc1.connect(this.g1);
    this.osc2.connect(this.g2);
    this.g1.connect(this.tone);
    this.g2.connect(this.tone);

    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = 5.5;
    this.lfoDepth = ctx.createGain();
    this.lfoDepth.gain.value = 22;
    this.lfo.connect(this.lfoDepth);
    this.lfoDepth.connect(this.osc1.detune);
    this.lfoDepth.connect(this.osc2.detune);

    const a4 = midiToFreq(69);
    this.osc1.frequency.value = a4;
    this.osc2.frequency.value = a4;
    this.osc1.start();
    this.osc2.start();
    this.lfo.start();
    this.ready = true;
    this.setTimbre(this.timbre);
  }

  resume(): void {
    if (this.ready && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setPitch(freq: number, glide = this.glide): void {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.osc1.frequency.setTargetAtTime(freq, t, glide);
    this.osc2.frequency.setTargetAtTime(freq, t, glide);
    this.tone.frequency.setTargetAtTime(Math.min(Math.max(freq * 4, 1200), 7000), t, glide);
  }

  setVolume(vol: number, ramp = 0.02): void {
    if (!this.ready) return;
    this.vca.gain.setTargetAtTime(Math.max(0, vol) * MASTER, this.ctx.currentTime, ramp);
  }

  setTimbre(t: number): void {
    this.timbre = t;
    if (!this.ready) return;
    this.g1.gain.value = Math.cos((t * Math.PI) / 2);
    this.g2.gain.value = Math.sin((t * Math.PI) / 2);
  }

  setVibrato(rate: number, depthCents: number): void {
    if (!this.ready) return;
    this.lfo.frequency.value = rate;
    this.lfoDepth.gain.value = depthCents;
  }

  setReverb(wet: number): void {
    if (this.ready) this.wet.gain.value = wet;
  }

  scope(): Float32Array | null {
    if (!this.ready) return null;
    this.analyser.getFloatTimeDomainData(this.scopeBuf);
    return this.scopeBuf;
  }

  /** A short reference tone for "Hint", independent of the main voice. */
  pluck(freq: number, dur = 0.7): void {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(MASTER * 0.8, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.dry);
    g.connect(this.reverb);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

const synth = new ThereminSynth();

/* ───────────────────────────── the field ───────────────────────────── */

const field = $('field');
const scopeCanvas = $as<HTMLCanvasElement>('scope');
const scopeCtx = scopeCanvas.getContext('2d')!;
const cursor = $('cursor');
const cursorRead = $('cursorRead');
const crossH = $('crossH');
const crossV = $('crossV');
const pitchAntenna = field.querySelector<HTMLElement>('.antenna.pitch')!;
const volumeAntenna = field.querySelector<HTMLElement>('.antenna.vol')!;
const hzTop = $('hzTop');
const noteTop = $('noteTop');

const user = { playing: false, freq: 0, vol: 0 };
let powered = false;
let scaleMode: ScaleMode = 'off';

function sizeScope(): void {
  const rect = scopeCanvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  scopeCanvas.width = Math.max(1, Math.floor(rect.width * dpr));
  scopeCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
  scopeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function buildRuler(): void {
  const ruler = $('ruler');
  for (let m = FIELD_MIN_MIDI; m <= FIELD_MAX_MIDI; m++) {
    const isC = m % 12 === 0;
    const tick = document.createElement('div');
    tick.className = isC ? 'tick oct' : 'tick';
    tick.style.left = `${freqToX(midiToFreq(m)) * 100}%`;
    tick.style.height = isC ? '26px' : '8px';
    if (isC) {
      const lab = document.createElement('span');
      lab.className = 'lab';
      lab.textContent = `C${m / 12 - 1}`;
      tick.append(lab);
    }
    ruler.append(tick);
  }
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function drawScope(): void {
  requestAnimationFrame(drawScope);
  const w = scopeCanvas.clientWidth;
  const h = scopeCanvas.clientHeight;
  scopeCtx.clearRect(0, 0, w, h);
  scopeCtx.strokeStyle = 'rgba(150,170,255,.10)';
  scopeCtx.lineWidth = 1;
  scopeCtx.beginPath();
  scopeCtx.moveTo(0, h / 2);
  scopeCtx.lineTo(w, h / 2);
  scopeCtx.stroke();
  const buf = synth.scope();
  if (!buf) return;
  const cyan = css('--cyan');
  scopeCtx.lineWidth = 2;
  scopeCtx.strokeStyle = cyan;
  scopeCtx.shadowColor = cyan;
  scopeCtx.shadowBlur = reducedMotion.matches ? 0 : 12;
  scopeCtx.beginPath();
  const step = Math.max(1, Math.floor(buf.length / w));
  for (let i = 0; i < buf.length; i += step) {
    const x = (i / buf.length) * w;
    const y = h / 2 + buf[i] * h * 0.42;
    if (i === 0) scopeCtx.moveTo(x, y);
    else scopeCtx.lineTo(x, y);
  }
  scopeCtx.stroke();
  scopeCtx.shadowBlur = 0;
}

/** Moves the visible "hand" and readouts to a position in the field. */
function showHand(fx: number, vol: number, freq: number, label?: string): void {
  const rect = field.getBoundingClientRect();
  const x = fx * rect.width;
  const y = (1 - vol) * rect.height * 0.96;
  field.classList.add('playing');
  cursor.style.left = `${x}px`;
  cursor.style.top = `${y}px`;
  crossH.style.top = `${y}px`;
  crossV.style.left = `${x}px`;
  const info = freqInfo(freq);
  cursorRead.style.left = `${x}px`;
  cursorRead.style.top = `${y}px`;
  cursorRead.textContent = label ?? `${info.name}  ${info.cents >= 0 ? '+' : ''}${info.cents}¢`;
  hzTop.textContent = `${Math.round(freq)} Hz`;
  noteTop.textContent = info.name;
  pitchAntenna.style.setProperty('--pglow', `${Math.round(fx * 90)}%`);
  volumeAntenna.style.setProperty('--vglow', `${Math.round(vol * 90)}%`);
}

function resetHand(): void {
  if (user.playing) return;
  field.classList.remove('playing');
  hzTop.textContent = '— Hz';
  noteTop.textContent = 'silent';
  pitchAntenna.style.setProperty('--pglow', '0%');
  volumeAntenna.style.setProperty('--vglow', '0%');
}

/** One entry point for pointer and tilt control. */
function play(fx: number, vol: number, label?: string): void {
  if (!powered || player.mode === 'listen') return;
  const freq = snapFreq(xToFreq(fx), scaleMode);
  user.playing = vol > 0.04;
  user.freq = freq;
  user.vol = vol;
  synth.setPitch(freq);
  synth.setVolume(vol);
  showHand(fx, vol, freq, label);
}

function release(): void {
  user.playing = false;
  user.vol = 0;
  if (player.mode !== 'listen') synth.setVolume(0, 0.06);
  resetHand();
}

function onPointer(e: PointerEvent): void {
  if (!powered || motion.active) return;
  const rect = field.getBoundingClientRect();
  const fx = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
  const fy = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1);
  play(fx, yToVolume(fy));
}

function initField(): void {
  field.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') {
      if (e.buttons === 0) return;
      e.preventDefault();
    }
    onPointer(e);
  });
  field.addEventListener('pointerdown', (e) => {
    if (!powered) return;
    if (motion.active) {
      motion.recenter();
      player.feedback('info', 'Recentered — hold the phone comfortably, then rotate & tilt to play.');
      return;
    }
    capture(field, e.pointerId);
    onPointer(e);
  });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel'] as const) {
    field.addEventListener(type, () => {
      if (powered && !motion.active) release();
    });
  }
  window.addEventListener('resize', sizeScope);
}

function powerOn(): void {
  if (powered) return;
  synth.init();
  synth.resume();
  powered = true;
  $('power').hidden = true;
  field.classList.add('powered');
  applyVoiceControls();
  player.feedback('info', 'Powered on. Glide across the field to play — or pick a song.');
}

/* ───────────── motion: gyroscope → pitch & volume, accelerometer → vibrato ───────────── */

type PermissionRequester = { requestPermission?: () => Promise<'granted' | 'denied'> };

class MotionControl {
  active = false;
  private calibrated = false;
  private centerBeta = 0;
  private centerGamma = 0;
  private lastAcc: { x: number; y: number; z: number } | null = null;
  private shake = 0;
  private gotEvent = false;
  private probe = 0;
  private readonly onOrient = (e: DeviceOrientationEvent) => this.handleOrient(e);
  private readonly onMotion = (e: DeviceMotionEvent) => this.handleMotion(e);

  handleOrient(e: Pick<DeviceOrientationEvent, 'beta' | 'gamma'>): void {
    if (e.beta == null && e.gamma == null) return;
    this.gotEvent = true;
    if (!this.calibrated) {
      this.centerBeta = e.beta ?? 0;
      this.centerGamma = e.gamma ?? 0;
      this.calibrated = true;
    }
    const dGamma = (e.gamma ?? 0) - this.centerGamma; // roll the phone → pitch
    const dBeta = (e.beta ?? 0) - this.centerBeta; // tilt it → volume
    const { fx, vol } = tiltToControl(dGamma, dBeta);
    play(fx, vol);
    const clampPx = (v: number) => Math.max(-15, Math.min(15, v / 3));
    $('tiltbub').style.transform = `translate(${clampPx(dGamma)}px, ${clampPx(dBeta)}px)`;
  }

  handleMotion(e: Pick<DeviceMotionEvent, 'accelerationIncludingGravity' | 'acceleration'>): void {
    const a = e.accelerationIncludingGravity ?? e.acceleration;
    if (!a) return;
    const cur = { x: a.x ?? 0, y: a.y ?? 0, z: a.z ?? 0 };
    if (this.lastAcc) {
      const jerk = Math.abs(cur.x - this.lastAcc.x) + Math.abs(cur.y - this.lastAcc.y) + Math.abs(cur.z - this.lastAcc.z);
      this.shake = this.shake * 0.82 + jerk * 0.18;
    }
    this.lastAcc = cur;
    applyVoiceControls(Math.min(48, this.shake * 7)); // waving the phone = a player's hand vibrato
  }

  async enable(): Promise<boolean> {
    try {
      const orient = (window as unknown as { DeviceOrientationEvent?: PermissionRequester }).DeviceOrientationEvent;
      if (orient?.requestPermission && (await orient.requestPermission()) !== 'granted') {
        player.feedback('bad', 'Motion access was denied — play with touch instead, or allow Motion & Orientation in your browser settings.');
        return false;
      }
      const motionEvt = (window as unknown as { DeviceMotionEvent?: PermissionRequester }).DeviceMotionEvent;
      await motionEvt?.requestPermission?.().catch(() => 'denied');
    } catch {
      /* not iOS — no permission prompt needed */
    }
    window.addEventListener('deviceorientation', this.onOrient, true);
    window.addEventListener('devicemotion', this.onMotion, true);
    this.active = true;
    this.calibrated = false;
    this.gotEvent = false;
    window.clearTimeout(this.probe);
    this.probe = window.setTimeout(() => {
      if (this.gotEvent) return;
      this.disable();
      setTiltUI(false);
      player.feedback('info', 'No motion sensor detected — tilt control needs a phone. Using cursor / touch.');
    }, 1100);
    return true;
  }

  disable(): void {
    window.removeEventListener('deviceorientation', this.onOrient, true);
    window.removeEventListener('devicemotion', this.onMotion, true);
    this.active = false;
    window.clearTimeout(this.probe);
    applyVoiceControls();
    release(); // the controller is gone — always fall silent
  }

  recenter(): void {
    this.calibrated = false;
  }
}

const motion = new MotionControl();

function setTiltUI(on: boolean): void {
  const btn = $('tiltToggle');
  btn.classList.toggle('on', on);
  btn.setAttribute('aria-pressed', String(on));
  $('tiltLabel').textContent = on ? 'Tilt: on' : 'Tilt to play';
  field.classList.toggle('tilt', on);
  $('hintPointer').hidden = on;
  $('hintTilt').hidden = !on;
}

/* ───────────────────────────── player ───────────────────────────── */

type Mode = 'idle' | 'listen' | 'guide';
interface PlanStep { index: number; start: number; end: number }

class Player {
  song: Song | null = null;
  mode: Mode = 'idle';
  private tempo = 100;
  private timers: number[] = [];
  private raf = 0;
  private plan: PlanStep[] = [];
  private startedAt = 0;
  private endAt = 0;
  private onFrames = 0;
  private totalFrames = 0;
  private targetIdx = -1;
  private readonly strip = new NoteStrip($('strip'));
  private readonly el = {
    title: $('pTitle'), meta: $('pMeta'), desc: $('pDesc'),
    listen: $as<HTMLButtonElement>('btnListen'), guide: $as<HTMLButtonElement>('btnGuide'),
    stop: $as<HTMLButtonElement>('btnStop'), hint: $as<HTMLButtonElement>('btnHint'),
    prog: $('progFill'), now: $('guideNow'), gnNote: $('gnNote'), gnLyric: $('gnLyric'), gnCount: $('gnCount'),
    feedback: $('feedback'), target: $('target'), targetLab: $('targetLab'),
  };

  feedback(kind: 'good' | 'bad' | 'info', ...parts: (string | Node)[]): void {
    setFeedback(this.el.feedback, kind, ...parts);
  }

  load(song: Song): void {
    this.stop();
    this.song = song;
    this.tempo = song.tempo;
    this.el.title.textContent = song.title;
    this.el.meta.textContent = `${song.key} · ${playableCount(song)} notes`;
    this.el.desc.textContent = song.description;
    for (const btn of [this.el.listen, this.el.guide, this.el.stop, this.el.hint]) btn.disabled = false;
    this.strip.build(song);
    this.showIdle('Ready when you are');
    this.feedback('info', 'Loaded. Press ', b('Listen'), ' to hear the glide, or ', b('Play Along'), ' to follow the target.');
  }

  private showIdle(message: string): void {
    this.strip.reset();
    this.setProgress(0);
    this.el.now.classList.add('idle');
    this.el.gnNote.textContent = '—';
    this.el.gnLyric.textContent = message;
    this.el.gnCount.textContent = '—';
    this.hideTarget();
  }

  private setProgress(i: number): void {
    this.el.prog.style.width = `${(100 * i) / (this.song?.notes.length ?? 1)}%`;
  }

  private showNote(i: number, fallback: string): void {
    const n = this.song!.notes[i];
    this.strip.mark(i);
    this.setProgress(i);
    this.el.gnNote.textContent = n.note === REST ? '·' : n.note;
    this.el.gnLyric.textContent = n.lyric || (n.note === REST ? '(rest)' : fallback);
    this.el.gnCount.textContent = `note ${i + 1} / ${this.song!.notes.length}`;
  }

  private hideTarget(): void {
    this.el.target.classList.remove('on', 'hit');
    this.targetIdx = -1;
  }

  private showTarget(note: string): void {
    this.el.target.style.left = `${freqToX(noteToFreq(note)) * 100}%`;
    this.el.targetLab.textContent = note;
    this.el.target.classList.add('on');
  }

  private clearTimers(): void {
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [];
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private ensurePower(): boolean {
    if (!powered) powerOn();
    synth.resume();
    return true;
  }

  stop(): void {
    this.clearTimers();
    this.hideTarget();
    if (this.mode === 'listen') synth.setVolume(0, 0.1);
    if (this.song && this.mode !== 'idle') this.showIdle('Stopped');
    this.mode = 'idle';
    resetHand();
    setListenButton(false);
  }

  listen(): void {
    if (!this.song || !this.ensurePower()) return;
    const notes = this.song.notes;
    this.clearTimers();
    this.mode = 'listen';
    this.el.now.classList.remove('idle');
    setListenButton(true);
    const beatMs = 60000 / this.tempo;
    let t = 200;
    notes.forEach((n, i) => {
      const dur = n.beats * beatMs;
      this.timers.push(window.setTimeout(() => {
        this.showNote(i, '');
        if (n.note === REST) {
          synth.setVolume(0, 0.08);
          this.hideTarget();
          return;
        }
        const freq = noteToFreq(n.note);
        synth.setPitch(freq);
        synth.setVolume(0.9, 0.05);
        this.showTarget(n.note);
        showHand(freqToX(freq), 0.62, freq, n.note);
      }, t));
      // a small dip before a repeated note so it articulates
      if (notes[i + 1]?.note === n.note && n.note !== REST) {
        this.timers.push(window.setTimeout(() => synth.setVolume(0.35, 0.02), t + dur - Math.min(90, dur * 0.3)));
      }
      t += dur;
    });
    this.timers.push(window.setTimeout(() => {
      synth.setVolume(0, 0.25);
      this.finish("That's the tune!");
      this.feedback('good', 'Now try ', b('Play Along'), ' to play it yourself.');
    }, t + 150));
  }

  guide(): void {
    if (!this.song || !this.ensurePower()) return;
    this.clearTimers();
    this.mode = 'guide';
    this.el.now.classList.remove('idle');
    setListenButton(false);
    this.feedback('info', 'Follow the glowing band — slide onto it and keep the volume up.');
    const beatMs = 60000 / this.tempo;
    let acc = 200;
    this.plan = this.song.notes.map((n, index) => {
      const start = acc;
      acc += n.beats * beatMs;
      return { index, start, end: acc };
    });
    this.endAt = acc + 200;
    this.onFrames = 0;
    this.totalFrames = 0;
    this.startedAt = performance.now();
    const loop = () => {
      const elapsed = performance.now() - this.startedAt;
      if (elapsed >= this.endAt) return this.finishGuide();
      const step = this.plan.find((p) => elapsed >= p.start && elapsed < p.end);
      if (step) {
        const n = this.song!.notes[step.index];
        if (step.index !== this.targetIdx) {
          this.targetIdx = step.index;
          this.showNote(step.index, 'play it');
        }
        if (n.note === REST) {
          this.el.target.classList.remove('on', 'hit');
        } else {
          this.showTarget(n.note);
          const onPitch = user.playing && user.vol > 0.06 && Math.abs(centsBetween(user.freq, noteToFreq(n.note))) < 140;
          this.el.target.classList.toggle('hit', onPitch);
          this.totalFrames++;
          if (onPitch) this.onFrames++;
        }
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private finishGuide(): void {
    const accuracy = this.totalFrames ? Math.round((100 * this.onFrames) / this.totalFrames) : 0;
    this.finish(`On pitch ${accuracy}% of the time`);
    const verdict = accuracy >= 75 ? 'Beautiful control!' : accuracy >= 45 ? 'Nice — the glide is tricky, keep at it.' : 'Keep chasing the band — it gets easier.';
    this.feedback(accuracy >= 45 ? 'good' : 'info', 'Play-along complete — ', b(`${accuracy}%`), ` on pitch. ${verdict}`);
  }

  private finish(message: string): void {
    this.clearTimers();
    this.hideTarget();
    const total = this.song!.notes.length;
    this.setProgress(total);
    this.strip.mark(total - 1);
    this.el.gnNote.textContent = '★';
    this.el.gnLyric.textContent = message;
    this.el.gnCount.textContent = 'complete';
    this.mode = 'idle';
    resetHand();
    setListenButton(false);
  }

  hint(): void {
    if (!this.song || !this.ensurePower()) return;
    const current = this.targetIdx >= 0 ? this.song.notes[this.targetIdx] : undefined;
    const note = this.mode === 'guide' && current && current.note !== REST
      ? current.note
      : this.song.notes.find((n) => n.note !== REST)?.note;
    if (note) synth.pluck(noteToFreq(note));
  }
}

const player = new Player();

/* ───────────────────────────── controls ───────────────────────────── */

let listenPlaying = false;

function setListenButton(playing: boolean): void {
  listenPlaying = playing;
  const icon = document.createElement('span');
  icon.className = 'ic';
  icon.textContent = playing ? '❚❚' : '▶';
  $('btnListen').replaceChildren(icon, playing ? 'Stop' : 'Listen');
}

function toggleListen(): void {
  if (!player.song) return;
  if (listenPlaying || player.mode === 'listen') player.stop();
  else player.listen();
}

/** Reads the Voice sliders into the synth; extraVibrato adds the phone-shake boost. */
function applyVoiceControls(extraVibrato = 0): void {
  const num = (id: string) => Number($as<HTMLInputElement>(id).value);
  const glide = num('glide') / 100;
  synth.glide = 0.004 + glide * glide * 0.28;
  $('glideV').textContent = glide < 0.18 ? 'tight' : glide < 0.5 ? 'medium' : glide < 0.8 ? 'slurred' : 'ghostly';

  const rate = num('vibRate') / 10;
  const depth = num('vibDepth');
  synth.setVibrato(rate, depth + extraVibrato);
  $('vibRateV').textContent = `${rate.toFixed(1)} Hz`;
  $('vibDepthV').textContent = `${depth} ¢`;

  const timbre = num('timbre') / 100;
  synth.setTimbre(timbre);
  $('timbreV').textContent = timbre < 0.25 ? 'pure' : timbre < 0.6 ? 'voice' : timbre < 0.85 ? 'reed' : 'bright';

  const space = num('reverb') / 100;
  synth.setReverb(space * 0.7);
  $('reverbV').textContent = `${Math.round(space * 100)}%`;
}

function init(): void {
  buildRuler();
  sizeScope();
  requestAnimationFrame(drawScope);
  initField();

  const power = $('power');
  power.addEventListener('click', powerOn);
  power.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      powerOn();
    }
  });

  const buttons = renderSongList($('songList'), SONGS, (song) => {
    markActive(buttons, song.id);
    setSongInUrl(song.id);
    powerOn();
    player.load(song);
  });

  $('btnListen').addEventListener('click', toggleListen);
  $('btnGuide').addEventListener('click', () => player.guide());
  $('btnStop').addEventListener('click', () => player.stop());
  $('btnHint').addEventListener('click', () => player.hint());

  for (const id of ['glide', 'vibRate', 'vibDepth', 'timbre', 'reverb']) {
    $(id).addEventListener('input', () => applyVoiceControls());
  }
  applyVoiceControls();
  $as<HTMLSelectElement>('scale').addEventListener('change', (e) => {
    scaleMode = (e.target as HTMLSelectElement).value as ScaleMode;
  });

  // tilt control only makes sense on touch devices with an orientation sensor
  const tilt = $as<HTMLButtonElement>('tiltToggle');
  if ('DeviceOrientationEvent' in window && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) tilt.hidden = false;
  tilt.addEventListener('click', async () => {
    powerOn();
    if (motion.active) {
      motion.disable();
      setTiltUI(false);
      player.feedback('info', 'Tilt off — play with touch or cursor.');
    } else if (await motion.enable()) {
      setTiltUI(true);
      player.feedback('good', b('Rotate'), ' for pitch, ', b('tilt'), ' for volume, ', b('shake'), ' for vibrato. Tap the field to recenter.');
    }
  });

  window.addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement | null)?.tagName ?? '';
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (!powered) powerOn();
      else toggleListen();
    } else if (e.key === 'Escape') player.stop();
  });

  const linked = findSong(songIdFromUrl());
  if (linked) {
    markActive(buttons, linked.id);
    player.load(linked);
  }
}

init();
