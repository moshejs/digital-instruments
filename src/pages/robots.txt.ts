import type { APIRoute } from 'astro';
import { withBase } from '../lib/site';

// Generated so the sitemap URL follows the deploy target's site and base (see astro.config.mjs).
export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL(withBase('sitemap-index.xml'), site).href;
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
