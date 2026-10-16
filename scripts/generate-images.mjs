/**
 * Renders every favicon, app icon and Open Graph card into /public.
 * Run with `npm run icons` (Node ≥ 22.18 for TypeScript type-stripping).
 * Outputs are committed, so CI never needs to run this.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { createServer } from 'vite';
import { buildPads } from '../src/lib/steelpan-layout.ts';
import { buildTines } from '../src/lib/kalimba-layout.ts';
import { buildGlasses } from '../src/lib/glass-layout.ts';
import { HARP_STRINGS, fingeringsFor, neckY, soundboardY, stringGeometry } from '../src/lib/harp.ts';

const OUT = new URL('../public/', import.meta.url);
const pads = buildPads();

const DISPLAY = "'Avenir Next Condensed', 'Arial Narrow', sans-serif";
const MONO = "Menlo, 'Courier New', monospace";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/* ───────── reusable SVG fragments ───────── */

function panSvg(cx, cy, r, litNotes = [], idPrefix = 'p') {
  const pad = (p) => {
    const x = cx - r + (p.x / 100) * 2 * r;
    const y = cy - r + (p.y / 100) * 2 * r;
    const rx = (p.w / 100) * r;
    const ry = (p.h / 100) * r;
    const lit = litNotes.includes(p.note);
    return `
      ${lit ? `<ellipse cx="${x}" cy="${y}" rx="${rx * 1.5}" ry="${ry * 1.5}" fill="#f6b23c" opacity=".55" filter="url(#${idPrefix}glow)"/>` : ''}
      <ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#${idPrefix}pad)" ${lit ? 'stroke="#f6b23c" stroke-width="2.5"' : 'stroke="rgba(255,255,255,.25)" stroke-width="1"'}/>`;
  };
  return `
    <defs>
      <radialGradient id="${idPrefix}dish" cx="50%" cy="34%" r="70%">
        <stop offset="0" stop-color="#cfdadd"/><stop offset=".46" stop-color="#5b666b"/>
        <stop offset=".74" stop-color="#2c3539"/><stop offset="1" stop-color="#161d20"/>
      </radialGradient>
      <radialGradient id="${idPrefix}pad" cx="42%" cy="30%" r="75%">
        <stop offset="0" stop-color="#f2f7f8"/><stop offset=".3" stop-color="#cfdadd"/>
        <stop offset=".72" stop-color="#5b666b"/><stop offset="1" stop-color="#2c3539"/>
      </radialGradient>
      <radialGradient id="${idPrefix}sheen" cx="34%" cy="20%" r="40%">
        <stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </radialGradient>
      <filter id="${idPrefix}glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${r * 0.04}"/></filter>
      <filter id="${idPrefix}shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="${r * 0.08}" stdDeviation="${r * 0.08}" flood-color="#000" flood-opacity=".6"/></filter>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${idPrefix}dish)" filter="url(#${idPrefix}shadow)"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.93}" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="${Math.max(1, r * 0.012)}"/>
    ${pads.map(pad).join('')}
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${idPrefix}sheen)"/>`;
}

