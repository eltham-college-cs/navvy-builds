import { describe, expect, it } from 'vitest';
import { COMPLETE } from './fixtures/complete';
import { fakeStyleEnv } from './fixtures/fake-style-env';
import { parseAllCss, scan } from './source';
import { checkStyle } from './style';

const page = (css: string, body = '<h1>Football</h1><p>Some words</p><ul><li>a</li></ul>') =>
  `<!DOCTYPE html><html><head><title>Football</title><style>${css}</style></head><body>${body}</body></html>`;
const run = (html: string, selector: string, property: string, opts: { notDefault?: boolean; equals?: string }) =>
  checkStyle(fakeStyleEnv(html), selector, property, opts, parseAllCss(scan(html)));

describe('style', () => {
  it('passes every style goal on the complete page', () => {
    for (const [sel, prop] of [
      ['body', 'background-color'],
      ['h1', 'color'],
      ['p', 'font-family'],
      ['p', 'font-size'],
      ['li', 'color'],
      ['a', 'color'],
    ]) {
      expect(run(COMPLETE, sel, prop, { notDefault: true }).pass).toBe(true);
    }
    expect(run(COMPLETE, 'h1', 'text-align', { equals: 'center' }).pass).toBe(true);
  });
  it('is pending until the preview is ready', () => {
    expect(checkStyle(undefined, 'h1', 'color', { notDefault: true }).pending).toBe(true);
  });
  it('fails when the property is not set', () => {
    expect(run(page(''), 'body', 'background-color', { notDefault: true }).message).toMatch(/body \{ background-color/);
    expect(run(page(''), 'h1', 'color', { notDefault: true }).message).toMatch(/h1 \{ color: navy; \}/);
  });
  it('fails a value that matches the browser default', () => {
    expect(run(page('h1 { color: black; }'), 'h1', 'color', { notDefault: true }).message).toMatch(/same as the browser's default/);
  });
  it('does not count a colour inherited from body as styling li', () => {
    expect(run(page('body { color: red; }'), 'li', 'color', { notDefault: true }).pass).toBe(false);
  });
  it('accepts a selector list and shorthand', () => {
    expect(run(page('h1, h2 { color: red; }'), 'h1', 'color', { notDefault: true }).pass).toBe(true);
    expect(run(page('body { background: pink; }'), 'body', 'background-color', { notDefault: true }).pass).toBe(true);
  });
  it('checks an exact value', () => {
    expect(run(page('h1 { text-align: left; }'), 'h1', 'text-align', { equals: 'center' }).message).toMatch(
      /text-align: center/,
    );
  });
  it('mistake: centre explains the American spelling', () => {
    expect(run(page('h1 { text-align: centre; }'), 'h1', 'text-align', { equals: 'center' }).message).toMatch(
      /center, not centre/,
    );
  });
  it('mistake: colour explains the American spelling', () => {
    expect(run(page('h1 { colour: red; }'), 'h1', 'color', { notDefault: true }).message).toMatch(
      /CSS uses American spelling: color, not colour/,
    );
  });
  it('mistake: background-colour explains the American spelling', () => {
    expect(run(page('body { background-colour: red; }'), 'body', 'background-color', { notDefault: true }).message).toMatch(
      /background-color, not background-colour/,
    );
  });
  it('mistake: a typo suggests the right property', () => {
    expect(run(page('p { font-szie: 20px; }'), 'p', 'font-size', { notDefault: true }).message).toMatch(
      /did you mean font-size\?/,
    );
  });
  it('asks for the element when it is missing', () => {
    expect(run(page('a { color: red; }', ''), 'a', 'color', { notDefault: true }).message).toMatch(/Add an <a>/);
  });
});
