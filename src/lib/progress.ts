/** Everything a student does is saved in this browser only (localStorage). */
import { config } from '../config';

export type LevelId = number | 'boss';

export interface Progress {
  hobby: string | null;
  code: string | null;
  completed: LevelId[];
}

const key = (lessonId: string) => `${config.storageKey}:${lessonId}`;

export function loadProgress(lessonId: string): Progress {
  const empty: Progress = { hobby: null, code: null, completed: [] };
  try {
    const raw = localStorage.getItem(key(lessonId));
    if (!raw) return empty;
    const data = JSON.parse(raw);
    return {
      hobby: typeof data.hobby === 'string' ? data.hobby : null,
      code: typeof data.code === 'string' ? data.code : null,
      completed: Array.isArray(data.completed) ? data.completed : [],
    };
  } catch {
    return empty;
  }
}

export function saveProgress(lessonId: string, progress: Progress): void {
  try {
    localStorage.setItem(key(lessonId), JSON.stringify(progress));
  } catch {
    /* storage full or blocked: the page still works, it just won't remember */
  }
}

/** Level N is open once level N-1 is done. Level 1 is always open. */
export function isUnlocked(levelIds: LevelId[], completed: LevelId[], index: number): boolean {
  return index === 0 || completed.includes(levelIds[index - 1]);
}

/** The level to carry on from: the first open level that isn't done. */
export function currentIndex(levelIds: LevelId[], completed: LevelId[]): number {
  const i = levelIds.findIndex((id, n) => !completed.includes(id) && isUnlocked(levelIds, completed, n));
  return i === -1 ? levelIds.length - 1 : i;
}

export const levelHash = (id: LevelId) => `#level-${id}`;

export function parseLevelHash(hash: string): LevelId | null {
  const m = /^#level-(\d+|boss)$/i.exec(hash);
  if (!m) return null;
  return m[1].toLowerCase() === 'boss' ? 'boss' : Number(m[1]);
}
