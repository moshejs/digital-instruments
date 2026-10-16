/** Site-wide metadata and URL helpers. */

export const SITE = {
  name: "Moshe's Digital Instruments",
  shortName: 'Digital Instruments',
  author: 'Moshe Malka',
  repo: 'https://github.com/moshejs/digital-instruments',
  description:
    'Five real instruments, synthesized live in your browser — a steelpan, a theremin, a kalimba, a glass harp and a lever harp. No samples, no installs, fifteen songs with a follow-along guide.',
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

/** Opens a pre-filled GitHub issue for a song request. */
export const SONG_REQUEST_URL = `${SITE.repo}/issues/new?template=song-request.yml`;

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Prefixes a site-relative path with the deploy base (e.g. "/digital-instruments"). */
export const withBase = (path = ''): string => `${BASE}/${path.replace(/^\//, '')}`;
