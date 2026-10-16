import { describe, expect, it } from 'vitest';
import { COMPLETE } from './fixtures/complete';
import {
  checkBalanced,
  checkCssSyntax,
  checkDoctype,
  checkInside,
  parseAllCss,
  scan,
  sourceMistakes,
} from './source';

const page = (head: string, body: string) =>
  `<!DOCTYPE html>\n<html>\n<head>\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
const styled = (css: string) => page(`<title>Football</title>\n<style>\n${css}\n</style>`, '<h1>Football</h1>');
const cssIssues = (css: string) => parseAllCss(scan(styled(css))).issues;

describe('source-doctype', () => {
  it('passes a correct page, even after a comment', () => {
    expect(checkDoctype(scan(COMPLETE)).pass).toBe(true);
  });
  it('is case-insensitive', () => {
    expect(checkDoctype(scan('<!doctype html><html></html>')).pass).toBe(true);
  });
  it('fails when missing', () => {
    const r = checkDoctype(scan('<html><head></head><body></body></html>'));
    expect(r.pass).toBe(false);
    expect(r.message).toMatch(/<!DOCTYPE html>/);
  });
  it('fails when it is not first', () => {
    const r = checkDoctype(scan('<html>\n<!DOCTYPE html>\n</html>'));
    expect(r.pass).toBe(false);
    expect(r.message).toMatch(/must come first/);
    expect(r.line).toBe(2);
  });
  it('spots a misspelt doctype', () => {
    expect(checkDoctype(scan('<!DOCTYPE htm>')).message).toMatch(/spelling/);
  });
});

describe('source-balanced', () => {
  const tags = ['html', 'head', 'body'];
  it('passes a correct skeleton', () => {
    expect(checkBalanced(scan(COMPLETE), tags).pass).toBe(true);
  });
  it('reports a missing tag', () => {
    expect(checkBalanced(scan('<!DOCTYPE html><html><body></body></html>'), tags).message).toMatch(/needs <head>/);
  });
  it('reports an unclosed tag with its line', () => {
    const r = checkBalanced(scan('<!DOCTYPE html>\n<html>\n<head>\n<body>\n</body>\n</html>'), tags);
    expect(r.pass).toBe(false);
    expect(r.message).toMatch(/<head> on line 3 is never closed/);
  });
  it('reports a stray closing tag', () => {
    const r = checkBalanced(scan('<html>\n<head></head>\n</body>\n</html>'), ['body']);
    expect(r.message).toMatch(/Add <body>/);
  });
  it('reports a closing tag without an opening one', () => {
    const r = checkBalanced(scan('<html><head></head><body></body></head></html>'), tags);
    expect(r.message).toMatch(/<\/head> on line 1 has no matching <head>/);
  });
  it('reports body opened inside head', () => {
    const r = checkBalanced(scan('<html>\n<head>\n<body>\n</body>\n</head>\n</html>'), tags);
    expect(r.message).toMatch(/Close <\/head> before you open <body>/);
  });
  it('understands void elements', () => {
    const r = checkBalanced(scan('<html><head><meta charset="utf-8"></head><body><img src="a.png"><br></body></html>'), tags);
    expect(r.pass).toBe(true);
  });
  it('does not treat tags inside <title> as tags', () => {
    expect(checkBalanced(scan('<html><head><title>a <body> b</title></head><body></body></html>'), tags).pass).toBe(true);
  });
  it('reports an unclosed title that swallows the page', () => {
    const r = checkBalanced(scan('<html>\n<head>\n<title>Hi\n</head>\n<body></body></html>'), ['title']);
    expect(r.message).toMatch(/<title> on line 3 is never closed/);
  });
});

describe('source-inside', () => {
  it('passes title and style inside head', () => {
    const s = scan(COMPLETE);
    expect(checkInside(s, 'title', 'head').pass).toBe(true);
    expect(checkInside(s, 'style', 'head').pass).toBe(true);
  });
  it('fails title placed in body', () => {
    const r = checkInside(scan(page('', '<title>Football</title>')), 'title', 'head');
    expect(r.message).toMatch(/belongs inside <head>, not <body>/);
  });
  it('fails when the tag is missing', () => {
    expect(checkInside(scan(page('', '')), 'style', 'head').message).toMatch(/Add a <style> inside <head>/);
  });
  it('accepts alternative parents', () => {
    expect(checkInside(scan(page('', '<ol><li>x</li></ol>')), 'li', 'ul|ol').pass).toBe(true);
  });
  it('mistake: li outside a list', () => {
    const r = checkInside(scan(page('', '<ul><li>a</li></ul>\n<li>b</li>')), 'li', 'ul|ol');
    expect(r.pass).toBe(false);
    expect(r.message).toMatch(/Every li needs to sit inside a ul or ol/);
    expect(r.line).toBe(8);
  });
});

describe('css-syntax', () => {
  it('passes good CSS', () => {
    const s = scan(COMPLETE);
    expect(checkCssSyntax(s, parseAllCss(s)).pass).toBe(true);
  });
  it('allows the last ; in a rule to be left out', () => {
    expect(cssIssues('h1 { color: red }')).toEqual([]);
  });
  it('fails with no <style>', () => {
    const s = scan(page('<title>x</title>', ''));
    expect(checkCssSyntax(s, parseAllCss(s)).message).toMatch(/Add a <style>/);
  });
  it('fails with an empty <style>', () => {
    const s = scan(styled(''));
    expect(checkCssSyntax(s, parseAllCss(s)).message).toMatch(/empty/);
  });
  it('mistake: missing ; between declarations points to the line', () => {
    const issues = cssIssues('h1 {\n  color: red\n  text-align: center;\n}');
    expect(issues[0].message).toBe('Line 7: missing ; after "color: red".');
    expect(issues[0].line).toBe(7);
  });
  it('spots a missing {', () => {
    expect(cssIssues('h1 color: red; }')[0].message).toMatch(/missing \{ after h1/);
  });
  it('spots a missing }', () => {
    expect(cssIssues('h1 { color: red;\np { color: blue; }')[0].message).toMatch(/missing } to close the h1 rule/);
    expect(cssIssues('h1 { color: red;')[0].message).toMatch(/missing } to close the h1 rule/);
  });
  it('spots a missing :', () => {
    expect(cssIssues('h1 { color red; }')[0].message).toMatch(/missing : between the property and its value/);
  });
  it('mistake: colour', () => {
    const [issue] = cssIssues('h1 { colour: red; }');
    expect(issue.message).toMatch(/CSS uses American spelling: color, not colour/);
    expect(issue.meant).toBe('color');
  });
  it('mistake: background-colour', () => {
    expect(cssIssues('body { background-colour: pink; }')[0].message).toMatch(/background-color, not background-colour/);
  });
  it('mistake: centre', () => {
    expect(cssIssues('h1 { text-align: centre; }')[0].message).toMatch(/center, not centre/);
  });
  it('mistake: unknown property suggests the closest one', () => {
    const [issue] = cssIssues('p { font-szie: 18px; }');
    expect(issue.message).toMatch(/did you mean font-size\?/);
    expect(issue.meant).toBe('font-size');
  });
  it('fails css-syntax for spelling mistakes too', () => {
    const s = scan(styled('h1 { colour: red; }'));
    expect(checkCssSyntax(s, parseAllCss(s)).pass).toBe(false);
  });
  it('ignores comments', () => {
    expect(cssIssues('/* colour: red */ h1 { color: red; }')).toEqual([]);
  });
});

describe('source mistakes', () => {
  it('mistake: </img> is unnecessary', () => {
    const m = sourceMistakes(scan(page('', '<img src="a.png" alt="a ball on grass"></img>')));
    expect(m[0].message).toMatch(/<\/img> isn't needed/);
  });
  it('mistake: <head> used as a page header', () => {
    const m = sourceMistakes(scan(page('<title>x</title>', '<head><h1>Football</h1></head>')));
    expect(m[0].message).toMatch(/head holds information about the page/);
  });
  it('mistake: visible content inside head', () => {
    const m = sourceMistakes(scan(page('<h1>Football</h1>', '')));
    expect(m[0].message).toMatch(/Put visible content in body/);
  });
  it('finds nothing on a correct page', () => {
    expect(sourceMistakes(scan(COMPLETE))).toEqual([]);
  });
});
