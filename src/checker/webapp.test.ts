import { describe, expect, it } from 'vitest';
import lessonJson from '../content/lessons/02-web-app/lesson.json';
import { lessonSchema, type Lesson } from '../lesson-schema';
import type { Files } from './files';
import {
  friendlyRuntime,
  prepareProject,
  projectMistakes,
  runWebLevel,
  sameValue,
  showsExpected,
  type Runtime,
  type SubmitOutcome,
} from './webapp';

const lesson: Lesson = lessonSchema.parse(lessonJson);
const brief = lesson.briefs!.find((b) => b.id === 'password')!;
const index = (n: number) => lesson.levels.findIndex((l) => l.id === n);

/** A fake runtime that runs script.js as a plain function and fakes the form. */
function fakeRuntime(files: Files, submit?: (value: string) => SubmitOutcome): Runtime {
  return {
    async call(fn, args) {
      try {
        const f = new Function(`${files['script.js']}\n;return typeof ${fn} === 'function' ? ${fn} : undefined;`)();
        if (!f) return { missing: true };
        const v = f(...args);
        return v === undefined ? { undef: true } : { value: v, display: JSON.stringify(v) };
      } catch (e) {
        return { error: String((e as Error).message) };
      }
    },
    async submit(_form, _name, value) {
      return submit ? submit(value) : { target: { found: true, text: '' } };
    },
    async loadErrors() {
      return [];
    },
  };
}

const level6Files: Files = {
  'index.html': `<!DOCTYPE html>
<html>
<head>
  <title>Password checker</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="menu"><h1>Password checker</h1></div>
  <form id="app">
    <input type="text" name="pwd">
    <input type="submit" value="Check">
  </form>
  <div id="result" class="infoBox"></div>
  <script src="script.js"></script>
</body>
</html>`,
  'style.css': '#menu { background-color: #163351; }\n.infoBox { border-style: solid; }\n',
  // Stubs for document and form, because the fake runtime runs this as a plain function.
  'script.js': `function checkPassword(pwd) {
  let score = 0;
  if (pwd.length >= 8) {
    score = score + 1;
  }
  for (let i = 0; i < pwd.length; i++) {
    if (pwd[i] >= "0" && pwd[i] <= "9") {
      score = score + 1;
      break;
    }
  }
  return score;
}
`,
};

describe('matching output', () => {
  it('compares return values', () => {
    expect(sameValue(2, 2)).toBe(true);
    expect(sameValue('2', 2)).toBe(true);
    expect(sameValue(2.5000000001, 2.5)).toBe(true);
    expect(sameValue('pass', 'Pass')).toBe(true);
    expect(sameValue(undefined, 0)).toBe(false);
  });
  it('reads the first number, or a whole word', () => {
    expect(showsExpected('Strength: 2/2', '2')).toBe(true);
    expect(showsExpected('Strength: 1/2', '2')).toBe(false);
    expect(showsExpected('Your grade is B.', 'B')).toBe(true);
    expect(showsExpected('Bad', 'B')).toBe(false);
    expect(showsExpected('Strong password', 'Strong')).toBe(true);
    expect(showsExpected('anything', '')).toBe(true);
  });
  it('explains runtime errors', () => {
    expect(friendlyRuntime("TypeError: Cannot set properties of null (setting 'innerHTML')")).toMatch(/getElementById found nothing/);
    expect(friendlyRuntime('ReferenceError: scroe is not defined')).toMatch(/scroe is not defined. Check the spelling/);
    expect(friendlyRuntime('Error: __NB_LOOP__7')).toMatch(/never stops.*line 7/);
  });
});

describe('level 6 for the password brief', () => {
  const ctx = { lesson, levelIndex: index(6) };

  it('reports runtime goals as pending with no runtime', async () => {
    const r = await runWebLevel(prepareProject(level6Files, brief), ctx);
    expect(r.goals[0].pass).toBe(true);
    expect(r.goals[1].pending).toBe(true);
    expect(r.pass).toBe(false);
  });

  it('passes the function tests and fails on an empty #result', async () => {
    const p = prepareProject(level6Files, brief);
    const r = await runWebLevel(p, { ...ctx, runtime: fakeRuntime(level6Files) });
    expect(r.goals[1].pass).toBe(true);
    expect(r.goals[2].pass).toBe(false);
  });

  it('says what a wrong return value was', async () => {
    const files = { ...level6Files, 'script.js': 'function checkPassword(pwd) {\n  return 1;\n}\n' };
    const r = await runWebLevel(prepareProject(files, brief), { ...ctx, runtime: fakeRuntime(files) });
    expect(r.goals[1].message).toBe('checkPassword("abc") returned 1, but it should return 0.');
  });

  it('spots a missing return', async () => {
    const files = { ...level6Files, 'script.js': 'function checkPassword(pwd) {\n  let s = 0;\n}\n' };
    const r = await runWebLevel(prepareProject(files, brief), { ...ctx, runtime: fakeRuntime(files) });
    expect(r.goals[1].message).toMatch(/returned undefined/);
  });

  it('checks what the form shows', async () => {
    const withOutput = {
      ...level6Files,
      'script.js': level6Files['script.js'] + 'function show(s) {\n  document.getElementById("result").innerHTML = s;\n}\n',
    };
    const p = prepareProject(withOutput, brief);
    const right = await runWebLevel(p, {
      ...ctx,
      runtime: fakeRuntime(withOutput, (v) => ({ target: { found: true, text: `Strength: ${v === 'abc' ? 0 : 2}/2` } })),
    });
    expect(right.goals[2].pass).toBe(true);
    expect(right.pass).toBe(true);
    const wrong = await runWebLevel(p, {
      ...ctx,
      runtime: fakeRuntime(withOutput, () => ({ target: { found: true, text: 'Strength: 1/2' } })),
    });
    expect(wrong.goals[2].message).toBe('After typing "hunter22" and pressing the button, #result shows "Strength: 1/2". It should show 2.');
    const reload = await runWebLevel(p, { ...ctx, runtime: fakeRuntime(withOutput, () => ({ reloaded: true })) });
    expect(reload.goals[2].message).toMatch(/return false/);
  });

  it('treats the stretch goal as optional', async () => {
    const withOutput = {
      ...level6Files,
      'script.js': level6Files['script.js'] + 'function show(s) {\n  document.getElementById("result").innerHTML = s;\n}\n',
    };
    const r = await runWebLevel(prepareProject(withOutput, brief), {
      ...ctx,
      runtime: fakeRuntime(withOutput, (v) => ({ target: { found: true, text: `${v === 'abc' ? 0 : 2}` } })),
    });
    expect(r.goals[3].stretch).toBe(true);
    expect(r.goals[3].pass).toBe(false);
    expect(r.pass).toBe(true);
  });
});

