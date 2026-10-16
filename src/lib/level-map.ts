import { isUnlocked, type LevelId } from './progress';

/** Show each level block as locked, current or done. */
export function applyLevelMap(root: ParentNode, ids: LevelId[], completed: LevelId[], here?: LevelId): void {
  const firstOpen = ids.findIndex((id, i) => !completed.includes(id) && isUnlocked(ids, completed, i));
  root.querySelectorAll<HTMLAnchorElement>('[data-level-map] .level-block').forEach((block) => {
    const raw = block.dataset.levelId!;
    const id: LevelId = raw === 'boss' ? 'boss' : Number(raw);
    const index = ids.indexOf(id);
    const done = completed.includes(id);
    const open = isUnlocked(ids, completed, index);
    const state = done ? 'done' : open && index === firstOpen ? 'current' : open ? 'current' : 'locked';
    block.dataset.state = state;
    block.classList.toggle('here', here !== undefined && id === here);
    if (here !== undefined && id === here) block.setAttribute('aria-current', 'step');
    else block.removeAttribute('aria-current');
    if (state === 'locked') block.setAttribute('aria-disabled', 'true');
    else block.removeAttribute('aria-disabled');
    const name = id === 'boss' ? 'Boss level' : `Level ${id}`;
    const status = done ? 'done' : state === 'locked' ? 'locked' : 'ready to play';
    block.querySelector('.sr-label')!.textContent = `${name}: ${block.dataset.title}, ${status}`;
    block.title = state === 'locked' ? `Locked: finish the level before it first` : `${name}: ${block.dataset.title}`;
  });
}

/** Locked blocks don't navigate. */
export function guardLockedLinks(root: ParentNode, onLocked?: (id: string) => void): void {
  root.querySelectorAll<HTMLAnchorElement>('[data-level-map] .level-block').forEach((block) => {
    block.addEventListener('click', (e) => {
      if (block.dataset.state === 'locked') {
        e.preventDefault();
        onLocked?.(block.dataset.levelId!);
      }
    });
  });
}
