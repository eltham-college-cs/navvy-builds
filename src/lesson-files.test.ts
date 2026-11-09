import { describe, expect, it } from 'vitest';
import { lessonSchema } from './lesson-schema';

const lessons = import.meta.glob<{ default: unknown }>('./content/lessons/*/lesson.json', { eager: true });

describe('lesson files', () => {
  for (const [path, mod] of Object.entries(lessons)) {
    it(`${path} matches the schema`, () => {
      const r = lessonSchema.safeParse(mod.default);
      expect(r.success ? '' : JSON.stringify(r.error.issues.slice(0, 3), null, 1)).toBe('');
    });
  }

  it('finds both lessons', () => {
    expect(Object.keys(lessons).length).toBeGreaterThanOrEqual(2);
  });

  it('every Sixth Form challenge id is unique', () => {
    const json = lessons['./content/lessons/02-web-app/lesson.json'].default as { levels: { challenges?: { id: string }[] }[] };
    const ids = json.levels.flatMap((l) => (l.challenges ?? []).map((c) => c.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
