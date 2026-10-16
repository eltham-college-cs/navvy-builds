/**
 * jsdom has no layout engine and no stylesheets for parsed documents, so tests
 * use a tiny cascade built from the checker's own CSS parser: the last matching
 * rule wins, inherited properties come from the parent, and everything else
 * falls back to a table of browser defaults.
 */
import { parsePage } from '../dom';
import { unstyledHtml } from '../sanitize';
import { parseAllCss, scan, type CssRule } from '../source';
import type { StyleEnv } from '../style';

const INHERITED = new Set(['color', 'font-family', 'font-size', 'text-align']);
const DEFAULTS: Record<string, string> = {
  color: 'black',
  'background-color': 'transparent',
  'font-family': 'serif',
  'font-size': '16px',
  'text-align': 'start',
};
const SHORTHAND: Record<string, string> = { background: 'background-color' };

function declared(rules: CssRule[], el: Element, property: string): string {
  let value = '';
  for (const rule of rules) {
    let matches = false;
    try {
      matches = el.matches(rule.selector);
    } catch {
      /* invalid selector */
    }
    if (!matches) continue;
    for (const d of rule.declarations) {
      if (d.property === property || SHORTHAND[d.property] === property) value = d.value;
    }
  }
  const inline = /(?:^|;)\s*([a-z-]+)\s*:\s*([^;]+)/gi;
  for (const m of (el.getAttribute('style') ?? '').matchAll(inline)) {
    if (m[1].toLowerCase() === property) value = m[2].trim();
  }
  return value;
}

function cascade(rules: CssRule[], el: Element, property: string): string {
  const value = declared(rules, el, property);
  if (value) return value;
  if (el.tagName === 'A' && property === 'color') return 'blue';
  if (INHERITED.has(property) && el.parentElement) return cascade(rules, el.parentElement, property);
  return DEFAULTS[property] ?? '';
}

export function fakeStyleEnv(html: string): StyleEnv {
  const styled = parsePage(html);
  const plainHtml = unstyledHtml(html);
  const plain = parsePage(plainHtml);
  const rules = parseAllCss(scan(html)).rules;
  return {
    elements: (selector) => Array.from(styled.querySelectorAll(selector)),
    computed: (el, property) => cascade(rules, el, property),
    defaultValue: (selector, index, property) => {
      const el = plain.querySelectorAll(selector)[index];
      return el ? cascade([], el, property) : undefined;
    },
    declares: (el, property) => declared(rules, el, property) !== '',
  };
}
