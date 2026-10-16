/**
 * Checks on the raw text the student typed. The browser silently repairs
 * broken HTML, so these look at what was actually written.
 */
import { BRITISH, KNOWN_PROPERTIES, closestProperty } from './css-properties';
import { fail, pass, type CheckResult, type Mistake } from './types';

export const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr',
]);
const RAW_TEXT = new Set(['script', 'style', 'title', 'textarea']);
/** Tags that show on the page, so they belong in body, not head. */
const VISIBLE = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'a', 'img', 'div', 'span',
  'header', 'nav', 'main', 'section', 'article', 'footer', 'table', 'strong', 'em', 'br', 'hr',
]);

export interface TagEvent {
  kind: 'open' | 'close';
  name: string;
  index: number;
  line: number;
  /** Open elements around this tag, outermost first (open events only). */
  ancestors: string[];
}

export interface ScanError {
  kind: 'unclosed' | 'stray' | 'void-close';
  name: string;
  line: number;
}

export interface StyleBlock {
  content: string;
  /** Index of the first character of content in the source. */
  offset: number;
}

export interface Scan {
  source: string;
  events: TagEvent[];
  errors: ScanError[];
  doctype: { found: boolean; first: boolean; line?: number };
  styles: StyleBlock[];
}

export function lineAt(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i++) if (source[i] === '\n') line++;
  return line;
}

/** Find the end of a tag starting at `from`, skipping quoted attribute values. */
function tagEnd(source: string, from: number): number {
  let quote = '';
  for (let i = from; i < source.length; i++) {
    const c = source[i];
    if (quote) {
      if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '>') return i;
    else if (c === '<' && i > from + 1) return i - 1; // a missing > before the next tag
  }
  return source.length - 1;
}

/** A small tag-balance scanner that understands void and raw-text elements. */
export function scan(source: string): Scan {
  const events: TagEvent[] = [];
  const errors: ScanError[] = [];
  const styles: StyleBlock[] = [];
  const stack: { name: string; line: number }[] = [];
  const doctype: Scan['doctype'] = { found: false, first: false };
  let seenContent = false;
  let i = 0;

  const close = (name: string, index: number, line: number) => {
    events.push({ kind: 'close', name, index, line, ancestors: [] });
    if (VOID.has(name)) {
      errors.push({ kind: 'void-close', name, line });
      return;
    }
    const at = stack.map((s) => s.name).lastIndexOf(name);
    if (at === -1) {
      errors.push({ kind: 'stray', name, line });
      return;
    }
    while (stack.length > at + 1) {
      const open = stack.pop()!;
      errors.push({ kind: 'unclosed', name: open.name, line: open.line });
    }
    stack.pop();
  };

  while (i < source.length) {
    const lt = source.indexOf('<', i);
    if (lt === -1) {
      if (source.slice(i).trim()) seenContent = true;
      break;
    }
    if (source.slice(i, lt).trim()) seenContent = true;

    if (source.startsWith('<!--', lt)) {
      const end = source.indexOf('-->', lt + 4);
      i = end === -1 ? source.length : end + 3;
      continue;
    }
    if (source[lt + 1] === '!') {
      const end = tagEnd(source, lt);
      const text = source.slice(lt, end + 1);
      if (/^<!doctype\s+html\s*>$/i.test(text.trim()) && !doctype.found) {
        doctype.found = true;
        doctype.first = !seenContent;
        doctype.line = lineAt(source, lt);
      }
      seenContent = true;
      i = end + 1;
      continue;
    }
    const closing = /^<\/\s*([a-zA-Z][a-zA-Z0-9-]*)/.exec(source.slice(lt, lt + 40));
    if (closing) {
      seenContent = true;
      close(closing[1].toLowerCase(), lt, lineAt(source, lt));
      i = tagEnd(source, lt) + 1;
      continue;
    }
    const opening = /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(source.slice(lt, lt + 40));
    if (!opening) {
      i = lt + 1;
      continue;
    }
    seenContent = true;
    const name = opening[1].toLowerCase();
    const line = lineAt(source, lt);
    const end = tagEnd(source, lt);
    events.push({ kind: 'open', name, index: lt, line, ancestors: stack.map((s) => s.name) });
    i = end + 1;
    if (VOID.has(name)) continue;
    stack.push({ name, line });

    if (RAW_TEXT.has(name)) {
      const re = new RegExp(`</\\s*${name}\\b`, 'i');
      const m = re.exec(source.slice(i));
      if (!m) {
        stack.pop();
        errors.push({ kind: 'unclosed', name, line });
        if (name === 'style') styles.push({ content: source.slice(i), offset: i });
        i = source.length;
        break;
      }
      if (name === 'style') styles.push({ content: source.slice(i, i + m.index), offset: i });
      const closeAt = i + m.index;
      close(name, closeAt, lineAt(source, closeAt));
      i = tagEnd(source, closeAt) + 1;
    }
  }
  for (const open of stack.reverse()) errors.push({ kind: 'unclosed', name: open.name, line: open.line });
  return { source, events, errors, doctype, styles };
}

/* ------------------------------------------------------------------ checks */