describe('earlier levels', () => {
  it('fills {inputName} in level 5 selectors', async () => {
    const r = await runWebLevel(prepareProject(level6Files, brief), { lesson, levelIndex: index(5) });
    expect(r.goals.map((g) => g.pass)).toEqual([true, true, true, true]);
    const grades = lesson.briefs!.find((b) => b.id === 'grades')!;
    const r2 = await runWebLevel(prepareProject(level6Files, grades), { lesson, levelIndex: index(5) });
    expect(r2.goals[1].pass).toBe(false);
  });

  it('checks the stylesheet link in level 3', async () => {
    const files = { ...level6Files, 'index.html': level6Files['index.html']!.replace('style.css', 'styles.css') };
    const r = await runWebLevel(prepareProject(files, brief), { lesson, levelIndex: index(3) });
    expect(r.goals[0].message).toMatch(/<link rel="stylesheet" href="style.css">/);
  });
});

describe('mistakes across files', () => {
  it('collects HTML, CSS and JavaScript mistakes', () => {
    const files: Files = {
      'index.html': '<html><head><script src="script.js"></script></head><body><div id="menu"></div></body></html>',
      'style.css': '.menu { color: red; }',
      'script.js': 'document.getElementByID("menu");',
    };
    const all = projectMistakes(prepareProject(files, brief)).map((m) => m.message).join('\n');
    expect(all).toMatch(/use #menu/);
    expect(all).toMatch(/getElementById, not getElementByID/);
    expect(all).toMatch(/Move <script> to the end of body/);
  });
});

/**
 * Reference solutions, used only here to prove each brief's tests can be met.
 * They are never shipped on the site (CLAUDE.md: no model answers).
 */
const SOLUTIONS: Record<string, Record<string, string>> = {
  password: {
    '6': `function checkPassword(pwd) {
  let score = 0;
  if (pwd.length >= 8) { score = score + 1; }
  for (let i = 0; i < pwd.length; i++) {
    if (pwd[i] >= "0" && pwd[i] <= "9") { score = score + 1; break; }
  }
  return score;
}`,
    '7': `function checkPassword(pwd) {
  let score = 0;
  let digit = false;
  let capital = false;
  if (pwd.length >= 8) { score = score + 1; }
  for (let i = 0; i < pwd.length; i++) {
    if (pwd[i] >= "0" && pwd[i] <= "9") { digit = true; }
    if (pwd[i] >= "A" && pwd[i] <= "Z") { capital = true; }
  }
  if (digit) { score = score + 1; }
  if (capital) { score = score + 1; }
  return score;
}`,
  },
  grades: {
    '6': `function getGrade(mark) { if (mark >= 40) { return "Pass"; } else { return "Fail"; } }`,
    '7': `function getGrade(mark) {
  const bounds = [90, 80, 70, 60, 50, 40];
  const grades = ["A*", "A", "B", "C", "D", "E"];
  for (let i = 0; i < bounds.length; i++) {
    if (mark >= bounds[i]) { return grades[i]; }
  }
  return "U";
}`,
  },
  cafe: {
    '6': `function orderCost(drink, qty) { return 320 * qty; }`,
    '7': `function orderCost(drink, qty) {
  const drinks = ["tea", "coffee", "latte", "hot chocolate"];
  const prices = [180, 250, 320, 300];
  for (let i = 0; i < drinks.length; i++) {
    if (drinks[i] == drink) { return prices[i] * qty; }
  }
  return 0;
}`,
  },
  units: {
    '6': `function convert(value, unit) { if (unit == "km") { return value * 5 / 8; } return value * 8 / 5; }`,
    '7': `function convert(value, unit) {
  switch (unit) {
    case "km": return value * 5 / 8;
    case "miles": return value * 8 / 5;
    case "m": return value * 100;
    case "cm": return value / 100;
    case "kg": return value * 1000;
    default: return -1;
  }
}`,
  },
};

describe('every brief can be solved', () => {
  for (const b of lesson.briefs!) {
    for (const level of ['6', '7']) {
      it(`${b.name}, level ${level}`, async () => {
        const files = { ...level6Files, 'script.js': SOLUTIONS[b.id][level] };
        const levelIndex = lesson.levels.findIndex((l) => String(l.id) === level);
        const check = lesson.levels[levelIndex].goals.flatMap((g) => g.checks).find((c) => c.type === 'js-call')!;
        const { runWebCheck } = await import('./webapp');
        const r = await runWebCheck(check, prepareProject(files, b), { lesson, levelIndex, runtime: fakeRuntime(files) });
        expect(r.message ?? '').toBe('');
        expect(r.pass).toBe(true);
      });
    }
  }
});
