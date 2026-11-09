/**
 * The Sixth Form project: index.html, style.css and script.js. These helpers
 * find the <link> and <script> tags that load the other files and build the
 * two pages the builder needs: a static one for HTML and CSS checks (scripts
 * removed) and a runner page that really runs the student's JavaScript.
 */
import type { FileName } from '../lesson-schema';
import { HARNESS } from './harness';
import { guardLoops } from './js';
import { sanitize } from './sanitize';

export type Files = Partial<Record<FileName, string>>;

export interface FileLink {
  /** The whole tag as written. */
  tag: string;
  index: number;
  line: number;
  href: string;
}

const lineOf = (s: string, i: number) => s.slice(0, i).split('\n').length;
const attr = (tag: string, name: string) =>
  new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag)?.slice(1).find((v) => v !== undefined);

/** A file name as the student wrote it, without ./ in front. */
export const cleanPath = (p: string) => p.trim().replace(/^\.\//, '');

/** Every <link> tag, with its href. */
export function linkTags(html: string): (FileLink & { rel: string })[] {
  return Array.from(html.matchAll(/<link\b[^>]*>/gi), (m) => ({
    tag: m[0],
    index: m.index!,
    line: lineOf(html, m.index!),
    href: cleanPath(attr(m[0], 'href') ?? ''),
    rel: (attr(m[0], 'rel') ?? '').toLowerCase(),
  }));
}

/** Every <script> element, with its src (empty for inline scripts) and its code. */
export function scriptTags(html: string): (FileLink & { code: string; end: number; codeLine: number })[] {
  return Array.from(html.matchAll(/<script\b([^>]*)>([\s\S]*?)(<\/script\s*>|$)/gi), (m) => {
    const open = `<script${m[1]}>`;
    return {
      tag: m[0],
      index: m.index!,
      end: m.index! + m[0].length,
      line: lineOf(html, m.index!),
      codeLine: lineOf(html, m.index! + open.length),
      href: cleanPath(attr(open, 'src') ?? ''),
      code: m[2],
    };
  });
}

/** The <link> that loads style.css, if there is one that works. */
export const cssLink = (html: string) =>
  linkTags(html).find((l) => l.href.toLowerCase() === 'style.css' && l.rel.split(/\s+/).includes('stylesheet'));

/** The <script src="script.js"> tag, if there is one. */
export const jsLink = (html: string) => scriptTags(html).find((s) => s.href.toLowerCase() === 'script.js');

/** Replace the first match of a tag in html, keeping every other character. */
function splice(html: string, at: { index: number; tag: string }, insert: string) {
  return html.slice(0, at.index) + insert + html.slice(at.index + at.tag.length);
}

/** Inline style.css where index.html links it, so it shows in the preview. */
function withCss(html: string, files: Files): string {
  const link = cssLink(html);
  if (!link || files['style.css'] === undefined) return html;
  // Keep the same number of lines so line numbers in index.html still match.
  const css = files['style.css'].replace(/<\/style/gi, '<\\/style').replace(/\n/g, ' ');
  return splice(html, link, `<style data-nb-file="style.css">${css}</style>`);
}

/** The page for HTML and CSS checks: style.css inlined, no scripts. */
export function staticPage(files: Files): { html: string; removedScripts: boolean } {
  return sanitize(withCss(files['index.html'] ?? '', files));
}

/** The harness on one line, so it doesn't move the student's line numbers. */
const HARNESS_ONE_LINE = HARNESS.replace(/\n\s*/g, ' ');

const CSP =
  "default-src 'none'; img-src data: https: http:; style-src 'unsafe-inline'; font-src data: https:; script-src 'unsafe-inline' 'unsafe-eval'";

export interface RunnerPage {
  html: string;
  /** Line in the runner page where script.js starts, for mapping error lines. */
  scriptStart?: number;
}

/** Put the CSP and the harness first, after the doctype if there is one. */
export function withHarness(html: string): string {
  const head = `<meta http-equiv="Content-Security-Policy" content="${CSP}"><script>${HARNESS_ONE_LINE}</script>`;
  const doctype = /^\s*<!doctype[^>]*>/i.exec(html);
  // The inserted text has no newlines, so line numbers don't move.
  return doctype ? doctype[0] + head + html.slice(doctype[0].length) : head + html;
}

/** The page that runs: style.css and script.js inlined, loops guarded, harness first. */
export function runnerPage(files: Files): RunnerPage {
  let html = withCss(files['index.html'] ?? '', files);
  // A student <base> or meta refresh would break the preview.
  html = html.replace(/<base\b[^>]*>/gi, '').replace(/<meta\b[^>]*http-equiv[^>]*>/gi, '');
  // Inline scripts in index.html are guarded too.
  for (const s of scriptTags(html).reverse()) {
    if (s.href) continue;
    const open = s.tag.slice(0, s.tag.length - s.code.length - (/<\/script\s*>$/i.exec(s.tag)?.[0].length ?? 0));
    html = splice(html, s, `${open}${guardLoops(s.code)}</script>`);
  }
  let scriptStart: number | undefined;
  const link = jsLink(html);
  if (link && files['script.js'] !== undefined) {
    const code = guardLoops(files['script.js']).replace(/<\/script/gi, '<\\/script');
    html = splice(html, link, `<script>${code}\n//# sourceURL=script.js\n</script>`);
    scriptStart = lineOf(html, link.index);
  }
  return { html: withHarness(html), scriptStart };
}
