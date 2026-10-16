/** CSS properties the checker recognises, for "did you mean" suggestions. */
export const KNOWN_PROPERTIES = new Set([
  'align-content', 'align-items', 'align-self', 'animation', 'aspect-ratio',
  'background', 'background-attachment', 'background-clip', 'background-color',
  'background-image', 'background-position', 'background-repeat', 'background-size',
  'border', 'border-bottom', 'border-collapse', 'border-color', 'border-left',
  'border-radius', 'border-right', 'border-spacing', 'border-style', 'border-top',
  'border-width', 'bottom', 'box-shadow', 'box-sizing', 'caption-side', 'clear',
  'color', 'column-count', 'column-gap', 'columns', 'cursor', 'direction', 'display',
  'filter', 'flex', 'flex-basis', 'flex-direction', 'flex-flow', 'flex-grow',
  'flex-shrink', 'flex-wrap', 'float', 'font', 'font-family', 'font-size',
  'font-style', 'font-variant', 'font-weight', 'gap', 'grid', 'grid-area',
  'grid-column', 'grid-row', 'grid-template-areas', 'grid-template-columns',
  'grid-template-rows', 'height', 'justify-content', 'justify-items', 'justify-self',
  'left', 'letter-spacing', 'line-height', 'list-style', 'list-style-image',
  'list-style-position', 'list-style-type', 'margin', 'margin-bottom', 'margin-left',
  'margin-right', 'margin-top', 'max-height', 'max-width', 'min-height', 'min-width',
  'object-fit', 'opacity', 'order', 'outline', 'outline-color', 'outline-offset',
  'outline-style', 'outline-width', 'overflow', 'overflow-x', 'overflow-y',
  'padding', 'padding-bottom', 'padding-left', 'padding-right', 'padding-top',
  'place-items', 'position', 'right', 'row-gap', 'text-align', 'text-decoration',
  'text-decoration-color', 'text-decoration-line', 'text-decoration-style',
  'text-indent', 'text-shadow', 'text-transform', 'top', 'transform', 'transition',
  'vertical-align', 'visibility', 'white-space', 'width', 'word-spacing',
  'word-wrap', 'overflow-wrap', 'z-index', 'accent-color', 'caret-color',
  'border-top-color', 'border-bottom-color', 'border-left-color', 'border-right-color',
]);

/** British spellings students often type, mapped to the real CSS spelling. */
export const BRITISH: Record<string, string> = {
  colour: 'color',
  'background-colour': 'background-color',
  'border-colour': 'border-color',
  'text-colour': 'color',
  'font-colour': 'color',
  'outline-colour': 'outline-color',
  'text-decoration-colour': 'text-decoration-color',
};

export function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** The closest known property, or undefined when nothing is close. */
export function closestProperty(name: string): string | undefined {
  let best: string | undefined;
  let bestDist = Infinity;
  for (const p of KNOWN_PROPERTIES) {
    const d = levenshtein(name, p);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  const limit = name.length <= 5 ? 2 : 3;
  return bestDist <= limit ? best : undefined;
}
