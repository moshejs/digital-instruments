/**
 * /llms.txt: a plain-text map of the site for AI assistants and answer engines
 * (https://llmstxt.org): what each instrument is, and every song page.
 */
import type { APIRoute } from 'astro';
import { INSTRUMENTS, fullName } from '../data/instruments';
import { pageDescription, pageTitle, songPath, songsFor } from '../data/song-pages';
import { SITE, withBase } from '../lib/site';

export const GET: APIRoute = ({ site }) => {
  const abs = (path: string) => new URL(withBase(path), site).href;
  const lines = [
    `# ${SITE.name}`,
    '',
    `> ${SITE.description}`,
    '',
    'Everything runs in the browser with the Web Audio API: free, no sign-up, no downloads. Each song page loads the instrument with the song ready, offers Listen and Play along (the next note lights up until you play it), and prints every note in the instrument\'s own notation. All songs are public domain or traditional.',
    '',
    '## Instruments',
    '',
    ...INSTRUMENTS.map((i) => `- [${fullName(i)}](${abs(`${i.slug}/`)}): ${i.description}`),
    ...INSTRUMENTS.flatMap((i) => [
      '',
      `## Songs on the ${i.name.toLowerCase()}`,
      '',
      ...songsFor(i.slug).map((song) => {
        const page = { instrument: i, song };
        return `- [${pageTitle(page)}](${abs(songPath(i.slug, song.id))}): ${pageDescription(page)}`;
      }),
    ]),
    '',
    '## Optional',
    '',
    `- [Source code](${SITE.repo}): Astro + TypeScript, MIT licensed.`,
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
