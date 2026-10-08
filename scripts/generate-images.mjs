/**
 * Renders every favicon, app icon and Open Graph card into /public.
 * Run with `npm run icons` (Node ≥ 22.18 for TypeScript type-stripping).
 * Outputs are committed, so CI never needs to run this.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { buildPads } from '../src/lib/steelpan-layout.ts';

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
  <text x="72" y="484" font-family="${SANS}" font-size="27" fill="#c9d4d1">and learn nine songs by following the lights.</text>
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
    <linearGradient id="sig" x1="0" x2="1"><stop offset="0" stop-color="#f6b23c"/><stop offset=".45" stop-color="#2ad4c4"/><stop offset=".7" stop-color="#5cf2d6"/><stop offset="1" stop-color="#ff5db0"/></linearGradient>
    <clipPath id="screen"><rect x="840" y="80" width="300" height="200" rx="6"/></clipPath>
  </defs>
  <rect width="1200" height="630" fill="#121110"/><rect width="1200" height="630" fill="url(#a)"/><rect width="1200" height="630" fill="url(#c)"/>
  <text x="72" y="120" font-family="${MONO}" font-size="22" fill="#a8a39a" letter-spacing="6">WORKSHOP CATALOGUE</text>
  <text x="70" y="196" font-family="${DISPLAY}" font-weight="700" font-size="54" fill="#a8a39a" letter-spacing="8">MOSHE'S</text>
  <text x="64" y="312" font-family="${DISPLAY}" font-weight="800" font-size="124" fill="#edeae3">DIGITAL</text>
  <text x="64" y="424" font-family="${DISPLAY}" font-weight="800" font-size="124" fill="#edeae3">INSTRUMENTS</text>
  <rect x="72" y="452" width="640" height="5" rx="2.5" fill="url(#sig)"/>
  <text x="72" y="508" font-family="${SANS}" font-size="26" fill="#a8a39a">A steelpan and a theremin, synthesized live in your browser.</text>
  <text x="72" y="584" font-family="${MONO}" font-size="18" fill="#6e6a63">moshejs.github.io/digital-instruments</text>
  <rect x="840" y="80" width="300" height="200" rx="6" fill="#07070d" stroke="rgba(237,234,227,.14)"/>
  <g clip-path="url(#screen)">${waveSvg(855, 1125, 180, 62, 4.2, 'h', 3)}</g>
  <rect x="1118" y="98" width="3" height="164" fill="#d8a24a"/>
  ${panSvg(990, 452, 128, ['E4', 'C5'], 'h')}
</svg>`;

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

console.log('Wrote favicons, app icons and Open Graph cards to /public');
