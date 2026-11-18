import fs from 'node:fs';
import path from 'node:path';
import type { APIRoute } from 'astro';

export const prerender = true;

/** The repository's robots.txt stays the single source (crawler policy, sitemap). */
export const GET: APIRoute = () =>
  new Response(fs.readFileSync(path.resolve(process.cwd(), '../public/robots.txt'), 'utf8'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