export function checkDoctype(s: Scan): CheckResult {
  if (!s.doctype.found) {
    if (/<!doctype/i.test(s.source)) {
      return fail('Check the spelling of your doctype. It should be exactly <!DOCTYPE html>');
    }
    return fail('Start your page with <!DOCTYPE html> on the very first line.', { line: 1 });
  }
  if (!s.doctype.first) {
    return fail('The doctype must come first, before any other tags.', { line: s.doctype.line });
  }
  return pass();
}

export function checkBalanced(s: Scan, tags: string[]): CheckResult {
  for (const tag of tags) {
    const opens = s.events.filter((e) => e.kind === 'open' && e.name === tag);
    const closes = s.events.filter((e) => e.kind === 'close' && e.name === tag);
    if (opens.length === 0 && closes.length === 0) {
      return fail(`Your page needs <${tag}> and </${tag}>.`);
    }
    if (opens.length === 0) {
      return fail(`Add <${tag}> to match the </${tag}> on line ${closes[0].line}.`, { line: closes[0].line });
    }
  }
  for (const err of s.errors) {
    if (!tags.includes(err.name)) continue;
    if (err.kind === 'unclosed') {
      return fail(`<${err.name}> on line ${err.line} is never closed. Add </${err.name}>.`, { line: err.line });
    }
    if (err.kind === 'stray') {
      return fail(`</${err.name}> on line ${err.line} has no matching <${err.name}>.`, { line: err.line });
    }
  }
  // Closed, but in the wrong order: <head> ... <body> ... </head>
  for (const tag of tags) {
    const open = s.events.find((e) => e.kind === 'open' && e.name === tag);
    if (open && open.ancestors.some((a) => tags.includes(a) && a !== 'html' && a !== tag)) {
      const outer = open.ancestors.findLast((a) => tags.includes(a))!;
      return fail(`Close </${outer}> before you open <${tag}> on line ${open.line}.`, { line: open.line });
    }
  }
  return pass();
}

export function checkInside(s: Scan, tag: string, parent: string): CheckResult {
  const parents = parent.split('|').map((p) => p.trim().toLowerCase());
  const label = parents.map((p) => `<${p}>`).join(' or ');
  const opens = s.events.filter((e) => e.kind === 'open' && e.name === tag);
  if (opens.length === 0) {
    return fail(`Add a <${tag}> inside ${label}.`);
  }
  for (const open of opens) {
    if (tag === 'body' && open.ancestors.includes('head')) {
      return fail(`Close </head> before you open <body> on line ${open.line}.`, { line: open.line });
    }
    if (!open.ancestors.some((a) => parents.includes(a))) {
      if (tag === 'li') {
        return fail(`Every li needs to sit inside a ul or ol. Check line ${open.line}.`, { line: open.line });
      }
      if (parents.includes('head') && open.ancestors.includes('body')) {
        return fail(`<${tag}> on line ${open.line} belongs inside <head>, not <body>.`, { line: open.line });
      }
      return fail(`<${tag}> on line ${open.line} should sit inside ${label}.`, { line: open.line });
    }
  }
  return pass();
}

/* -------------------------------------------------------------------- CSS */

export interface CssDeclaration {
  property: string;
  value: string;
  line: number;
}

export interface CssRule {
  selector: string;
  line: number;
  declarations: CssDeclaration[];
}

export interface CssIssue {
  message: string;
  line: number;
  /** For spelling and typo issues: the property the student probably meant. */
  meant?: string;
  /** A syntax problem rather than a spelling one. */
  syntax?: boolean;
}

export interface CssParse {
  rules: CssRule[];
  issues: CssIssue[];
}