/** A theremin-style waveform: a sine with an envelope and a little harmonic grit. */
function wavePath(x0, x1, cy, amp, cycles, phase = 0) {
  const pts = [];
  for (let x = x0; x <= x1; x += 2) {
    const u = (x - x0) / (x1 - x0);
    const env = Math.sin(Math.PI * u);
    const y = cy + (Math.sin(u * cycles * Math.PI * 2 + phase) * 0.85 + Math.sin(u * cycles * Math.PI * 4 + phase) * 0.18) * amp * env;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `M${pts.join(' L')}`;
}

function waveSvg(x0, x1, cy, amp, cycles, id = 'w', width = 4) {
  const d = wavePath(x0, x1, cy, amp, cycles);
  return `
    <defs><filter id="${id}glow" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="${width * 2.2}"/></filter></defs>
    <path d="${d}" fill="none" stroke="#5cf2d6" stroke-width="${width * 2.4}" opacity=".55" filter="url(#${id}glow)"/>
    <path d="${d}" fill="none" stroke="#9dfbe8" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/* ───────── icons ───────── */

const umbrellaIcon = (size = 64, pad = 0) => {
  const s = size - pad * 2;
  const k = s / 64;
  const t = (v) => pad + v * k;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" rx="${pad ? 0 : (14 * size) / 64}" fill="#121110"/>
    <circle cx="${t(32)}" cy="${t(32)}" r="${19 * k}" fill="none" stroke="#f6b23c" stroke-width="${4.4 * k}"/>
    <path d="M${t(7)} ${t(32)} c${5 * k} ${-11 * k} ${9 * k} ${-11 * k} ${12.5 * k} 0 s${8.5 * k} ${11 * k} ${12.5 * k} 0 ${8.5 * k} ${-11 * k} ${12.5 * k} 0 ${8 * k} ${11 * k} ${12.5 * k} 0"
      fill="none" stroke="#5cf2d6" stroke-width="${4.4 * k}" stroke-linecap="round"/>
  </svg>`;
};

const steelpanIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0b1315"/>
  <svg x="4" y="4" width="56" height="56" viewBox="0 0 560 560">${panSvg(280, 280, 270, ['E4', 'C5'], 'f')}</svg>
</svg>`;

const thereminIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#08080f"/>
  <rect x="50" y="10" width="3" height="44" rx="1.5" fill="#d8a24a"/>
  <circle cx="51.5" cy="10" r="3.2" fill="#d8a24a"/>
  <path d="${wavePath(6, 46, 32, 15, 2.2)}" fill="none" stroke="#5cf2d6" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="26" cy="20" r="4" fill="#ff5db0"/>
</svg>`;

/* ───────── Open Graph cards (1200×630) ───────── */

const footer = (color) => `
  <text x="72" y="566" font-family="${MONO}" font-size="22" fill="#a8a39a" letter-spacing="2">MOSHE'S DIGITAL INSTRUMENTS</text>
  <text x="72" y="596" font-family="${MONO}" font-size="18" fill="${color}">moshejs.github.io/digital-instruments</text>`;

const ogSteelpan = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><radialGradient id="bg" cx="72%" cy="45%" r="60%"><stop offset="0" stop-color="#2a2414"/><stop offset=".6" stop-color="#0e1a1d"/><stop offset="1" stop-color="#0b1315"/></radialGradient></defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  ${panSvg(880, 315, 255, ['E4', 'G4', 'C5'], 'o')}
  <text x="72" y="118" font-family="${MONO}" font-size="22" fill="#f6b23c" letter-spacing="6">NO. 01 · TRINIDAD &amp; TOBAGO</text>
  <text x="66" y="262" font-family="${DISPLAY}" font-weight="800" font-size="150" fill="#e6eef0" letter-spacing="2">STEEL</text>
  <text x="66" y="392" font-family="${DISPLAY}" font-weight="800" font-size="150" fill="#f6b23c" letter-spacing="2">PAN</text>
  <text x="72" y="448" font-family="${SANS}" font-size="27" fill="#c9d4d1">Play a steel drum in your browser —</text>
  <text x="72" y="484" font-family="${SANS}" font-size="27" fill="#c9d4d1">and learn fifteen songs by following the lights.</text>
  ${footer('#f6b23c')}
</svg>`;

const ogTheremin = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><radialGradient id="bg" cx="70%" cy="110%" r="80%"><stop offset="0" stop-color="#0b2430"/><stop offset=".6" stop-color="#0c0c18"/><stop offset="1" stop-color="#08080f"/></radialGradient>
  <filter id="dot" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="10"/></filter></defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <ellipse cx="642" cy="330" rx="34" ry="56" fill="none" stroke="#8a6a2f" stroke-width="4"/>
  <rect x="1108" y="88" width="5" height="460" rx="2.5" fill="#d8a24a"/>
  <circle cx="1110.5" cy="86" r="9" fill="#d8a24a"/>
  ${waveSvg(600, 1150, 330, 120, 6.5, 'og', 4)}
  <circle cx="930" cy="190" r="22" fill="#ff5db0" opacity=".7" filter="url(#dot)"/>
  <circle cx="930" cy="190" r="11" fill="#ff5db0"/><circle cx="930" cy="190" r="5" fill="#fff"/>
  <text x="72" y="118" font-family="${MONO}" font-size="22" fill="#5cf2d6" letter-spacing="6">NO. 02 · LÉON THEREMIN, 1920</text>
  <text x="66" y="262" font-family="${DISPLAY}" font-weight="800" font-size="132" fill="#e9ecff" letter-spacing="10">AETHER</text>
  <text x="66" y="392" font-family="${DISPLAY}" font-weight="800" font-size="132" fill="#9dfbe8" letter-spacing="10">WAVE</text>
  <text x="72" y="448" font-family="${SANS}" font-size="27" fill="#b9bde0">A theremin you play without touching —</text>
  <text x="72" y="484" font-family="${SANS}" font-size="27" fill="#b9bde0">hover, or tilt your phone through the air.</text>
  ${footer('#5cf2d6')}
</svg>`;

const ogHome = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="a" cx="15%" cy="0%" r="70%"><stop offset="0" stop-color="#f6b23c" stop-opacity=".12"/><stop offset="1" stop-color="#f6b23c" stop-opacity="0"/></radialGradient>
    <radialGradient id="c" cx="95%" cy="10%" r="70%"><stop offset="0" stop-color="#5cf2d6" stop-opacity=".1"/><stop offset="1" stop-color="#5cf2d6" stop-opacity="0"/></radialGradient>
    <linearGradient id="sig" x1="0" x2="1"><stop offset="0" stop-color="#f6b23c"/><stop offset=".22" stop-color="#ff8a4c"/><stop offset=".4" stop-color="#f3cf86"/><stop offset=".62" stop-color="#5cf2d6"/><stop offset=".82" stop-color="#b8a6ff"/><stop offset="1" stop-color="#ff5db0"/></linearGradient>
    <clipPath id="screen"><rect x="840" y="80" width="300" height="200" rx="6"/></clipPath>
  </defs>
  <rect width="1200" height="630" fill="#121110"/><rect width="1200" height="630" fill="url(#a)"/><rect width="1200" height="630" fill="url(#c)"/>
  <text x="72" y="120" font-family="${MONO}" font-size="22" fill="#a8a39a" letter-spacing="6">WORKSHOP CATALOGUE</text>
  <text x="70" y="196" font-family="${DISPLAY}" font-weight="700" font-size="54" fill="#a8a39a" letter-spacing="8">MOSHE'S</text>
  <text x="64" y="312" font-family="${DISPLAY}" font-weight="800" font-size="124" fill="#edeae3">DIGITAL</text>
  <text x="64" y="424" font-family="${DISPLAY}" font-weight="800" font-size="124" fill="#edeae3">INSTRUMENTS</text>
  <rect x="72" y="452" width="640" height="5" rx="2.5" fill="url(#sig)"/>
  <text x="72" y="506" font-family="${SANS}" font-size="26" fill="#a8a39a">Five instruments, synthesized live in your browser.</text>
  <text x="72" y="552" font-family="${MONO}" font-size="17" letter-spacing="3"><tspan fill="#f6b23c">STEELPAN</tspan><tspan fill="#6e6a63"> · </tspan><tspan fill="#5cf2d6">THEREMIN</tspan><tspan fill="#6e6a63"> · </tspan><tspan fill="#ff8a4c">KALIMBA</tspan><tspan fill="#6e6a63"> · </tspan><tspan fill="#b8a6ff">GLASS HARP</tspan><tspan fill="#6e6a63"> · </tspan><tspan fill="#f3cf86">HARP</tspan></text>
  <text x="72" y="596" font-family="${MONO}" font-size="18" fill="#6e6a63">moshejs.github.io/digital-instruments</text>
  <rect x="840" y="80" width="300" height="200" rx="6" fill="#07070d" stroke="rgba(237,234,227,.14)"/>
  <g clip-path="url(#screen)">${waveSvg(855, 1125, 180, 62, 4.2, 'h', 3)}</g>
  <rect x="1118" y="98" width="3" height="164" fill="#d8a24a"/>
  ${panSvg(990, 452, 128, ['E4', 'C5'], 'h')}
</svg>`;

/* ───────── kalimba, glasses, harp ───────── */

/** A kalimba board of width w with its top-left at (x, y); lit tines glow ember. */
function kalimbaSvg(x, y, w, lit = [], id = 'k') {
  const h = w / 1.12;
  const tines = buildTines();
  const inner = w * 0.86;
  const slot = inner / 17;
  const tw = slot * 0.68;
  const tine = (t) => {
    const tx = x + w * 0.07 + t.slot * slot + slot * 0.16;
    const ty = y + h * 0.08;
    const th = t.length * h * 0.57;
    const on = lit.includes(t.note);
    return `${on ? `<rect x="${tx - tw}" y="${ty + th * 0.6}" width="${tw * 3}" height="${th * 0.5}" rx="${tw}" fill="#ff8a4c" opacity=".7" filter="url(#${id}glow)"/>` : ''}
      <rect x="${tx}" y="${ty}" width="${tw}" height="${th}" rx="${tw * 0.45}" fill="url(#${id}steel)"/>`;
  };
  return `
    <defs>
      <linearGradient id="${id}wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2aa6e"/><stop offset=".55" stop-color="#b97a3f"/><stop offset="1" stop-color="#7f4c22"/></linearGradient>
      <linearGradient id="${id}steel" x1="0" x2="1"><stop offset="0" stop-color="#8e979c"/><stop offset=".4" stop-color="#f4f7f8"/><stop offset="1" stop-color="#6f777b"/></linearGradient>
      <linearGradient id="${id}brass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f5dfa5"/><stop offset="1" stop-color="#7c5a1e"/></linearGradient>
      <pattern id="${id}grain" width="7" height="40" patternUnits="userSpaceOnUse"><rect width="1.6" height="40" fill="rgba(90,45,15,.16)"/></pattern>
      <filter id="${id}glow" x="-100%" y="-50%" width="300%" height="200%"><feGaussianBlur stdDeviation="${w * 0.012}"/></filter>
      <filter id="${id}shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="${w * 0.04}" stdDeviation="${w * 0.04}" flood-color="#000" flood-opacity=".6"/></filter>
    </defs>
    <path d="M${x + w * 0.06},${y} H${x + w * 0.94} Q${x + w},${y} ${x + w},${y + h * 0.06} V${y + h * 0.7} Q${x + w},${y + h} ${x + w / 2},${y + h} Q${x},${y + h} ${x},${y + h * 0.7} V${y + h * 0.06} Q${x},${y} ${x + w * 0.06},${y} Z" fill="url(#${id}wood)" filter="url(#${id}shadow)"/>
    <path d="M${x + w * 0.06},${y} H${x + w * 0.94} Q${x + w},${y} ${x + w},${y + h * 0.06} V${y + h * 0.7} Q${x + w},${y + h} ${x + w / 2},${y + h} Q${x},${y + h} ${x},${y + h * 0.7} V${y + h * 0.06} Q${x},${y} ${x + w * 0.06},${y} Z" fill="url(#${id}grain)"/>
    <circle cx="${x + w / 2}" cy="${y + h * 0.8}" r="${w * 0.075}" fill="#120a04"/>
    ${tines.map(tine).join('')}
    <rect x="${x + w * 0.07}" y="${y + h * 0.13}" width="${w * 0.86}" height="${h * 0.034}" rx="${h * 0.012}" fill="url(#${id}brass)"/>`;
}

/** A row-pair of wine glasses across width w, bottom edge at y. */
function glassesSvg(x, y, w, lit = [], id = 'g') {
  const out = [`<defs><filter id="${id}glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="${w * 0.006}"/></filter></defs>`];
  const glasses = buildGlasses().sort((a, b) => (a.row === 'back' ? -1 : 1) - (b.row === 'back' ? -1 : 1));
  for (const g of glasses) {
    const gw = w * (g.row === 'front' ? 0.054 : 0.044);
    const gh = gw / 0.4;
    const cx = x + (g.x / 100) * w;
    const bottom = g.row === 'front' ? y : y - w * 0.16;
    const top = bottom - gh;
    const bowlH = gh * 0.58;
    const on = lit.includes(g.note);
    const bowl = `M${cx - gw / 2},${top} L${cx + gw / 2},${top} L${cx + gw / 2},${top + bowlH * 0.35} Q${cx + gw / 2},${top + bowlH} ${cx},${top + bowlH} Q${cx - gw / 2},${top + bowlH} ${cx - gw / 2},${top + bowlH * 0.35} Z`;
    const waterTop = top + bowlH * (1 - g.water);
    out.push(`
      <clipPath id="${id}c${g.note.replace('#', 's')}"><path d="${bowl}"/></clipPath>
      ${on ? `<ellipse cx="${cx}" cy="${top}" rx="${gw * 0.9}" ry="${gw * 0.35}" fill="#b8a6ff" filter="url(#${id}glow)"/>` : ''}
      <path d="${bowl}" fill="rgba(255,255,255,.06)" stroke="${on ? '#ffffff' : 'rgba(220,230,255,.5)'}" stroke-width="${on ? 2 : 1.2}"/>
      <rect x="${cx - gw / 2}" y="${waterTop}" width="${gw}" height="${top + bowlH - waterTop}" fill="rgba(140,190,255,.5)" clip-path="url(#${id}c${g.note.replace('#', 's')})"/>
      <ellipse cx="${cx}" cy="${top}" rx="${gw / 2}" ry="${gw * 0.08}" fill="none" stroke="${on ? '#fff' : 'rgba(240,245,255,.7)'}" stroke-width="1.2"/>
      <rect x="${cx - gw * 0.04}" y="${top + bowlH}" width="${gw * 0.08}" height="${gh * 0.36}" fill="rgba(255,255,255,.35)"/>
      <ellipse cx="${cx}" cy="${bottom}" rx="${gw * 0.38}" ry="${gw * 0.07}" fill="rgba(255,255,255,.12)" stroke="rgba(220,230,255,.45)"/>`);
  }
  return out.join('');
}

