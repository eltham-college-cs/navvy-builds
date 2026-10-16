/** Structure, text and attribute checks on the parsed page (DOMParser output). */
import { hobbyLabel, mentionsHobby, wordCount } from './hobby';
import { fail, pass, type CheckResult } from './types';

export function parsePage(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

/** "body h1" -> "h1", "ul > li" -> "li", "a[href]" -> "a" */
function lastTag(selector: string): string {
  const last = selector.split(',')[0].trim().split(/[\s>+~]+/).pop() ?? selector;
  return (/^[a-z][a-z0-9]*/i.exec(last)?.[0] ?? last).toLowerCase();
}

const plural = (n: number, one: string, many = `${one}s`) => `${n === 0 ? 'no' : n} ${n === 1 ? one : many}`;

const article = (tag: string) => (/^[aeiouh]/i.test(tag) && tag !== 'ul' ? 'an' : 'a');

function needMore(selector: string, n: number, min: number, doc: Document): string {
  const tag = lastTag(selector);
  if (selector === 'body h1' && n === 0 && doc.title.trim()) {
    return 'The title shows on the tab. The h1 shows on the page. Add an h1 inside body.';
  }
  if (/^(ul|ol) > li$/.test(selector)) {
    const list = selector.slice(0, 2);
    if (!doc.querySelector(list)) {
      return `Add ${article(list)} <${list}> with ${min} <li> items inside it.`;
    }
    return `Your ${list} has ${plural(n, 'item')}. Add at least ${min}, each in its own <li>.`;
  }
  if (/^(body )?h[1-6]$/.test(selector)) {
    const level = Number(tag[1]);
    const deeper = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6')).find((h) => Number(h.tagName[1]) > level);
    if (n === 0 && deeper) {
      const name = deeper.tagName.toLowerCase();
      return `You have an ${name} but no ${tag}. Go down one level at a time: change your ${name} to an ${tag}.`;
    }
    return `You have ${plural(n, `${tag} heading`)}. Add at least ${min}.`;
  }
  if (selector === 'h4, h5, h6') return 'Add an h4 under one of your h3s.';
  if (tag === 'p') return `You have ${plural(n, 'paragraph')}. Write at least ${min}.`;
  return `Add ${min === 1 ? `${article(tag)} <${tag}>` : `at least ${min} <${tag}> elements`}.`;
}

export function checkExists(doc: Document, selector: string): CheckResult {
  if (doc.querySelector(selector)) return pass();
  if (selector === 'a[href]') {
    return doc.querySelector('a')
      ? fail('Your link needs an href: <a href="https://…">', { highlight: { selector: 'a' } })
      : fail('Add a link: <a href="https://…">where it goes</a>');
  }
  const tag = lastTag(selector);
  return fail(`Add ${article(tag)} <${tag}> to your page.`);
}

export function checkCount(doc: Document, selector: string, min?: number, max?: number): CheckResult {
  const n = doc.querySelectorAll(selector).length;
  if (max !== undefined && n > max) {
    const tag = lastTag(selector);
    if (tag === 'h1') {
      return fail(`A page has one h1, like a book has one title. You have ${n}.`, {
        highlight: { selector: 'h1', index: 1 },
      });
    }
    return fail(`You have ${n} <${tag}> elements. Use no more than ${max}.`);
  }
  if (min !== undefined && n < min) return fail(needMore(selector, n, min, doc));
  return pass();
}

interface TextOptions {
  notEmpty?: boolean;
  containsHobby?: boolean;
  minWords?: number;
}

export function checkText(doc: Document, selector: string, opts: TextOptions, hobby: string): CheckResult {
  const [sel, attr] = selector.split('@');
  const els = Array.from(doc.querySelectorAll(sel));
  const tag = lastTag(sel);
  const read = (el: Element) => (attr ? (el.getAttribute(attr) ?? '') : (el.textContent ?? '')).trim();

  if (els.length === 0) {
    if (tag === 'title') {
      return doc.querySelector('h1')
        ? fail('The title shows on the tab. The h1 shows on the page. Add a <title> inside <head> as well.')
        : fail('Add a <title> inside <head>. It shows on the browser tab.');
    }
    if (tag === 'h1' && doc.title.trim()) {
      return fail('The title shows on the tab. The h1 shows on the page. Add an h1 inside body.');
    }
    return fail(`Add ${article(tag)} <${tag}> to your page.`);
  }

  for (const [index, el] of els.entries()) {
    const text = read(el);
    const highlight = tag === 'title' ? undefined : { selector: sel, index };
    if (attr && el.getAttribute(attr) === null) {
      return fail(
        attr === 'alt' ? 'Add alt="…" to your img to describe the picture.' : `Add ${attr}="…" to your <${tag}>.`,
        { highlight },
      );
    }
    if ((opts.notEmpty || opts.containsHobby || opts.minWords) && !text) {
      if (tag === 'a') return fail('Your link has no text. Put words between <a …> and </a>.', { highlight });
      if (attr === 'alt') return fail("Describe the picture for someone who can't see it.", { highlight });
      return fail(`Your ${tag} is empty. Put some text between <${tag}> and </${tag}>.`, { highlight });
    }
    if (opts.containsHobby && !mentionsHobby(text, hobby)) {
      const h = hobbyLabel(hobby);
      if (tag === 'title') return fail(`Your title says "${text}". Make it mention ${h}.`);
      return fail(`Your ${tag} says "${text}". Make it mention ${h}, e.g. <${tag}>My love of ${h}</${tag}>`, {
        highlight,
      });
    }
    if (opts.minWords) {
      const words = wordCount(text);
      if (words < opts.minWords) {
        if (attr === 'alt') {
          return fail(
            `Your alt text has ${plural(words, 'word')}. Describe the picture for someone who can't see it, in at least ${opts.minWords} words.`,
            { highlight },
          );
        }
        const which = els.length > 1 ? `${tag === 'p' ? 'Paragraph' : tag} ${index + 1}` : `Your ${tag === 'p' ? 'paragraph' : tag}`;
        return fail(`${which} has ${plural(words, 'word')}. Write at least ${opts.minWords}.`, { highlight });
      }
    }
  }
  return pass();
}

interface AttrOptions {
  notEmpty?: boolean;
  startsWith?: string;
  notOneOf?: string[];
}

const looksLikeFileName = (v: string) => /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(v.trim());
const normal = (v: string) => v.trim().toLowerCase().replace(/[.!?'"]+$/g, '').replace(/\s+/g, ' ');

export function checkAttr(doc: Document, selector: string, attr: string, opts: AttrOptions): CheckResult {
  const els = Array.from(doc.querySelectorAll(selector));
  const tag = lastTag(selector);
  if (els.length === 0) return fail(`Add ${article(tag)} <${tag}> to your page.`);

  for (const [index, el] of els.entries()) {
    const highlight = { selector, index };
    const value = attr === 'textContent' ? (el.textContent ?? '').trim() : el.getAttribute(attr);
    if (value === null) {
      if (attr === 'href') return fail('Add href="https://…" to your link so it goes somewhere.', { highlight });
      if (attr === 'alt') return fail('Add alt="…" to your img to describe the picture.', { highlight });
      if (attr === 'src') return fail('Add src="…" with the path to your picture, e.g. images/…', { highlight });
      return fail(`Add ${attr}="…" to your <${tag}>.`, { highlight });
    }
    const v = value.trim();
    if (opts.notEmpty && !v) {
      if (attr === 'alt') return fail("Describe the picture for someone who can't see it.", { highlight });
      if (attr === 'src') return fail('src is empty. Copy a path from the image library and paste it between the quotes.', { highlight });
      if (attr === 'href') return fail('href is empty. Put the web address between the quotes.', { highlight });
      return fail(`${attr} is empty on your <${tag}>.`, { highlight });
    }
    if (opts.startsWith && !v.toLowerCase().startsWith(opts.startsWith.toLowerCase())) {
      if (attr === 'href' && opts.startsWith === 'https://') {
        return v.toLowerCase().startsWith('http://')
          ? fail('Use https:// (with an s) at the start of the web address.', { highlight })
          : fail(`Web addresses need https:// at the start. Yours is "${v}".`, { highlight });
      }
      return fail(`${attr} on your <${tag}> should start with ${opts.startsWith}`, { highlight });
    }
    const banned = (opts.notOneOf ?? []).map(normal);
    const bad = banned.includes(normal(v)) || (attr === 'alt' && looksLikeFileName(v));
    if (bad) {
      if (tag === 'a') return fail("Say where the link goes, e.g. 'Visit the FA website'.", { highlight });
      if (attr === 'alt') return fail("Describe the picture for someone who can't see it.", { highlight });
      return fail(`"${v}" isn't a good ${attr}. Try something more descriptive.`, { highlight });
    }
  }
  return pass();
}

export function checkHeadingOrder(doc: Document): CheckResult {
  const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  let prev = 0;
  const seen: Record<string, number> = {};
  for (const h of headings) {
    const name = h.tagName.toLowerCase();
    const level = Number(name[1]);
    const index = seen[name] ?? 0;
    seen[name] = index + 1;
    if (level > prev + 1) {
      const highlight = { selector: name, index };
      if (prev === 0) return fail(`Your first heading is an ${name}. Start with h1.`, { highlight });
      return fail(`Your ${name} comes straight after an h${prev}. Go down one level at a time.`, { highlight });
    }
    prev = level;
  }
  return pass();
}
