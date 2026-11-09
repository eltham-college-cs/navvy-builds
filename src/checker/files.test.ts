import { describe, expect, it } from 'vitest';
import { cssLink, jsLink, runnerPage, staticPage } from './files';

const index = '<!DOCTYPE html>\n<html>\n<head>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>Hi</h1>\n  <script src="script.js"></script>\n</body>\n</html>';
const files = { 'index.html': index, 'style.css': 'h1 {\n  color: red;\n}', 'script.js': 'let a = 1;\nwhile (a < 3) a++;\n' };

describe('links between files', () => {
  it('finds the stylesheet link and the script tag', () => {
    expect(cssLink(index)?.line).toBe(4);
    expect(jsLink(index)?.line).toBe(8);
    expect(cssLink('<link href="./style.css" rel="stylesheet">')).toBeTruthy();
    expect(cssLink('<link href="style.css">')).toBeUndefined();
    expect(jsLink('<script src="main.js"></script>')).toBeUndefined();
  });
});

describe('static page', () => {
  it('inlines style.css on one line and removes scripts', () => {
    const { html, removedScripts } = staticPage(files);
    expect(html).toContain('<style data-nb-file="style.css">h1 {   color: red; }</style>');
    expect(html).not.toContain('<script');
    expect(removedScripts).toBe(true);
    expect(html.split('\n').length).toBe(index.split('\n').length);
  });
  it('leaves the link alone when the file name is wrong', () => {
    const { html } = staticPage({ ...files, 'index.html': '<link rel="stylesheet" href="styles.css">' });
    expect(html).not.toContain('<style');
  });
});

describe('runner page', () => {
  it('puts the harness after the doctype and inlines guarded script.js', () => {
    const { html, scriptStart } = runnerPage(files);
    expect(html.startsWith('<!DOCTYPE html><meta http-equiv="Content-Security-Policy"')).toBe(true);
    expect(html).toContain('__nbGuard(2);');
    expect(html).toContain('//# sourceURL=script.js');
    expect(scriptStart).toBe(8);
    // script.js line 1 is on the runner page's line 8.
    expect(html.split('\n')[7]).toContain('let a = 1;');
  });
  it('does not run script.js when index.html does not load it', () => {
    const { html, scriptStart } = runnerPage({ ...files, 'index.html': '<p>no script</p>' });
    expect(html).not.toContain('let a = 1;');
    expect(scriptStart).toBeUndefined();
  });
});

describe('harness', () => {
  it('is valid JavaScript on one line', async () => {
    const { parseJs } = await import('./js');
    const { html } = runnerPage(files);
    const harness = /<script>([\s\S]*?)<\/script>/.exec(html)![1];
    expect(harness.includes('\n')).toBe(false);
    expect(parseJs(harness).error).toBeUndefined();
  });
});