/** The lever harp, scaled by s and translated to (tx, ty); lit strings glow gold. */
function harpSvg(tx, ty, s, litIndices = [], id = 'h') {
  const neck = Array.from({ length: 41 }, (_, k) => {
    const x = 120 + k * 20;
    return `${k ? 'L' : 'M'}${x},${neckY(x).toFixed(1)}`;
  }).join(' ');
  const strings = HARP_STRINGS.map((st, i) => {
    const { x, top, bottom } = stringGeometry(i);
    const on = litIndices.includes(i);
    const colour = on ? '#ffe4ad' : st.colour === 'c' ? '#e0503f' : st.colour === 'f' ? '#7896f2' : '#e9d8ab';
    return `${on ? `<line x1="${x}" x2="${x}" y1="${top}" y2="${bottom}" stroke="#f3cf86" stroke-width="14" opacity=".55" filter="url(#${id}glow)"/>` : ''}
      <line x1="${x}" x2="${x}" y1="${top}" y2="${bottom}" stroke="${colour}" stroke-width="${3.4 - (i / 14) * 1.6}" stroke-linecap="round"/>
      <circle cx="${x + 10}" cy="${top + 4}" r="6" fill="${[2, 5, 6, 9, 12, 13].includes(i) ? '#f3cf86' : '#2a1a10'}" stroke="#c9a35a" stroke-width="2"/>`;
  }).join('');
  return `
    <defs>
      <linearGradient id="${id}wood" x1="0" x2="1"><stop offset="0" stop-color="#6b3c26"/><stop offset=".5" stop-color="#8a4f31"/><stop offset="1" stop-color="#4a2516"/></linearGradient>
      <linearGradient id="${id}board" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#d9b07a"/><stop offset="1" stop-color="#b98a52"/></linearGradient>
      <filter id="${id}glow" x="-200%" y="-10%" width="500%" height="120%"><feGaussianBlur stdDeviation="5"/></filter>
    </defs>
    <g transform="translate(${tx},${ty}) scale(${s})">
      <path d="M86,96 Q120,60 150,${neckY(150) - 6} L150,700 L96,700 Z" fill="url(#${id}wood)"/>
      <path d="${neck}" fill="none" stroke="url(#${id}wood)" stroke-width="34" stroke-linecap="round"/>
      <path d="M150,${soundboardY(150) + 6} L940,${soundboardY(940) - 30} L956,${soundboardY(956) - 4} L170,${soundboardY(170) + 36} Z" fill="url(#${id}board)"/>
      <path d="M90,700 L560,700 L540,716 L104,716 Z" fill="url(#${id}wood)"/>
      ${strings}
    </g>`;
}

const kalimbaIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#16100c"/>
  <path d="M10 10 H54 V40 Q54 56 32 56 Q10 56 10 40 Z" fill="#c98a4f"/>
  <rect x="12" y="15" width="40" height="3" rx="1.5" fill="#e9c77f"/>
  ${[0, 1, 2, 3, 4, 5, 6].map((k) => {
    const len = [22, 26, 30, 34, 30, 26, 22][k];
    return `<rect x="${14.5 + k * 5.2}" y="12" width="3.4" height="${len}" rx="1.7" fill="${k === 3 ? '#ffd2b0' : '#e8ecee'}"/>`;
  }).join('')}
  <circle cx="32" cy="49" r="3.2" fill="#120a04"/>
</svg>`;

const glassIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0a0d16"/>
  <ellipse cx="32" cy="13" rx="15" ry="4" fill="#b8a6ff" opacity=".55"/>
  <path d="M18 12 H46 V20 Q46 36 32 36 Q18 36 18 20 Z" fill="rgba(255,255,255,.08)" stroke="#e9e4ff" stroke-width="2.2"/>
  <path d="M18.6 22 H45.4 Q44.6 35 32 35 Q19.4 35 18.6 22 Z" fill="#7ab4ff" opacity=".7"/>
  <rect x="30.6" y="36" width="2.8" height="14" fill="#e9e4ff"/>
  <ellipse cx="32" cy="51" rx="10" ry="2.6" fill="#e9e4ff"/>
</svg>`;

const harpIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#140b0e"/>
  <path d="M13 54 V12 Q13 8 18 9 Q34 12 52 30" fill="none" stroke="#a0623c" stroke-width="5" stroke-linecap="round"/>
  <path d="M16 55 L53 33" stroke="#d9b07a" stroke-width="5" stroke-linecap="round"/>
  ${[0, 1, 2, 3, 4, 5].map((k) => {
    const x = 20 + k * 5.6;
    const top = 11 + Math.pow(k / 5, 1.5) * 15;
    const bottom = 53 - (x - 16) * (22 / 37);
    return `<line x1="${x}" x2="${x}" y1="${top}" y2="${bottom}" stroke="${k === 0 ? '#e0503f' : k === 3 ? '#f3cf86' : '#e9d8ab'}" stroke-width="1.8" stroke-linecap="round"/>`;
  }).join('')}
</svg>`;

const card = (bg, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">${bg}${body}</svg>`;

const ogKalimba = card(
  `<defs><radialGradient id="bg" cx="70%" cy="40%" r="65%"><stop offset="0" stop-color="#3a2212"/><stop offset=".6" stop-color="#1e1610"/><stop offset="1" stop-color="#16100c"/></radialGradient></defs><rect width="1200" height="630" fill="url(#bg)"/>`,
  `${kalimbaSvg(660, 84, 480, ['C4', 'G4', 'E5'], 'ok')}
  <text x="72" y="118" font-family="${MONO}" font-size="22" fill="#ff8a4c" letter-spacing="6">NO. 03 · THUMB PIANO</text>
  <text x="66" y="300" font-family="${DISPLAY}" font-weight="800" font-size="124" fill="#e7b07a" letter-spacing="2">KALIMBA</text>
  <text x="72" y="380" font-family="${SANS}" font-size="27" fill="#d9c6b2">Tap seventeen steel tines —</text>
  <text x="72" y="416" font-family="${SANS}" font-size="27" fill="#d9c6b2">and read songs in kalimba number tabs.</text>
  <text x="72" y="470" font-family="${MONO}" font-size="30" fill="#f6ede3" letter-spacing="8">1 1 5 5 6 6 5</text>
  ${footer('#ff8a4c')}`,
);

