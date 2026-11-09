/**
 * Runs a Sixth Form level's checks against the student's three files. Checks
 * that need the student's JavaScript to run ask a Runtime (the runner frame in
 * the browser, a fake in tests); without one they report "pending".
 */
import type { Brief, CallTest, Check, EventTest, Lesson } from '../lesson-schema';
import {
  checkCssFileSyntax,
  checkCssKind,
  checkCssRule,
  checkInlineStyle,
  cssMistakes,
  parseStyleCss,
} from './css-source';
import { cssLink, jsLink, staticPage, type Files } from './files';
import { checkDefines, checkJsSyntax, checkUses, jsMistakes, pageIds, parseJs } from './js';
import { pageMistakes, preparePage, runCheck, type GoalResult, type LevelResult, type Page } from './run';
import type { CssParse } from './source';
import type { StyleEnv } from './style';
import { fail, pass, type CheckResult, type Mistake } from './types';

export interface Project {
  files: Files;
  brief: Brief;
  /** index.html prepared as in Year 8, with style.css inlined for the checks. */
  page: Page;
  css: CssParse;
}

export function prepareProject(files: Files, brief: Brief): Project {
  const { html } = staticPage(files);
  const page = preparePage(files['index.html'] ?? '', brief.keyword);
  // DOM and style checks look at the page with style.css inlined.
  const withCss = preparePage(html, brief.keyword);
  return {
    files,
    brief,
    page: { ...page, doc: withCss.doc, safeHtml: withCss.safeHtml, removedScripts: page.removedScripts },
    css: parseStyleCss(files['style.css']),
  };
}

/* ------------------------------------------------------------ brief text */

export function fillBrief(text: string, brief: Brief): string {
  return text
    .replaceAll('{brief}', brief.name.toLowerCase())
    .replaceAll('{Brief}', brief.name)
    .replaceAll('{fn}', brief.fn)
    .replaceAll('{inputName}', brief.inputName)
    .replaceAll('{keyword}', brief.keyword)
    .replaceAll('{example}', brief.example)
    .replaceAll('{hobby}', brief.keyword);
}

/* --------------------------------------------------------------- runtime */

export interface CallOutcome {
  missing?: boolean;
  error?: string;
  undef?: boolean;
  value?: unknown;
  display?: string;
}

export interface SubmitOutcome {
  noForm?: boolean;
  noInput?: boolean;
  reloaded?: boolean;
  alerts?: string[];
  writes?: string[];
  errors?: string[];
  target?: { found: boolean; text?: string } | null;
}

export interface Runtime {
  call(fn: string, args: unknown[]): Promise<CallOutcome>;
  submit(form: string, inputName: string, value: string, selector?: string): Promise<SubmitOutcome>;
  /** Errors thrown while the page loaded. */
  loadErrors(): Promise<string[]>;
}

/** Turn a browser error message into one a student can act on. */
export function friendlyRuntime(message: string, fallbackLine?: number): string {
  const loop = /__NB_LOOP__(\d+)/.exec(message);
  if (loop) return `This loop never stops. Check the condition on line ${loop[1]} of script.js.`;
  const m = message.replace(/^Uncaught\s+/, '');
  let r: RegExpExecArray | null;
  if ((r = /Cannot set propert(?:y|ies) of null \(setting '(\w+)'\)|Cannot set property '(\w+)' of null/.exec(m))) {
    return `getElementById found nothing, so there's no element to set ${r[1] ?? r[2]} on. Check the id matches index.html exactly.`;
  }
  if ((r = /Cannot read propert(?:y|ies) of (null|undefined) \(reading '(\w+)'\)/.exec(m))) {
    return `Something is ${r[1]}, so it has no ${r[2]}. If it came from getElementById, check the id matches index.html.`;
  }
  if ((r = /^ReferenceError: (\S+) is not defined/.exec(m))) {
    return `${r[1]} is not defined. Check the spelling and capitals, and that you created it with let or const.`;
  }
  if ((r = /^TypeError: (\S+) is not a function/.exec(m))) {
    return `${r[1]} is not a function. Check the spelling and capitals.`;
  }
  return `${m.replace(/^\w*Error: /, '')}${fallbackLine ? ` (script.js line ${fallbackLine})` : ''}`;
}

/** Tests for a check: its own list, or the brief's tests for this level. */
function testsFor(tests: 'brief' | (CallTest | EventTest)[], brief: Brief, levelId: string) {
  return tests === 'brief' ? (brief.tests[levelId] ?? []) : tests;
}
const isCall = (t: CallTest | EventTest): t is CallTest => 'args' in t;

const show = (v: unknown) => (typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v) ?? String(v));
const showArgs = (args: unknown[]) => args.map(show).join(', ');

export function sameValue(actual: unknown, expected: unknown): boolean {
  if (typeof expected === 'number') {
    const n = typeof actual === 'string' && actual.trim() !== '' ? Number(actual) : actual;
    return typeof n === 'number' && Math.abs(n - expected) < 1e-9;
  }
  if (typeof expected === 'string') return typeof actual === 'string' && actual.trim().toLowerCase() === expected.trim().toLowerCase();
  return JSON.stringify(actual) === JSON.stringify(expected);
}

