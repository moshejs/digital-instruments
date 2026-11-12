/** Site-wide metadata and URL helpers. */

export const SITE = {
  name: "Moshe's Digital Instruments",
  shortName: 'Digital Instruments',
  author: 'Moshe Malka',
  repo: 'https://github.com/moshejs/digital-instruments',
  description:
    'Six instruments, synthesized live in your browser: steelpan, theremin, kalimba, glass harp, lever harp and synth. Fifteen songs with a follow-along guide.',
  locale: 'en_US',
  themeColor: '#121110',
} as const;

/**
 * Outside services, each off until its value is filled in.
 * - goatcounter: your GoatCounter code (the "code" in code.goatcounter.com).
 *   Cookie-free analytics, so no consent banner is needed.
 * - google / bing: the content="…" value of each search console's
 *   verification meta tag.
 */
export const SERVICES: { goatcounter: string; googleVerification: string; bingVerification: string } = {
  goatcounter: '',
  googleVerification: '',
  bingVerification: '',
};

/**
 * The studio credit's links, tagged with the project they came from. The synth
 * page keeps its own slug ("subtractive-synth"): it started as its own project.
 */
export const studioUrl = (slug: string, hash = ''): string =>
  `https://www.quentin.software/?utm_source=${encodeURIComponent(slug)}&utm_medium=studio-credit${hash}`;

/** Opens a pre-filled GitHub issue for a song request. */
export const SONG_REQUEST_URL = `${SITE.repo}/issues/new?template=song-request.yml`;

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Prefixes a site-relative path with the deploy base (e.g. "/digital-instruments"). */
export const withBase = (path = ''): string => `${BASE}/${path.replace(/^\//, '')}`;
