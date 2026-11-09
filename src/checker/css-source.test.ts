import { describe, expect, it } from 'vitest';
import { checkCssFileSyntax, checkCssKind, checkCssRule, checkInlineStyle, cssMistakes, parseStyleCss } from './css-source';
import { parsePage } from './dom';

const css = parseStyleCss('body {\n  background-color: #F4F7FB;\n}\nh1, h2 { color: navy; }\n#menu { background-color: #163351; }\n.infoBox { border-style: solid; }\n');

describe('style.css checks', () => {
  it('finds rules, including in selector lists', () => {
    expect(checkCssRule(css, 'body', 'background-color').pass).toBe(true);
    expect(checkCssRule(css, 'h2', 'color').pass).toBe(true);
    expect(checkCssRule(css, 'p').message).toMatch(/Add a p rule/);
    expect(checkCssRule(css, 'h1', 'font-size').message).toMatch(/needs font-size/);
  });
  it('checks for a hex colour', () => {
    expect(checkCssRule(css, 'body', 'background-color', true).pass).toBe(true);
    expect(checkCssRule(css, 'h1', 'color', true).message).toMatch(/hex colour/);
  });
  it('checks each kind of selector', () => {
    expect(checkCssKind(css, 'element').pass).toBe(true);
    expect(checkCssKind(css, 'id').pass).toBe(true);
    expect(checkCssKind(css, 'class').pass).toBe(true);
    expect(checkCssKind(parseStyleCss('h1 { color: red; }'), 'class').message).toMatch(/a dot/);
  });
  it('reports syntax with style.css in front', () => {
    const bad = 'h1 {\n  color: red\n  font-size: 20px;\n}';
    const r = checkCssFileSyntax(bad, parseStyleCss(bad));
    expect(r.message).toMatch(/^style\.css line 2: missing ;/);
    expect(checkCssFileSyntax(undefined, parseStyleCss(undefined)).message).toMatch(/Create style.css/);
  });
});

describe('inline styles', () => {
  const doc = parsePage('<h1 style="color:blue;">Hi</h1><p>x</p>');
  it('finds a style attribute and its property', () => {
    expect(checkInlineStyle(doc).pass).toBe(true);
    expect(checkInlineStyle(doc, 'h1', 'color').pass).toBe(true);
    expect(checkInlineStyle(doc, 'h1', 'font-size').message).toMatch(/font-size inside the style attribute/);
    expect(checkInlineStyle(doc, 'p').message).toMatch(/style attribute/);
  });
});

describe('CSS mistakes', () => {
  const html = '<head><link rel="stylesheet" href="style.css"></head><body><div id="menu"></div><div class="box" id="x"></div><p id="x"></p></body>';
  const messages = (cssText: string, page = html) => cssMistakes(page, cssText, parseStyleCss(cssText), parsePage(page)).map((m) => m.message);
  it('spots . used for an id, and # for a class', () => {
    expect(messages('.menu { color: red; }')[0]).toMatch(/use #menu/);
    expect(messages('#box { color: red; }')[0]).toMatch(/use \.box/);
  });
  it('spots a border with no style', () => {
    expect(messages('.box { border-width: 2px; border-color: red; }')[0]).toMatch(/border-style/);
  });
  it('spots a bad hex colour', () => {
    expect(messages('h1 { color: #12345; }')[0]).toMatch(/3 or 6 digits/);
    expect(messages('h1 { color: 1A2B3C; }')[0]).toMatch(/start with #/);
  });
  it('spots a duplicate id', () => {
    expect(messages('h1 { color: red; }').join(' ')).toMatch(/id="x" is used 2 times/);
  });
  it('spots a link to the wrong file or with no rel', () => {
    expect(messages('h1 {}', '<link rel="stylesheet" href="styles.css">')[0]).toMatch(/links to styles.css/);
    expect(messages('h1 {}', '<link href="style.css">')[0]).toMatch(/rel="stylesheet"/);
  });
  it('spots CSS typed into index.html', () => {
    expect(messages('', '<body>\nh1 { color: red; }\n</body>').join(' ')).toMatch(/is CSS. Put it in style.css/);
  });
});