/**
 * Does what the page shows match what a test expects? A number must be the
 * first number shown ("Strength: 2/2" shows 2). A word must appear as a word.
 */
export function showsExpected(text: string, expect: string): boolean {
  const t = text.trim();
  if (expect === '') return t !== '';
  if (/^-?\d+(\.\d+)?$/.test(expect)) {
    const first = /-?\d+(\.\d+)?/.exec(t);
    return !!first && Number(first[0]) === Number(expect);
  }
  const esc = expect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${esc}($|[^\\p{L}\\p{N}])`, 'iu').test(t);
}

async function checkCall(runtime: Runtime, fn: string, tests: CallTest[]): Promise<CheckResult> {
  for (const t of tests) {
    const r = await runtime.call(fn, t.args);
    const call = `${fn}(${showArgs(t.args)})`;
    if (r.missing) return fail(`Write a function called ${fn} in script.js.`);
    if (r.error) return fail(`${call} stopped with an error: ${friendlyRuntime(r.error)}`);
    if (r.undef) return fail(`${call} returned undefined. Did you forget to return the answer?`);
    if (!sameValue(r.value, t.returns)) return fail(`${call} returned ${r.display ?? show(r.value)}, but it should return ${show(t.returns)}.`);
  }
  return pass();
}

async function checkEvent(
  runtime: Runtime,
  check: Extract<Check, { type: 'js-event' }>,
  brief: Brief,
  tests: EventTest[],
): Promise<CheckResult> {
  for (const t of tests) {
    const r = await runtime.submit(check.form, brief.inputName, t.input, check.selector);
    const typed = t.input === '' ? 'leaving the box empty' : `typing "${t.input}"`;
    if (r.noForm) return fail('Add a form to index.html first.');
    if (r.noInput) return fail(`Your form needs a text box: <input type="text" name="${brief.inputName}">`);
    if (r.errors?.length) return fail(`After ${typed} and pressing the button, your code stopped: ${friendlyRuntime(r.errors[0])}`);
    if (r.reloaded) return fail('Your form tried to reload the page. End the onsubmit function with return false;');
    if (check.expect === 'innerHTML') {
      const sel = check.selector ?? '#result';
      if (!r.target?.found) return fail(`There's no element matching ${sel} in index.html.`, { highlight: { selector: sel } });
      const shown = (r.target.text ?? '').trim();
      if (!shown) return fail(`After ${typed} and pressing the button, ${sel} is still empty. Set its innerHTML.`, { highlight: { selector: sel } });
      if (!showsExpected(shown, t.expect)) {
        return fail(`After ${typed} and pressing the button, ${sel} shows "${shown}". It should show ${t.expect}.`, { highlight: { selector: sel } });
      }
    } else {
      const out = check.expect === 'alert' ? r.alerts ?? [] : r.writes ?? [];
      const how = check.expect === 'alert' ? 'alert()' : 'document.write()';
      if (out.length === 0) return fail(`After ${typed} and pressing the button, nothing was shown with ${how}.`);
      if (!out.some((o) => showsExpected(o, t.expect))) {
        return fail(`After ${typed}, ${how} showed "${out[0]}". It should show ${t.expect}.`);
      }
    }
  }
  return pass();
}

/* ---------------------------------------------------------------- checks */

export interface WebContext {
  lesson: Lesson;
  levelIndex: number;
  env?: StyleEnv;
  runtime?: Runtime;
}

const RUNTIME_CHECKS = new Set(['js-call', 'js-event', 'js-no-error']);
const pending = (): CheckResult => ({ pass: false, pending: true, message: 'Running your code…' });

