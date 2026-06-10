#!/usr/bin/env node
// Build the 겸임교원 자기소개서 + 활동계획서 PDF from a single markdown source.
//   node scripts/build-statement.mjs   -> dist/statement.ko.pdf
//
// Pipeline: statement.ko.md --markdown-it--> HTML (+ classic.css + statement.css)
//           --headless Chrome--> dist/statement.ko.pdf
// Each top-level `# H1` starts a new page; KO only, no photo.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = join(ROOT, 'dist');
const CSS =
  readFileSync(join(ROOT, 'templates', 'classic.css'), 'utf8') +
  '\n' +
  readFileSync(join(ROOT, 'templates', 'statement.css'), 'utf8');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const md = new MarkdownIt({ html: true, linkify: true, typographer: false });

function parseSource(file) {
  const raw = readFileSync(file, 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error(`frontmatter(---)가 없습니다: ${file}`);
  return { meta: yaml.load(m[1]) || {}, body: m[2] };
}

// Split the body into one section per top-level `# H1` (## and deeper stay inside).
function splitSections(body) {
  const sections = [];
  let cur = null;
  for (const line of body.split('\n')) {
    const m = line.match(/^#\s+(.+?)\s*$/);
    if (m) {
      cur = { title: m[1], lines: [] };
      sections.push(cur);
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  return sections.map((s) => ({ title: s.title, md: s.lines.join('\n') }));
}

function buildApplicant(meta) {
  const parts = [meta.name, meta.title].filter(Boolean).map((t) => md.renderInline(String(t)));
  return `지원자 &nbsp; ${parts.join(' &nbsp;·&nbsp; ')}`;
}

function renderDocument(file) {
  const { meta, body } = parseSource(file);
  const applicant = buildApplicant(meta);
  const pages = splitSections(body)
    .map(
      ({ title, md: src }) => `<section class="doc-page">
  <div class="doc-head">
    <div class="doc-title">${title}</div>
    <div class="applicant">${applicant}</div>
  </div>
  <div class="doc-body">${md.render(src)}</div>
</section>`
    )
    .join('\n');

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${meta.name_en || meta.name} — 겸임교원 지원</title>
<style>${CSS}</style>
</head>
<body>
${pages}
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

const src = join(ROOT, 'statement.ko.md');
if (!existsSync(src)) {
  console.log(`  skip: ${src} 없음`);
  process.exit(0);
}
mkdirSync(DIST, { recursive: true });
const html = renderDocument(src);
const htmlPath = join(DIST, '_statement.ko.html');
const pdfPath = join(DIST, 'statement.ko.pdf');
writeFileSync(htmlPath, html, 'utf8');
console.log('Building statement PDF (겸임교원 자기소개서 + 활동계획서)…');
toPdf(htmlPath, pdfPath);
console.log('  ✓ dist/statement.ko.pdf');
