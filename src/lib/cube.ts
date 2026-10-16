/** The Na<>y Builds logo: a gold pixel cube with </> on its front face. */

/** </> drawn in pixels, centred on the front face. */
const GLYPH = [
  [10, 20, 2, 2], [8, 22, 2, 4], [10, 26, 2, 2],
  [17, 18, 2, 3], [16, 21, 2, 3], [15, 24, 2, 3], [14, 27, 2, 3],
  [20, 20, 2, 2], [22, 22, 2, 4], [20, 26, 2, 2],
];

export function cubeSvg(opts: { outline?: string; label?: string } = {}): string {
  const k = opts.outline ?? '#0A1B2E';
  const a11y = opts.label ? `role="img" aria-label="${opts.label}"` : 'aria-hidden="true"';
  const glyph = GLYPH.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`).join('');
  return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" ${a11y}>
<polygon points="1,9 9,1 39,1 31,9" fill="#FFE08A" stroke="${k}" stroke-width="2" stroke-linejoin="miter"/>
<polygon points="31,9 39,1 39,31 31,39" fill="#B07D12" stroke="${k}" stroke-width="2" stroke-linejoin="miter"/>
<rect x="1" y="9" width="30" height="30" fill="#F2B533" stroke="${k}" stroke-width="2"/>
<g shape-rendering="crispEdges"><rect x="2" y="10" width="28" height="3" fill="#FFE08A"/><rect x="2" y="10" width="3" height="28" fill="#FFE08A"/><rect x="2" y="35" width="28" height="3" fill="#C99317"/><rect x="27" y="10" width="3" height="28" fill="#C99317"/>
<g fill="#0A1B2E">${glyph}</g></g>
</svg>`;
}
