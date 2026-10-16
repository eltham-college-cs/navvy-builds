import { describe, expect, it } from 'vitest';
import raw from '../content/lessons/01-my-hobby-page/lesson.json';
import { lessonSchema } from '../lesson-schema';
import { COMPLETE } from './fixtures/complete';
import { fakeStyleEnv } from './fixtures/fake-style-env';
import { pageMistakes, preparePage, runLevel } from './run';

const lesson = lessonSchema.parse(raw);
const results = (source: string, hobby = 'football') => {
  const page = preparePage(source, hobby);
  const env = fakeStyleEnv(page.safeHtml);
  return lesson.levels.map((_, i) => runLevel(lesson, i, page, env));
};

describe('lesson 1', () => {
  it('validates against the schema', () => {
    expect(lesson.levels).toHaveLength(8);
  });
  it('the complete page passes every level, boss included', () => {
    for (const [i, r] of results(COMPLETE).entries()) {
      expect({ level: i + 1, failing: r.goals.filter((g) => !g.pass) }).toEqual({ level: i + 1, failing: [] });
    }
  });
  it('the starter passes nothing', () => {
    const starter = lesson.starter.replace('{hobby}', 'football');
    expect(results(starter)[0].goals.every((g) => !g.pass)).toBe(true);
  });
  it('fills {hobby} in goal text', () => {
    expect(results(COMPLETE)[0].goals[2].text).toBe('Give the page a title that mentions football');
  });
  it('the boss level reports which earlier level broke', () => {
    const broken = COMPLETE.replace('Visit the FA website', 'click here');
    const boss = results(broken).at(-1)!;
    expect(boss.goals[2].message).toMatch(/^Level 5 \(Links\) needs fixing: Say where the link goes/);
  });
  it('style goals are pending without a preview', () => {
    const page = preparePage(COMPLETE, 'football');
    const r = runLevel(lesson, 6, page);
    expect(r.pending).toBe(true);
    expect(r.pass).toBe(false);
  });
  it('lists page-wide mistakes', () => {
    const page = preparePage(COMPLETE.replace('color: navy', 'colour: navy').replace('<body>', '<body onload="x()">'), 'football');
    const messages = pageMistakes(page).map((m) => m.message).join('\n');
    expect(messages).toMatch(/color, not colour/);
    expect(messages).toMatch(/Scripts don't run here/);
  });
});
