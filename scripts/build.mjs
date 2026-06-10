#!/usr/bin/env node
// Build Classic Academic CV PDFs from markdown sources.
//   node scripts/build.mjs            -> builds whichever of cv.ko.md / cv.en.md exist
//   node scripts/build.mjs ko         -> builds Korean only
//   node scripts/build.mjs en         -> builds English only
//
// Pipeline: cv.<lang>.md  --markdown-it-->  HTML (+ classic.css)  --headless Chrome-->  dist/cv.<lang>.pdf
// Photo (frontmatter `photo:`) is embedded for Korean only.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = join(ROOT, 'dist');
const CSS = readFileSync(join(ROOT, 'templates', 'classic.css'), 'utf8');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const md = new MarkdownIt({ html: true, linkify: true, typographer: false });

function parseSource(file) {
  const raw = readFileSync(file, 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error(`frontmatter(---)가 없습니다: ${file}`);
  return { meta: yaml.load(m[1]) || {}, body: m[2] };
}

// Convert "LEFT || RIGHT" lines into aligned entry rows before markdown rendering.
function preprocessEntries(body) {
  return body
    .split('\n')
    .map((line) => {
      const i = line.indexOf(' || ');
      if (i === -1 || line.trim().startsWith('|')) return line;
      const left = md.renderInline(line.slice(0, i).trim());
      const right = md.renderInline(line.slice(i + 4).trim());
      return `\n<div class="entry"><span class="entry-left">${left}</span><span class="entry-right">${right}</span></div>\n`;
    })
    .join('\n');
}

// Post-process rendered HTML: tag the publications list + style citation counts.
function postprocess(html) {
  // class onto the <ol> that immediately follows a "Publications" heading
  html = html.replace(
    /(<h2[^>]*>[^<]*Publications[^<]*<\/h2>\s*(?:<p[^>]*>[\s\S]*?<\/p>\s*)?)<ol([^>]*)>/gi,
    '$1<ol$2 class="pubs-list">'
  );
  // (1,186 cites) / (334 citations) -> styled span
  html = html.replace(
    /\((\d[\d,]*)\s*(?:cites|citations)\)/gi,
    '<span class="cites">($1 cites)</span>'
  );
  return html;
}

// Monochrome inline SVG icons (fill via currentColor).
const SCHOLAR_SVG =
  '<svg class="ic" viewBox="0 0 24 24" aria-label="Google Scholar"><path d="M12 24a7 7 0 1 1 0-14 7 7 0 0 1 0 14zm0-24L0 9.5l4.838 3.94A8 8 0 0 1 12 9a8 8 0 0 1 7.162 4.44L24 9.5z"/></svg>';
const LINKEDIN_SVG =
  '<svg class="ic" viewBox="0 0 24 24" aria-label="LinkedIn"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>';

function buildContact(meta) {
  const emails = (Array.isArray(meta.email) ? meta.email : [meta.email]).filter(Boolean);
  const parts = [];
  emails.forEach((e) => parts.push(`<a href="mailto:${e}">${e}</a>`));
  if (meta.homepage) {
    const disp = String(meta.homepage).replace(/^https?:\/\//, '');
    const href = String(meta.homepage).startsWith('http') ? meta.homepage : `https://${meta.homepage}`;
    parts.push(`<a href="${href}">${disp}</a>`);
  }

  const sep = '<span class="sep">·</span>';
  let line = parts.join(sep);

  // Google Scholar + LinkedIn as icons, on the same line as email.
  const icons = [];
  if (meta.scholar) icons.push(`<a class="ic-link" href="${meta.scholar}" aria-label="Google Scholar">${SCHOLAR_SVG}</a>`);
  if (meta.linkedin) icons.push(`<a class="ic-link" href="${meta.linkedin}" aria-label="LinkedIn">${LINKEDIN_SVG}</a>`);
  if (icons.length) line += `${sep}<span class="ic-group">${icons.join('')}</span>`;

  return `<div>${line}</div>`;
}

function imgDataUri(absPath) {
  const ext = absPath.split('.').pop().toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${readFileSync(absPath).toString('base64')}`;
}

function buildHeader(meta, lang) {
  const name = lang === 'en' ? meta.name_en || meta.name : meta.name;
  const title = lang === 'en' ? meta.title_en || meta.title : meta.title;
  const metrics = lang === 'en' ? meta.metrics_en || meta.metrics : meta.metrics;

  // Photo: Korean only.
  let photoHtml = '';
  let withPhoto = false;
  if (lang === 'ko' && meta.photo) {
    withPhoto = true;
    const abs = resolve(ROOT, meta.photo);
    photoHtml = existsSync(abs)
      ? `<img class="portrait" src="${imgDataUri(abs)}" alt="portrait">`
      : `<div class="portrait-placeholder">PHOTO<br>${meta.photo}</div>`;
  }

  const contact = buildContact(meta);
  const metricsHtml = metrics ? `<div>${md.renderInline(String(metrics))}</div>` : '';

  return `<header class="cv-header${withPhoto ? ' with-photo' : ''}">
  ${photoHtml}
  <div class="head-text">
    <div class="name">${name}</div>
    ${title ? `<div class="subtitle">${md.renderInline(String(title))}</div>` : ''}
    <div class="contact">${contact}${metricsHtml}</div>
  </div>
</header>`;
}

function renderDocument(file, lang) {
  const { meta, body } = parseSource(file);
  const bodyHtml = postprocess(md.render(preprocessEntries(body)));
  const header = buildHeader(meta, lang);
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<title>CV — ${meta.name_en || meta.name}</title>
<style>${CSS}</style>
</head>
<body>
${header}
<main>${bodyHtml}</main>
</body>
</html>`;
}

function toPdf(htmlAbs, pdfAbs) {
  if (!existsSync(CHROME)) throw new Error(`Chrome를 찾을 수 없습니다: ${CHROME}`);
  execFileSync(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-pdf-header-footer',
      '--no-first-run',
      `--print-to-pdf=${pdfAbs}`,
      `file://${htmlAbs}`,
    ],
    { stdio: 'ignore' }
  );
}

function buildLang(lang) {
  const src = join(ROOT, `cv.${lang}.md`);
  if (!existsSync(src)) {
    console.log(`  skip ${lang}: ${src} 없음`);
    return false;
  }
  mkdirSync(DIST, { recursive: true });
  const html = renderDocument(src, lang);
  const htmlPath = join(DIST, `_cv.${lang}.html`);
  const pdfPath = join(DIST, `cv.${lang}.pdf`);
  writeFileSync(htmlPath, html, 'utf8');
  toPdf(htmlPath, pdfPath);
  console.log(`  ✓ ${lang}: dist/cv.${lang}.pdf`);
  return true;
}

const arg = process.argv[2];
const langs = arg ? [arg] : ['ko', 'en'];
console.log('Building CV PDFs (Classic Academic)…');
let built = 0;
for (const l of langs) if (buildLang(l)) built++;
console.log(built ? 'Done.' : 'Nothing built.');
