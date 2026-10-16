/**
 * Student HTML is never run as script. These helpers make the copy of the page
 * that goes into the preview iframe; the student's own code is never changed.
 */

export interface Sanitized {
  html: string;
  /** True when <script>, on* attributes or javascript: links were removed. */
  removedScripts: boolean;
}

const ON_ATTR = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;

export function sanitize(source: string): Sanitized {
  let removed = false;
  let html = source.replace(/<script\b[\s\S]*?(<\/script\s*>|$)/gi, () => {
    removed = true;
    return '';
  });
  html = html.replace(/<[a-z][a-z0-9-]*\b[^>]*>/gi, (tag) => {
    let t = tag.replace(ON_ATTR, () => {
      removed = true;
      return '';
    });
    t = t.replace(/(href|src)\s*=\s*(["']?)\s*javascript:[^"'\s>]*/gi, (_m, attr, q) => {
      removed = true;
      return `${attr}=${q}#`;
    });
    return t;
  });
  // A student <base> or meta refresh would break the preview.
  html = html.replace(/<base\b[^>]*>/gi, '').replace(/<meta\b[^>]*http-equiv[^>]*>/gi, '');
  return { html, removedScripts: removed };
}

/**
 * Point library paths (images/football-1.png) at the shipped image library and
 * add a <base> so other relative paths resolve against the site, in the preview only.
 */
export function previewHtml(html: string, siteUrl: string, libraryUrl: string): string {
  const rewritten = html.replace(
    /(\bsrc\s*=\s*["']?)\s*(?:\.\/)?images\/([a-z0-9-]+\.png)/gi,
    (_m, before, file) => `${before}${libraryUrl}${file.toLowerCase()}`,
  );
  const base = `<base href="${siteUrl}">`;
  if (/<head\b[^>]*>/i.test(rewritten)) return rewritten.replace(/<head\b[^>]*>/i, (m) => m + base);
  return base + rewritten;
}

/** The same page with every author style removed: the browser defaults. */
export function unstyledHtml(html: string): string {
  return html
    .replace(/<style\b[\s\S]*?(<\/style\s*>|$)/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/<[a-z][a-z0-9-]*\b[^>]*>/gi, (tag) => tag.replace(/\s+style\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, ''));
}
