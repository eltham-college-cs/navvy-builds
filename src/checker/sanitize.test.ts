import { describe, expect, it } from 'vitest';
import { previewHtml, sanitize, unstyledHtml } from './sanitize';

describe('sanitize', () => {
  it('strips scripts and on* attributes and says so', () => {
    const r = sanitize('<body onload="x()"><script>alert(1)</script><img src="a.png" onerror=\'y()\'><a href="javascript:z()">a</a></body>');
    expect(r.html).toBe('<body><img src="a.png"><a href="#">a</a></body>');
    expect(r.removedScripts).toBe(true);
  });
  it('leaves normal pages alone', () => {
    const html = '<p>Carry on = keep going</p>';
    expect(sanitize(html)).toEqual({ html, removedScripts: false });
  });
  it('points library paths at the image library and adds a base', () => {
    const out = previewHtml('<head></head><img src="images/football-1.png">', 'https://x/', 'https://x/images/hobbies/');
    expect(out).toBe('<head><base href="https://x/"></head><img src="https://x/images/hobbies/football-1.png">');
  });
  it('removes author styles for the defaults twin', () => {
    expect(unstyledHtml('<style>h1{}</style><h1 style="color:red">a</h1>')).toBe('<h1>a</h1>');
  });
});
