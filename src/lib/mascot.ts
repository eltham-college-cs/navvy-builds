/** The pixel snake from the logo, drawn as SVG, with three moods. */

export type Mood = 'idle' | 'happy' | 'tryagain';

const ROWS = [
  '...........KKKKKKKK.....',
  '.............KKKK..Y....',
  '..........KKKGGGGKK..Y..',
  '.........KGGGGGGGGGKK...',
  '........KGGWWGGGGWWGGK..',
  '........KGGWKGGGGWKGGGK.',
  '........KGGGKGGGGGKGGGGK',
  '.........KGGGKKKKKGGGGKR',
  '..........KKGGGGGGGKKK.R',
  '...........KGCDGK.......',
  '............KGCDGK......',
  '............KGCGDK......',
  '.K.........KGCDGK.......',
  '.KK...KKKKKGCDGK........',
  '..KGKKGGDGGGGGDKKKKK....',
  '..KGGGGGGDGGGGGGGDGGK...',
  '...KGDGGGGGGGDGGGGGDGK..',
  '....KKKKKKKKKKKKKKKKKK..',
];

const PALETTE: Record<string, string> = {
  K: '#0A1B2E',
  G: '#F2B533',
  D: '#163351',
  W: '#FFFFFF',
  R: '#D9455F',
  C: '#FFF1C9',
  Y: '#E3C783',
  B: '#7CC4F2',
};

/** Pixel changes for each mood: [row, column, colour key]. */
const MOODS: Record<Mood, [number, number, string][]> = {
  idle: [],
  happy: [
    // closed, smiling eyes: ^ ^
    [4, 11, 'G'], [4, 12, 'K'], [5, 11, 'K'], [5, 12, 'G'], [5, 13, 'K'], [6, 12, 'G'],
    [4, 17, 'G'], [4, 18, 'K'], [5, 17, 'K'], [5, 18, 'G'], [5, 19, 'K'], [6, 18, 'G'],
    // wider smile
    [6, 13, 'K'], [6, 17, 'K'],
  ],
  tryagain: [
    // worried eyes looking down, wobbly mouth, a drop of sweat
    [4, 11, 'K'], [4, 12, 'K'], [5, 12, 'W'], [6, 12, 'G'], [6, 11, 'K'],
    [4, 17, 'K'], [4, 18, 'K'], [5, 18, 'W'], [6, 18, 'G'], [6, 17, 'K'],
    [7, 14, 'G'], [7, 16, 'G'], [8, 14, 'K'], [8, 16, 'K'],
    [1, 19, '.'], [2, 21, '.'], [1, 22, 'B'], [2, 22, 'B'], [2, 23, 'B'], [3, 22, 'B'],
  ],
};

export function mascotSvg(mood: Mood = 'idle', label = ''): string {
  const grid = ROWS.map((r) => r.split(''));
  for (const [r, c, ch] of MOODS[mood]) grid[r][c] = ch;
  const rects: string[] = [];
  grid.forEach((row, y) => {
    // Merge runs of the same colour to keep the SVG small.
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      if (PALETTE[ch]) rects.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${PALETTE[ch]}"/>`);
      x = end;
    }
  });
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg viewBox="0 0 24 18" ${a11y} shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${rects.join('')}</svg>`;
}
