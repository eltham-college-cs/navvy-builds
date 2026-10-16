import { describe, expect, it } from 'vitest';
import { checkAttr, checkCount, checkExists, checkHeadingOrder, checkText, parsePage } from './dom';
import { COMPLETE } from './fixtures/complete';

const body = (html: string, title = 'My football page') =>
  parsePage(`<!DOCTYPE html><html><head><title>${title}</title></head><body>${html}</body></html>`);
const full = parsePage(COMPLETE);

describe('exists', () => {
  it('passes when the element is there', () => {
    expect(checkExists(full, 'a[href]').pass).toBe(true);
  });
  it('asks for an href when the link has none', () => {
    expect(checkExists(body('<a>FA</a>'), 'a[href]').message).toMatch(/needs an href/);
  });
  it('asks for a link when there is none', () => {
    expect(checkExists(body(''), 'a[href]').message).toMatch(/Add a link/);
  });
});

describe('count', () => {
  it('passes within limits', () => {
    expect(checkCount(full, 'body h1', 1, 1).pass).toBe(true);
    expect(checkCount(full, 'body h2', 2).pass).toBe(true);
    expect(checkCount(full, 'ul > li', 3).pass).toBe(true);
  });
  it('mistake: more than one h1', () => {
    const r = checkCount(body('<h1>Football</h1><h1>More football</h1>'), 'body h1', 1, 1);
    expect(r.message).toMatch(/A page has one h1, like a book has one title/);
    expect(r.highlight).toEqual({ selector: 'h1', index: 1 });
  });
  it('mistake: title but no h1', () => {
    expect(checkCount(body('<p>hi</p>'), 'body h1', 1, 1).message).toMatch(
      /The title shows on the tab. The h1 shows on the page/,
    );
  });
  it('counts too few headings', () => {
    expect(checkCount(body('<h1>a</h1><h2>b</h2>'), 'body h2', 2).message).toBe('You have 1 h2 heading. Add at least 2.');
  });
  it('spots a deeper heading standing in for a missing level', () => {
    expect(checkCount(body('<h1>a</h1><h2>b</h2><h4>c</h4>'), 'body h3', 1).message).toBe(
      'You have an h4 but no h3. Go down one level at a time: change your h4 to an h3.',
    );
    expect(checkCount(body('<h1>a</h1>'), 'body h3', 1).message).toBe('You have no h3 headings. Add at least 1.');
  });
  it('counts list items', () => {
    expect(checkCount(body('<ul><li>a</li><li>b</li></ul>'), 'ul > li', 3).message).toMatch(/Your ul has 2 items/);
    expect(checkCount(body(''), 'ol > li', 3).message).toMatch(/Add an <ol> with 3 <li> items/);
  });
  it('counts paragraphs', () => {
    expect(checkCount(body('<p>one</p>'), 'body p', 2).message).toBe('You have 1 paragraph. Write at least 2.');
  });
});

describe('text', () => {
  it('passes when the h1 and title mention the hobby', () => {
    expect(checkText(full, 'h1', { containsHobby: true }, 'football').pass).toBe(true);
    expect(checkText(full, 'title', { containsHobby: true }, 'football').pass).toBe(true);
  });
  it('is case-insensitive and allows other word forms', () => {
    expect(checkText(body('<h1>FOOTBALL fan</h1>'), 'h1', { containsHobby: true }, 'football').pass).toBe(true);
    expect(checkText(body('<h1>I love to swim</h1>'), 'h1', { containsHobby: true }, 'swimming').pass).toBe(true);
  });
  it('fails when the hobby is not mentioned', () => {
    const r = checkText(body('<h1>My page</h1>'), 'h1', { containsHobby: true }, 'football');
    expect(r.message).toMatch(/Make it mention football/);
  });
  it('accepts any text for "other"', () => {
    expect(checkText(body('<h1>Knitting</h1>'), 'h1', { containsHobby: true }, 'other').pass).toBe(true);
    expect(checkText(body('<h1> </h1>'), 'h1', { containsHobby: true }, 'other').pass).toBe(false);
  });
  it('mistake: h1 but no title', () => {
    const doc = parsePage('<!DOCTYPE html><html><head></head><body><h1>Football</h1></body></html>');
    expect(checkText(doc, 'title', { containsHobby: true }, 'football').message).toMatch(
      /The title shows on the tab. The h1 shows on the page/,
    );
  });
  it('counts words in every paragraph', () => {
    const r = checkText(body('<p>one two three four five six seven eight</p><p>too short</p>'), 'p', { minWords: 8 }, 'x');
    expect(r.message).toBe('Paragraph 2 has 2 words. Write at least 8.');
    expect(r.highlight).toEqual({ selector: 'p', index: 1 });
  });
  it('reads attributes with selector@attr', () => {
    expect(checkText(full, 'img@alt', { minWords: 3 }, 'football').pass).toBe(true);
    expect(checkText(body('<img src="a.png" alt="ball">'), 'img@alt', { minWords: 3 }, 'x').message).toMatch(
      /Describe the picture/,
    );
  });
  it('fails empty link text', () => {
    expect(checkText(body('<a href="https://a.com"></a>'), 'a', { notEmpty: true }, 'x').message).toMatch(/no text/);
  });
});