const ogGlass = card(
  `<defs><radialGradient id="bg" cx="70%" cy="0%" r="80%"><stop offset="0" stop-color="#2a2552"/><stop offset=".6" stop-color="#121633"/><stop offset="1" stop-color="#0a0d16"/></radialGradient></defs><rect width="1200" height="630" fill="url(#bg)"/>`,
  `${glassesSvg(600, 520, 560, ['G4', 'D5'], 'og')}
  <rect x="580" y="520" width="600" height="6" fill="rgba(255,255,255,.06)"/>
  <text x="72" y="118" font-family="${MONO}" font-size="22" fill="#b8a6ff" letter-spacing="6">NO. 04 · MUSICAL GLASSES, 1761</text>
  <text x="66" y="262" font-family="${DISPLAY}" font-weight="800" font-size="150" fill="#f2efff" letter-spacing="2">GLASS</text>
  <text x="66" y="392" font-family="${DISPLAY}" font-weight="800" font-size="150" fill="#cfc4ff" letter-spacing="2">HARP</text>
  <text x="72" y="448" font-family="${SANS}" font-size="27" fill="#b9c2dc">Circle a rim and the glass sings —</text>
  <text x="72" y="484" font-family="${SANS}" font-size="27" fill="#b9c2dc">faster for louder, many fingers for chords.</text>
  ${footer('#b8a6ff')}`,
);

const ogHarp = card(
  `<defs><radialGradient id="bg" cx="75%" cy="30%" r="70%"><stop offset="0" stop-color="#3a1a1f"/><stop offset=".6" stop-color="#1c1014"/><stop offset="1" stop-color="#140b0e"/></radialGradient></defs><rect width="1200" height="630" fill="url(#bg)"/>`,
  `${harpSvg(588, 52, 0.63, [4, 7], 'oh')}
  <text x="72" y="118" font-family="${MONO}" font-size="22" fill="#f3cf86" letter-spacing="6">NO. 05 · CELTIC LEVER HARP</text>
  <text x="66" y="262" font-family="${DISPLAY}" font-weight="800" font-size="150" fill="#fff1c9" letter-spacing="2">LEVER</text>
  <text x="66" y="392" font-family="${DISPLAY}" font-weight="800" font-size="150" fill="#f3cf86" letter-spacing="2">HARP</text>
  <text x="72" y="448" font-family="${SANS}" font-size="27" fill="#d8bfb6">Pluck, or drag across for a glissando —</text>
  <text x="72" y="484" font-family="${SANS}" font-size="27" fill="#d8bfb6">real sharping levers flip for every song.</text>
  ${footer('#f3cf86')}`,
);

/* ───────── ICO wrapper (a PNG inside a one-entry .ico) ───────── */

function pngToIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12); // image data offset
  return Buffer.concat([header, entry, png]);
}

/* ───────── render ───────── */

