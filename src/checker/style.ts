/**
 * Computed style checks. In the browser the environment is the preview iframe
 * (styled) and a hidden twin of it with every author style removed (defaults).
 */
import type { CssParse } from './source';
import { fail, pass, type CheckResult } from './types';

export interface StyleEnv {
  /** Elements matching a selector in the styled preview. */
  elements(selector: string): Element[];
  /** The computed value of a property on an element of the styled preview. */
  computed(el: Element, property: string): string;
  /** The same element's computed value with no author CSS (browser default). */
  defaultValue(selector: string, index: number, property: string): string | undefined;
  /** True when a CSS rule or style attribute sets this property on this element. */
  declares(el: Element, property: string): boolean;
}

const EXAMPLES: Record<string, string> = {
  'background-color': 'lightyellow',
  color: 'navy',
  'font-family': 'Arial, sans-serif',
  'font-size': '18px',
  'text-align': 'center',
};

function example(tag: string, property: string, value = EXAMPLES[property] ?? '…'): string {
  return `${tag} { ${property}: ${value}; }`;
}

/** If the CSS has a typo or British spelling of this property, explain that first. */
function spellingHint(css: CssParse | undefined, property: string): string | undefined {
  return css?.issues.find((i) => i.meant === property)?.message;
}

const word = (property: string) =>
  ({
    'background-color': 'background colour',
    color: 'colour',
    'font-family': 'font',
    'font-size': 'font size',
    'text-align': 'alignment',
  })[property] ?? property;

export function checkStyle(
  env: StyleEnv | undefined,
  selector: string,
  property: string,
  opts: { notDefault?: boolean; equals?: string },
  css?: CssParse,
): CheckResult {
  if (!env) return { pass: false, pending: true, message: 'Checking your styles…' };
  const tag = selector.trim();
  const els = env.elements(selector);
  if (els.length === 0) return fail(`Add ${/^[aeiouh]/.test(tag) ? 'an' : 'a'} <${tag}> to your page first, then style it.`);

  for (const [index, el] of els.entries()) {
    const highlight = { selector, index };
    const value = env.computed(el, property);

    if (opts.equals !== undefined && value !== opts.equals) {
      return fail(
        spellingHint(css, property) ??
          `Set ${property}: ${opts.equals}; on your ${tag}, e.g. ${example(tag, property, opts.equals)}`,
        { highlight },
      );
    }
    if (opts.notDefault) {
      const declared = env.declares(el, property);
      const def = env.defaultValue(selector, index, property);
      if (!declared) {
        const hint = spellingHint(css, property);
        if (hint) return fail(hint, { highlight });
        if (tag === 'body' && property === 'background-color') {
          return fail(`Change the page background with a body rule, e.g. ${example('body', property)}`, { highlight });
        }
        const many = els.length > 1 ? ` all your ${tag} elements` : ` your ${tag}`;
        return fail(`Give${many} a ${word(property)} with a ${tag} rule, e.g. ${example(tag, property)}`, {
          highlight,
        });
      }
      if (def !== undefined && value === def) {
        return fail(`Your ${tag} ${word(property)} is the same as the browser's default. Pick a different value.`, {
          highlight,
        });
      }
    }
  }
  return pass();
}

/** Build a StyleEnv from two loaded documents: the styled preview and its unstyled twin. */
export function documentStyleEnv(styled: Document, unstyled: Document): StyleEnv {
  const win = styled.defaultView!;
  const defWin = unstyled.defaultView!;
  const rules = (): CSSStyleRule[] => {
    const out: CSSStyleRule[] = [];
    for (const sheet of Array.from(styled.styleSheets)) {
      let list: CSSRuleList;
      try {
        list = sheet.cssRules;
      } catch {
        continue;
      }
      for (const r of Array.from(list)) if ('selectorText' in r) out.push(r as CSSStyleRule);
    }
    return out;
  };
  return {
    elements: (selector) => Array.from(styled.querySelectorAll(selector)),
    computed: (el, property) => win.getComputedStyle(el).getPropertyValue(property).trim(),
    defaultValue: (selector, index, property) => {
      const el = unstyled.querySelectorAll(selector)[index];
      return el ? defWin.getComputedStyle(el).getPropertyValue(property).trim() : undefined;
    },
    declares: (el, property) => {
      if ((el as HTMLElement).style?.getPropertyValue(property)) return true;
      return rules().some((r) => {
        try {
          return r.style.getPropertyValue(property) !== '' && el.matches(r.selectorText);
        } catch {
          return false;
        }
      });
    },
  };
}
