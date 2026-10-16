/** A short pixel coin burst from an element when a level is complete. */
const COLOURS = ['#F2B533', '#FFE08A', '#1F9D5C', '#7CC4F2', '#FFFFFF'];

export function celebrate(from: HTMLElement): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = from.getBoundingClientRect();
  const layer = document.createElement('div');
  layer.className = 'celebrate';
  layer.setAttribute('aria-hidden', 'true');
  layer.style.left = `${box.left + box.width / 2}px`;
  layer.style.top = `${box.top + box.height / 2}px`;
  const count = 18;
  for (let i = 0; i < count; i++) {
    const coin = document.createElement('span');
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
    const dist = 70 + Math.random() * 70;
    coin.style.setProperty('--x', `${Math.round(Math.cos(angle) * dist)}px`);
    coin.style.setProperty('--y', `${Math.round(Math.sin(angle) * dist - 40)}px`);
    coin.style.background = COLOURS[i % COLOURS.length];
    coin.style.animationDelay = `${(i % 3) * 40}ms`;
    layer.append(coin);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 1100);
}
