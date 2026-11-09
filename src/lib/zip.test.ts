import { describe, expect, it } from 'vitest';
import { crc32, makeZip } from './zip';

describe('zip', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
  it('writes local headers, a central directory and an end record', () => {
    const zip = makeZip([
      { name: 'index.html', text: '<h1>Hi</h1>' },
      { name: 'script.js', text: 'alert("é");' },
    ]);
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    const end = zip.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    const centralStart = view.getUint32(end + 16, true);
    expect(view.getUint32(centralStart, true)).toBe(0x02014b50);
    const text = new TextDecoder().decode(zip);
    expect(text).toContain('index.html');
    expect(text).toContain('alert("é");');
  });
});