/** Parse the CSS in one <style> block. Line numbers are in the whole source. */
export function parseCss(block: StyleBlock, source: string): CssParse {
  // Blank out comments, keeping every index in place.
  const css = block.content.replace(/\/\*[\s\S]*?(\*\/|$)/g, (m) => m.replace(/[^\n]/g, ' '));
  const lineOf = (i: number) => lineAt(source, block.offset + i);
  const rules: CssRule[] = [];
  const issues: CssIssue[] = [];
  const syntax = (message: string, line: number) => issues.push({ message, line, syntax: true });

  let i = 0;
  let start = 0;
  let mode: 'selector' | 'block' = 'selector';
  let rule: CssRule | null = null;
  let declStart = 0;

  const declaration = (from: number, to: number) => {
    const raw = css.slice(from, to);
    const text = raw.trim();
    if (!text || !rule) return;
    const at = from + raw.search(/\S/);
    const line = lineOf(at);
    const colon = text.indexOf(':');
    if (colon === -1) {
      syntax(`Line ${line}: missing : between the property and its value in "${text}".`, line);
      return;
    }
    const property = text.slice(0, colon).trim().toLowerCase();
    const value = text.slice(colon + 1).trim();
    // "color: red background-color: blue" means a ; is missing.
    const next = /(^|\s)([a-z-]{3,})\s*:/i.exec(value.replace(/url\([^)]*\)/gi, ''));
    if (next && !/^https?$/i.test(next[2])) {
      const firstValue = value.slice(0, next.index).trim();
      const missingAt = from + raw.indexOf(firstValue) + firstValue.length;
      const l = lineOf(missingAt);
      syntax(`Line ${l}: missing ; after "${property}: ${firstValue}".`, l);
      rule.declarations.push({ property, value: firstValue, line });
      return;
    }
    if (!value) {
      syntax(`Line ${line}: ${property} needs a value, e.g. ${property}: …;`, line);
      return;
    }
    rule.declarations.push({ property, value, line });
  };

  while (i < css.length) {
    const c = css[i];
    if (mode === 'selector') {
      if (c === '{') {
        const selector = css.slice(start, i).trim();
        const line = lineOf(start + css.slice(start, i).search(/\S|$/));
        if (!selector) syntax(`Line ${line}: a rule needs a selector before {, e.g. h1 {`, line);
        rule = { selector, line, declarations: [] };
        rules.push(rule);
        mode = 'block';
        declStart = i + 1;
      } else if (c === '}' || c === ';') {
        const text = css.slice(start, i).trim();
        const line = lineOf(start + css.slice(start, i).search(/\S|$/));
        const selector = text.split(/\s+/)[0] || 'your selector';
        syntax(`Line ${line}: missing { after ${selector}.`, line);
        // Skip the rest of the broken rule.
        const close = c === '}' ? i : css.indexOf('}', i);
        i = close === -1 ? css.length : close + 1;
        start = i;
        continue;
      }
    } else if (c === '}') {
      declaration(declStart, i);
      mode = 'selector';
      rule = null;
      start = i + 1;
    } else if (c === '{') {
      syntax(`Line ${rule!.line}: missing } to close the ${rule!.selector} rule.`, rule!.line);
      return { rules, issues: checkProperties(rules, issues) };
    } else if (c === ';') {
      declaration(declStart, i);
      declStart = i + 1;
    }
    i++;
  }
  if (mode === 'block' && rule) {
    declaration(declStart, css.length);
    syntax(`Line ${rule.line}: missing } to close the ${rule.selector} rule.`, rule.line);
  } else if (css.slice(start).trim()) {
    const line = lineOf(start + css.slice(start).search(/\S/));
    const selector = css.slice(start).trim().split(/\s+/)[0];
    syntax(`Line ${line}: the ${selector} rule needs { and }.`, line);
  }
  return { rules, issues: checkProperties(rules, issues) };
}

function checkProperties(rules: CssRule[], issues: CssIssue[]): CssIssue[] {
  for (const rule of rules) {
    for (const d of rule.declarations) {
      const p = d.property;
      if (p.startsWith('-')) continue;
      if (BRITISH[p]) {
        issues.push({
          message: `Line ${d.line}: CSS uses American spelling: ${BRITISH[p]}, not ${p}.`,
          line: d.line,
          meant: BRITISH[p],
        });
      } else if (!KNOWN_PROPERTIES.has(p)) {
        const meant = closestProperty(p);
        issues.push({
          message: meant
            ? `Line ${d.line}: did you mean ${meant}? "${p}" isn't a CSS property.`
            : `Line ${d.line}: "${p}" isn't a CSS property.`,
          line: d.line,
          meant,
        });
      }
      if (/\bcentre\b/i.test(d.value)) {
        issues.push({
          message: `Line ${d.line}: CSS uses American spelling: center, not centre.`,
          line: d.line,
          meant: p,
        });
      }
    }
  }
  return issues.sort((a, b) => a.line - b.line);
}

export function parseAllCss(s: Scan): CssParse {
  const all: CssParse = { rules: [], issues: [] };
  for (const block of s.styles) {
    const r = parseCss(block, s.source);
    all.rules.push(...r.rules);
    all.issues.push(...r.issues);
  }
  return all;
}

export function checkCssSyntax(s: Scan, css: CssParse): CheckResult {
  if (s.styles.length === 0) return fail('Add a <style> element inside <head>, then write your CSS rules in it.');
  const first = css.issues[0];
  if (first) return fail(first.message, { line: first.line });
  if (css.rules.length === 0) return fail('Your <style> is empty. Add a rule like h1 { color: navy; }');
  return pass();
}

/* --------------------------------------------------------------- mistakes */

/** Mistakes worth pointing out whatever level the student is on. */
export function sourceMistakes(s: Scan): Mistake[] {
  const out: Mistake[] = [];
  for (const err of s.errors) {
    if (err.kind === 'void-close') {
      out.push({ message: `Line ${err.line}: </${err.name}> isn't needed. ${err.name} has no closing tag.`, line: err.line });
    }
  }
  const misplaced = s.events.find(
    (e) =>
      e.kind === 'open' &&
      ((VISIBLE.has(e.name) && e.ancestors.includes('head') && !e.ancestors.includes('body')) ||
        (e.name === 'head' && e.ancestors.includes('body'))),
  );
  if (misplaced) {
    out.push({
      message: `Line ${misplaced.line}: head holds information about the page. Put visible content in body.`,
      line: misplaced.line,
    });
  }
  return out;
}