const png = (svg, w, h = w) => sharp(Buffer.from(svg), { density: 300 }).resize(w, h).png({ compressionLevel: 9 }).toBuffer();

await mkdir(new URL('og/', OUT), { recursive: true });

const files = {
  'favicon.svg': umbrellaIcon(),
  'favicon-steelpan.svg': steelpanIcon,
  'favicon-theremin.svg': thereminIcon,
  'favicon-kalimba.svg': kalimbaIcon,
  'favicon-glass-harp.svg': glassIcon,
  'favicon-harp.svg': harpIcon,
};
for (const [name, svg] of Object.entries(files)) await writeFile(new URL(name, OUT), svg.replace(/\n\s*/g, ' ').trim());

await writeFile(new URL('favicon.ico', OUT), pngToIco(await png(umbrellaIcon(), 32), 32));
await writeFile(new URL('apple-touch-icon.png', OUT), await png(umbrellaIcon(180, 22), 180));
await writeFile(new URL('icon-192.png', OUT), await png(umbrellaIcon(192, 0), 192));
await writeFile(new URL('icon-512.png', OUT), await png(umbrellaIcon(512, 0), 512));
await writeFile(new URL('icon-maskable-512.png', OUT), await png(umbrellaIcon(512, 92), 512));

await writeFile(new URL('og/home.png', OUT), await png(ogHome, 1200, 630));
await writeFile(new URL('og/steelpan.png', OUT), await png(ogSteelpan, 1200, 630));
await writeFile(new URL('og/theremin.png', OUT), await png(ogTheremin, 1200, 630));
await writeFile(new URL('og/kalimba.png', OUT), await png(ogKalimba, 1200, 630));
await writeFile(new URL('og/glass-harp.png', OUT), await png(ogGlass, 1200, 630));
await writeFile(new URL('og/harp.png', OUT), await png(ogHarp, 1200, 630));

console.log('Wrote favicons, app icons and Open Graph cards to /public');

/* ───────── one card per song page (og/songs/<instrument>--<song>.png) ───────── */

// The song data imports TypeScript without extensions, which Node can't resolve; Vite can.
const vite = await createServer({
  root: fileURLToPath(new URL('..', import.meta.url)),
  configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false },
});
const { songPages, notate, songImage } = await vite.ssrLoadModule('/src/data/song-pages.ts');
const { REST } = await vite.ssrLoadModule('/src/lib/music.ts');
await vite.close();

const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Each instrument's world: background, art (with some notes lit), colours and a line of copy. */
const WORLDS = {
  steelpan: {
    bg: `<defs><radialGradient id="bg" cx="72%" cy="45%" r="60%"><stop offset="0" stop-color="#2a2414"/><stop offset=".6" stop-color="#0e1a1d"/><stop offset="1" stop-color="#0b1315"/></radialGradient></defs><rect width="1200" height="630" fill="url(#bg)"/>`,
    art: (lit) => panSvg(900, 315, 245, lit, 'o'),
    accent: '#f6b23c', title: '#e6eef0', sub: '#c9d4d1', label: 'STEELPAN', line: 'Steel drum notes · play along in your browser',
  },
  theremin: {
    bg: `<defs><radialGradient id="bg" cx="70%" cy="110%" r="80%"><stop offset="0" stop-color="#0b2430"/><stop offset=".6" stop-color="#0c0c18"/><stop offset="1" stop-color="#08080f"/></radialGradient></defs><rect width="1200" height="630" fill="url(#bg)"/>`,
    art: () => `<rect x="1108" y="88" width="5" height="460" rx="2.5" fill="#d8a24a"/><circle cx="1110.5" cy="86" r="9" fill="#d8a24a"/>${waveSvg(660, 1090, 330, 110, 5.5, 'og', 4)}`,
    accent: '#5cf2d6', title: '#e9ecff', sub: '#b9bde0', label: 'THEREMIN', line: 'Theremin play-along · no touching required',
  },
  kalimba: {
    bg: `<defs><radialGradient id="bg" cx="70%" cy="40%" r="65%"><stop offset="0" stop-color="#3a2212"/><stop offset=".6" stop-color="#1e1610"/><stop offset="1" stop-color="#16100c"/></radialGradient></defs><rect width="1200" height="630" fill="url(#bg)"/>`,
    art: (lit) => kalimbaSvg(680, 96, 460, lit, 'ok'),
    accent: '#ff8a4c', title: '#f1c38f', sub: '#d9c6b2', label: 'KALIMBA', line: 'Kalimba number tabs · play along in your browser',
  },
  'glass-harp': {
    bg: `<defs><radialGradient id="bg" cx="70%" cy="0%" r="80%"><stop offset="0" stop-color="#2a2552"/><stop offset=".6" stop-color="#121633"/><stop offset="1" stop-color="#0a0d16"/></radialGradient></defs><rect width="1200" height="630" fill="url(#bg)"/>`,
    art: (lit) => `${glassesSvg(640, 500, 540, lit, 'og')}<rect x="620" y="500" width="580" height="6" fill="rgba(255,255,255,.06)"/>`,
    accent: '#b8a6ff', title: '#f2efff', sub: '#b9c2dc', label: 'GLASS HARP', line: 'Singing glasses · play along in your browser',
  },
  harp: {
    bg: `<defs><radialGradient id="bg" cx="75%" cy="30%" r="70%"><stop offset="0" stop-color="#3a1a1f"/><stop offset=".6" stop-color="#1c1014"/><stop offset="1" stop-color="#140b0e"/></radialGradient></defs><rect width="1200" height="630" fill="url(#bg)"/>`,
    art: (lit) => harpSvg(700, 84, 0.52, lit.map((n) => fingeringsFor(n)[0]?.index).filter((i) => i !== undefined), 'oh'),
    accent: '#f3cf86', title: '#fff1c9', sub: '#d8bfb6', label: 'LEVER HARP', line: 'Harp notes and levers · play along',
  },
};

