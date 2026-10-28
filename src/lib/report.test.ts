import { describe, expect, it } from 'vitest';
import { codeRows, pdfSafe, reportFileName } from './report';

describe('report', () => {
  it('swaps characters the PDF fonts cannot draw', () => {
    expect(pdfSafe('“Hi” – it’s £5…\tok')).toBe('"Hi" - it\'s £5...  ok');
    expect(pdfSafe('Goal ⚽ café')).toBe('Goal ? café');
  });
  it('numbers code lines and wraps long ones', () => {
    expect(codeRows('<h1>\r\n  abcdefgh\n', 6)).toEqual([
      { line: 1, text: '<h1>' },
      { line: 2, text: '  abcd' },
      { line: null, text: 'efgh' },
    ]);
    expect(codeRows('', 10)).toEqual([{ line: 1, text: '' }]);
    expect(codeRows('<p>I love it so</p>', 12)).toEqual([
      { line: 1, text: '<p>I love it ' },
      { line: null, text: 'so</p>' },
    ]);
  });
  it('names the file after the student', () => {
    expect(reportFileName('  Zoë O’Brien ')).toBe('my-hobby-page-report-zoe-o-brien.pdf');
    expect(reportFileName('')).toBe('my-hobby-page-report.pdf');
    expect(reportFileName('!!!')).toBe('my-hobby-page-report.pdf');
  });
});
