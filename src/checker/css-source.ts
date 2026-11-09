/**
 * Checks on style.css and style="" attributes as written (SPEC-SIXTH-FORM § 9.1).
 * The computed-style checks in style.ts decide whether the CSS works; these
 * decide whether it's written the way the A Level spec means.
 */
import { cssLink, linkTags } from './files';
import { parseCss, type CssParse, type CssRule } from './source';
import { fail, pass, type CheckResult, type Mistake } from './types';

export function parseStyleCss(css: string | undefined): CssParse {
  if (css === undefined) return { rules: [], issues: [] };
  return parseCss({ content: css, offset: 0 }, css);
}

const squash = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/** The selectors in a rule's selector list. */
const selectorsOf = (rule: CssRule) => rule.selector.split(',').map(squash);

export function rulesFor(css: CssParse, selector: string): CssRule[] {
  const want = squash(selector);
  return css.rules.filter((r) => selectorsOf(r).includes(want));
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function checkCssFileSyntax(cssText: string | undefined, css: CssParse): CheckResult {
  if (cssText === undefined) return fail('Create style.css first.');
  const first = css.issues[0];
  if (first) return fail(`style.css ${first.message.charAt(0).toLowerCase()}${first.message.slice(1)}`, { line: first.line });
  if (css.rules.length === 0) return fail('style.css is empty. Add a rule like h1 { color: navy; }');
  return pass();
}

export function checkCssRule(css: CssParse, selector: string, property?: string, hex?: boolean): CheckResult {
  const rules = rulesFor(css, selector);
  if (rules.length === 0) return fail(`Add a ${selector} rule to style.css, e.g. ${selector} { … }`);
  if (!property) return pass();
  const decls = rules.flatMap((r) => r.declarations).filter((d) => d.property === property);
  if (decls.length === 0) return fail(`Your ${selector} rule needs ${property}, e.g. ${selector} { ${property}: …; }`, { line: rules[0].line });
  if (hex && !decls.some((d) => HEX.test(d.value.trim()))) {
    return fail(`Use a hex colour for ${property} in ${selector}, e.g. ${property}: #A2441B;`, { line: decls[0].line });
  }
  return pass();
}

const KIND_HELP = {
  element: 'Style an element by its tag name, e.g. h1 { color: blue; }',
  class: 'Write a class rule: a dot, then the class name, e.g. .infoBox { … }',
  id: 'Write an identifier rule: a #, then the id, e.g. #menu { … }',
};

export function checkCssKind(css: CssParse, kind: 'element' | 'class' | 'id'): CheckResult {
  const test = { element: /^[a-z][a-z0-9]*$/, class: /^\.[\w-]+$/, id: /^#[\w-]+$/ }[kind];
  const found = css.rules.some((r) => selectorsOf(r).some((s) => test.test(s)));
  return found ? pass() : fail(KIND_HELP[kind]);
}

/** style="" attributes as { property: value } for one element. */
export function inlineDeclarations(el: Element): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of (el.getAttribute('style') ?? '').split(';')) {
    const i = part.indexOf(':');
    if (i > 0) out.set(part.slice(0, i).trim().toLowerCase(), part.slice(i + 1).trim());
  }
  return out;
}

export function checkInlineStyle(doc: Document, selector = '[style]', property?: string): CheckResult {
  let els: Element[];
  try {
    els = Array.from(doc.querySelectorAll(selector));
  } catch {
    return fail(`"${selector}" isn't a valid selector.`);
  }
  const styled = els.filter((el) => el.hasAttribute('style'));
  const where = selector === '[style]' ? 'an element' : `your ${selector}`;
  if (styled.length === 0) return fail(`Give ${where} a style attribute, e.g. <h1 style="color:blue;">`);
  if (property && !styled.some((el) => inlineDeclarations(el).get(property))) {
    return fail(`Set ${property} inside the style attribute, e.g. style="${property}: …;"`);
  }
  return pass();
}

/* -------------------------------------------------------------- mistakes */

/** Mistakes in style.css and how index.html uses it. */
export function cssMistakes(html: string, cssText: string | undefined, css: CssParse, doc: Document): Mistake[] {
  const out: Mistake[] = [];
  const at = (line: number, message: string) => out.push({ message: `style.css line ${line}: ${message}`, line });

  // The link: wrong file name or missing rel.
  if (cssText !== undefined && !cssLink(html)) {
    const near = linkTags(html).find((l) => /\.css$/i.test(l.href) || /stylesheet/.test(l.rel));
    if (near && near.href.toLowerCase() !== 'style.css') {
      out.push({ message: `index.html line ${near.line}: your page links to ${near.href || 'nothing'}, but your file is called style.css.`, line: near.line });
    } else if (near) {
      out.push({ message: `index.html line ${near.line}: the link needs rel="stylesheet" so the browser knows it's CSS.`, line: near.line });
    }
  }

  const ids = new Set(Array.from(doc.querySelectorAll('[id]'), (el) => el.id));
  const classes = new Set(Array.from(doc.querySelectorAll('[class]')).flatMap((el) => Array.from(el.classList)));
  for (const rule of css.rules) {
    for (const s of selectorsOf(rule)) {
      const cls = /^\.([\w-]+)$/.exec(s);
      const id = /^#([\w-]+)$/.exec(s);
      if (cls && !classes.has(cls[1]) && ids.has(cls[1])) {
        at(rule.line, `# selects an id, . selects a class. Your element has id="${cls[1]}", so use #${cls[1]}.`);
      }
      if (id && !ids.has(id[1]) && classes.has(id[1])) {
        at(rule.line, `. selects a class, # selects an id. Your element has class="${id[1]}", so use .${id[1]}.`);
      }
    }
    const props = new Map(rule.declarations.map((d) => [d.property, d]));
    const width = props.get('border-width') ?? props.get('border-color');
    if (width && !props.has('border-style') && !props.has('border')) {
      at(width.line, 'a border needs border-style (e.g. solid) to show at all.');
    }
    for (const d of rule.declarations) {
      if (/color$/.test(d.property)) {
        const v = d.value.trim();
        if (/^#/.test(v) && !HEX.test(v)) at(d.line, `hex colours have 3 or 6 digits after the #, e.g. #A2441B. "${v}" doesn't.`);
        else if (/^([0-9a-f]{6}|[0-9a-f]{3})$/i.test(v) && /\d/.test(v)) at(d.line, `hex colours start with #, e.g. #${v}.`);
      }
    }
  }

  // An id used twice.
  const seen = new Map<string, number>();
  for (const el of Array.from(doc.querySelectorAll('[id]'))) seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
  for (const [id, n] of seen) {
    if (n > 1) out.push({ message: `index.html: id="${id}" is used ${n} times. An id must be unique; use a class for repeats.` });
  }

  // CSS typed straight into index.html.
  const body = html.replace(/<style\b[\s\S]*?<\/style>/gi, '').replace(/<script\b[\s\S]*?<\/script>/gi, '');
  const stray = /(^|>)\s*([#.]?[a-z][\w-]*)\s*\{[^}]*:[^}]*\}/im.exec(body);
  if (stray) out.push({ message: `index.html: "${stray[2]} { … }" is CSS. Put it in style.css.` });
  return out;
}