describe('attr', () => {
  it('passes a good link and image', () => {
    expect(checkAttr(full, 'a', 'href', { startsWith: 'https://' }).pass).toBe(true);
    expect(checkAttr(full, 'img', 'alt', { notEmpty: true, notOneOf: ['image'] }).pass).toBe(true);
  });
  it('mistake: href without https://', () => {
    expect(checkAttr(body('<a href="www.thefa.com">FA</a>'), 'a', 'href', { startsWith: 'https://' }).message).toMatch(
      /Web addresses need https:\/\/ at the start/,
    );
    expect(checkAttr(body('<a href="http://thefa.com">FA</a>'), 'a', 'href', { startsWith: 'https://' }).message).toMatch(
      /with an s/,
    );
  });
  it('mistake: link text "click here" or "here"', () => {
    for (const text of ['click here', 'Here', 'Click here!']) {
      const r = checkAttr(body(`<a href="https://a.com">${text}</a>`), 'a', 'textContent', {
        notOneOf: ['click here', 'here', 'link', 'click'],
      });
      expect(r.message).toMatch(/Say where the link goes/);
    }
  });
  const alt = (html: string) =>
    checkAttr(body(html), 'img', 'alt', { notEmpty: true, notOneOf: ['image', 'picture', 'photo', 'img'] });
  it('mistake: alt missing', () => {
    expect(alt('<img src="a.png">').message).toMatch(/Add alt=/);
  });
  it('mistake: alt empty', () => {
    expect(alt('<img src="a.png" alt="">').message).toMatch(/Describe the picture for someone who can't see it/);
  });
  it('mistake: alt is "image"', () => {
    expect(alt('<img src="a.png" alt="Image">').message).toMatch(/Describe the picture/);
  });
  it('mistake: alt is the file name', () => {
    expect(alt('<img src="images/football-1.png" alt="football-1.png">').message).toMatch(/Describe the picture/);
  });
  it('fails an empty src', () => {
    expect(checkAttr(body('<img src="" alt="x">'), 'img', 'src', { notEmpty: true }).message).toMatch(/src is empty/);
  });
});

describe('headingOrder', () => {
  it('passes headings that go down one level at a time', () => {
    expect(checkHeadingOrder(full).pass).toBe(true);
    expect(checkHeadingOrder(body('<h1>a</h1><h2>b</h2><h3>c</h3><h2>d</h2>')).pass).toBe(true);
  });
  it('mistake: heading skips (h2 to h4)', () => {
    const r = checkHeadingOrder(body('<h1>a</h1><h2>b</h2><h4>c</h4>'));
    expect(r.message).toBe('Your h4 comes straight after an h2. Go down one level at a time.');
    expect(r.highlight).toEqual({ selector: 'h4', index: 0 });
  });
  it('wants the first heading to be h1', () => {
    expect(checkHeadingOrder(body('<h2>b</h2>')).message).toMatch(/Start with h1/);
  });
});