/** Greedy word wrap into at most `max` lines of about `width` characters. */
function wrap(text, width, max = 3) {
  const lines = [];
  // keep a parenthetical together: "(DANNY BOY)" never splits
  const words = text.replace(/\(([^)]*)\)/g, (m) => m.replace(/ /g, '\u00a0')).split(' ');
  for (const word of words) {
    const last = lines[lines.length - 1];
    if (last && (last + ' ' + word).length <= width) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines.length > max ? [...lines.slice(0, max - 1), lines.slice(max - 1).join(' ')] : lines;
}

/** The first notes, in the instrument's notation; kalimba octave dots are drawn, not typed. */
function notesRow(slug, song, x, y, color) {
  const notes = song.notes.filter((n) => n.note !== REST).slice(0, 8);
  return notes.map((n, k) => {
    const cx = x + k * 62;
    if (slug === 'kalimba') {
      const label = notate(slug, n.note);
      const digit = label[0];
      const dots = label.length - 1 === 0 ? 0 : label.includes('̈') ? 2 : 1;
      const dotSvg = Array.from({ length: dots }, (_, d) => `<circle cx="${cx + 9 + (dots === 2 ? (d ? 6 : -6) : 0)}" cy="${y - 30}" r="3.4" fill="${color}"/>`).join('');
      return `<text x="${cx}" y="${y}" font-family="${MONO}" font-size="32" fill="${color}">${digit}</text>${dotSvg}`;
    }
    return `<text x="${cx}" y="${y}" font-family="${MONO}" font-size="${notate(slug, n.note).length > 2 ? 24 : 28}" fill="${color}">${esc(notate(slug, n.note))}</text>`;
  }).join('');
}

function songCard({ instrument, song }) {
  const w = WORLDS[instrument.slug];
  const lit = [...new Set(song.notes.filter((n) => n.note !== REST).map((n) => n.note))].slice(0, 3);
  const lines = wrap(song.title.toUpperCase(), 13);
  const longest = Math.max(...lines.map((l) => l.length));
  const size = Math.min(104, Math.floor(1060 / longest), lines.length === 3 ? 84 : 104);
  const top = 118 + 24 + size * 0.86;
  const title = lines.map((l, i) => `<text x="66" y="${top + i * size * 0.98}" font-family="${DISPLAY}" font-weight="800" font-size="${size}" fill="${i === lines.length - 1 ? w.accent : w.title}" letter-spacing="1">${esc(l)}</text>`).join('');
  const after = top + (lines.length - 1) * size * 0.98;
  return card(w.bg, `${w.art(lit)}
    <text x="72" y="118" font-family="${MONO}" font-size="22" fill="${w.accent}" letter-spacing="6">LEARN IT ON THE ${w.label}</text>
    ${title}
    <text x="72" y="${after + 52}" font-family="${SANS}" font-size="26" fill="${w.sub}">${esc(w.line)}</text>
    ${notesRow(instrument.slug, song, 72, after + 116, '#f6ede3')}
    ${footer(w.accent)}`);
}

await mkdir(new URL('og/songs/', OUT), { recursive: true });
const pages = songPages();
for (const page of pages) {
  await writeFile(new URL(songImage(page.instrument.slug, page.song.id), OUT), await png(songCard(page), 1200, 630));
}
console.log(`Wrote ${pages.length} song cards to /public/og/songs`);

