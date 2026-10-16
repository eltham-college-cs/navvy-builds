/** Runs a level's checks against the student's page and returns the results. */
import type { Check, Lesson } from '../lesson-schema';
import { checkAttr, checkCount, checkExists, checkHeadingOrder, checkText, parsePage } from './dom';
import { fillHobby } from './hobby';
import { sanitize } from './sanitize';
import {
  checkBalanced,
  checkCssSyntax,
  checkDoctype,
  checkInside,
  parseAllCss,
  scan,
  sourceMistakes,
  type CssParse,
  type Scan,
} from './source';
import { checkStyle, type StyleEnv } from './style';
import type { CheckResult, Mistake } from './types';

export type { CheckResult, Mistake } from './types';
export type { StyleEnv } from './style';

export interface Page {
  source: string;
  hobby: string;
  scan: Scan;
  css: CssParse;
  doc: Document;
  /** The HTML that goes into the preview: scripts and on* attributes removed. */
  safeHtml: string;
  removedScripts: boolean;
}

export function preparePage(source: string, hobby: string): Page {
  const s = scan(source);
  const { html, removedScripts } = sanitize(source);
  return { source, hobby, scan: s, css: parseAllCss(s), doc: parsePage(html), safeHtml: html, removedScripts };
}

export interface GoalResult extends CheckResult {
  text: string;
}

export interface LevelResult {
  goals: GoalResult[];
  pass: boolean;
  pending: boolean;
}

export function runCheck(check: Check, page: Page, env?: StyleEnv, lesson?: Lesson, levelIndex = 0): CheckResult {
  switch (check.type) {
    case 'source-doctype':
      return checkDoctype(page.scan);
    case 'source-balanced':
      return checkBalanced(page.scan, check.tags);
    case 'source-inside':
      return checkInside(page.scan, check.tag, check.parent);
    case 'exists':
      return checkExists(page.doc, check.selector);
    case 'count':
      return checkCount(page.doc, check.selector, check.min, check.max);
    case 'text':
      return checkText(page.doc, check.selector, check, page.hobby);
    case 'attr':
      return checkAttr(page.doc, check.selector, check.attr, check);
    case 'headingOrder':
      return checkHeadingOrder(page.doc);
    case 'style':
      return checkStyle(env, check.selector, check.property, check, page.css);
    case 'css-syntax':
      return checkCssSyntax(page.scan, page.css);
    case 'allPrevious': {
      if (!lesson) return { pass: true };
      for (let i = 0; i < levelIndex; i++) {
        const level = lesson.levels[i];
        const result = runLevel(lesson, i, page, env);
        const broken = result.goals.find((g) => !g.pass);
        if (broken) {
          return {
            ...broken,
            message: `Level ${level.id} (${level.title}) needs fixing: ${broken.message ?? broken.text}`,
          };
        }
      }
      return { pass: true };
    }
  }
}

export function runLevel(lesson: Lesson, levelIndex: number, page: Page, env?: StyleEnv): LevelResult {
  const level = lesson.levels[levelIndex];
  const goals = level.goals.map((goal): GoalResult => {
    const text = fillHobby(goal.text, page.hobby);
    for (const check of goal.checks) {
      const r = runCheck(check, page, env, lesson, levelIndex);
      if (!r.pass) return { ...r, text, message: r.message && fillHobby(r.message, page.hobby) };
    }
    return { pass: true, text };
  });
  return {
    goals,
    pass: goals.every((g) => g.pass),
    pending: goals.some((g) => g.pending),
  };
}

/** Mistakes to point out on any level: misplaced tags, CSS typos, scripts. */
export function pageMistakes(page: Page): Mistake[] {
  const out = sourceMistakes(page.scan);
  for (const issue of page.css.issues) out.push({ message: issue.message, line: issue.line });
  if (page.removedScripts) {
    out.push({ message: "Scripts don't run here, so they've been left out of the preview. This lesson is all about HTML and CSS." });
  }
  return out;
}