export async function runWebCheck(raw: Check, project: Project, ctx: WebContext): Promise<CheckResult> {
  const { files, page, css, brief } = project;
  // Selectors and names can use {inputName}, {fn} and so on.
  const check = JSON.parse(fillBrief(JSON.stringify(raw), brief)) as Check;
  const levelId = String(ctx.lesson.levels[ctx.levelIndex].id);
  switch (check.type) {
    case 'file-exists':
      return files[check.file] !== undefined ? pass() : fail(`Create ${check.file} first.`);
    case 'links-file': {
      const html = files['index.html'] ?? '';
      if (check.file === 'style.css') {
        return cssLink(html) ? pass() : fail('Link your stylesheet in head: <link rel="stylesheet" href="style.css">');
      }
      return jsLink(html) ? pass() : fail('Load your script at the end of body: <script src="script.js"></script>');
    }
    case 'css-file-syntax':
      return checkCssFileSyntax(files['style.css'], css);
    case 'css-rule':
      if (files['style.css'] === undefined) return fail('Create style.css first.');
      return checkCssRule(css, check.selector, check.property, check.hex);
    case 'css-kind':
      return checkCssKind(css, check.kind);
    case 'inline-style':
      return checkInlineStyle(page.doc, check.selector, check.property);
    case 'js-syntax':
      return checkJsSyntax(files['script.js']);
    case 'js-defines':
      return checkDefines(files['script.js'], fillBrief(check.name, brief), check.params);
    case 'js-uses':
      return checkUses(files['script.js'], check.construct);
    case 'js-no-error': {
      const syntax = checkJsSyntax(files['script.js']);
      if (!syntax.pass) return syntax;
      if (!ctx.runtime) return pending();
      const errors = await ctx.runtime.loadErrors();
      return errors.length ? fail(`Your script stopped with an error: ${friendlyRuntime(errors[0])}`) : pass();
    }
    case 'js-call': {
      const fn = fillBrief(check.fn, brief);
      const defined = checkDefines(files['script.js'], fn);
      if (!defined.pass) return defined;
      if (!ctx.runtime) return pending();
      return checkCall(ctx.runtime, fn, testsFor(check.tests, brief, levelId).filter(isCall));
    }
    case 'js-event': {
      if (!jsLink(files['index.html'] ?? '') && !/<script\b[^>]*>\s*\S/i.test(files['index.html'] ?? '')) {
        return fail('Load your script at the end of body: <script src="script.js"></script>');
      }
      const syntax = files['script.js'] === undefined ? pass() : checkJsSyntax(files['script.js']);
      if (!syntax.pass) return syntax;
      if (!ctx.runtime) return pending();
      const tests = testsFor(check.tests, brief, levelId).filter((t): t is EventTest => !isCall(t));
      return checkEvent(ctx.runtime, check, brief, tests);
    }
    case 'allPrevious': {
      for (let i = 0; i < ctx.levelIndex; i++) {
        const level = ctx.lesson.levels[i];
        const r = await runWebLevel(project, { ...ctx, levelIndex: i });
        const broken = r.goals.find((g) => !g.pass && !g.pending && !g.stretch);
        if (broken) return { ...broken, message: `Level ${level.id} (${level.title}) needs fixing: ${broken.message ?? broken.text}` };
      }
      return pass();
    }
    default:
      return runCheck(check, page, ctx.env, ctx.lesson, ctx.levelIndex);
  }
}

export interface WebGoalResult extends GoalResult {
  stretch?: boolean;
}
export interface WebLevelResult extends LevelResult {
  goals: WebGoalResult[];
}

/** Every goal on a level. Runtime checks only run once the static ones pass. */
export async function runWebLevel(project: Project, ctx: WebContext): Promise<WebLevelResult> {
  const level = ctx.lesson.levels[ctx.levelIndex];
  const goals: WebGoalResult[] = [];
  for (const goal of level.goals) {
    const text = fillBrief(goal.text, project.brief);
    let result: WebGoalResult = { pass: true, text, stretch: goal.stretch };
    for (const check of goal.checks) {
      if (RUNTIME_CHECKS.has(check.type) && !ctx.runtime) {
        // Static checks in this goal still get the chance to fail first.
        const r = await runWebCheck(check, project, ctx);
        if (!r.pass) {
          result = { ...r, text, stretch: goal.stretch };
          break;
        }
        continue;
      }
      const r = await runWebCheck(check, project, ctx);
      if (!r.pass) {
        result = { ...r, text, stretch: goal.stretch, message: r.message && fillBrief(r.message, project.brief) };
        break;
      }
    }
    goals.push(result);
  }
  const required = goals.filter((g) => !g.stretch);
  return {
    goals,
    pass: required.every((g) => g.pass),
    pending: goals.some((g) => g.pending),
  };
}

/** Mistakes to point out on any level, across all three files. */
export function projectMistakes(project: Project): Mistake[] {
  const { files, page, css } = project;
  const out = pageMistakes({ ...page, removedScripts: false }).map((m) => ({
    ...m,
    message: m.line ? `index.html ${m.message.charAt(0).toLowerCase()}${m.message.slice(1)}` : m.message,
  }));
  out.push(...cssMistakes(files['index.html'] ?? '', files['style.css'], css, page.doc));
  for (const issue of css.issues) out.push({ message: `style.css ${issue.message.charAt(0).toLowerCase()}${issue.message.slice(1)}`, line: issue.line });
  const js = files['script.js'];
  if (js !== undefined && js.trim()) {
    const p = parseJs(js);
    if (p.error) out.push({ message: `script.js ${p.error.message.charAt(0).toLowerCase()}${p.error.message.slice(1)}`, line: p.error.line });
    out.push(...jsMistakes(js, pageIds(page.doc)));
  }
  // A script in head runs before the form exists.
  const link = jsLink(files['index.html'] ?? '');
  if (link) {
    const before = (files['index.html'] ?? '').slice(0, link.index);
    if (/<head\b/i.test(before) && !/<\/head>/i.test(before)) {
      out.push({ message: `index.html line ${link.line}: your script runs before the page is built. Move <script> to the end of body.`, line: link.line });
    }
  }
  return out;
}
