import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readBuiltRoute = (path) =>
  readFile(new URL(`../dist/${path}`, import.meta.url), 'utf8');

test('home route renders its primary content and navigation targets', async () => {
  const html = await readBuiltRoute('index.html');

  assert.match(html, /<title>AI-First Monorepo Boilerplate<\/title>/);
  assert.match(html, /<main id="main-content">/);
  assert.match(html, /id="features"/);
  assert.match(html, /Everything wired, nothing locked in/);
  assert.match(html, /id="stack"/);
  assert.match(html, /The stack/);
});

test('not-found route renders a recovery link', async () => {
  const html = await readBuiltRoute('404.html');

  assert.match(
    html,
    /<title>404 — Page not found · AI-First Monorepo Boilerplate<\/title>/,
  );
  assert.match(html, /<main id="main-content"/);
  assert.match(html, /href="\/"[^>]*>← Back home<\/a>/);
});

test('robots route publishes the production sitemap', async () => {
  const body = await readBuiltRoute('robots.txt');

  assert.equal(
    body,
    'User-agent: *\nAllow: /\n\nSitemap: https://landing.workers.dev/sitemap-index.xml\n',
  );
});
