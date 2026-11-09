/**
 * JavaScript checks on the code the student typed: syntax errors in plain
 * English, which constructs they used, and common A Level mistakes. Also adds
 * the loop guard that stops an infinite loop freezing the site.
 */
import { parse, type Node } from 'acorn';
import { full } from 'acorn-walk';
import type { JS_CONSTRUCTS } from '../lesson-schema';
import { fail, pass, type CheckResult, type Mistake } from './types';

export type Construct = (typeof JS_CONSTRUCTS)[number];

// acorn's node types are loose; these are the fields we read.
type AnyNode = Node & Record<string, any>;

export interface JsParse {
  ast?: AnyNode;
  error?: { message: string; line: number };
}

export function parseJs(code: string): JsParse {
  try {
    return { ast: parse(code, { ecmaVersion: 'latest', sourceType: 'script', locations: true }) as AnyNode };
  } catch (err) {
    const e = err as { message: string; loc?: { line: number }; pos?: number };
    return { error: friendlySyntax(code, e.message, e.loc?.line ?? 1) };
  }
}

const PAIRS: Record<string, string> = { '(': ')', '{': '}', '[': ']' };
const NAMES: Record<string, string> = { '(': 'bracket (', '{': 'curly bracket {', '[': 'square bracket [' };

/** Find the first bracket that is never closed, or closed by the wrong one. */
export function bracketProblem(code: string): { message: string; line: number } | undefined {
  const stack: { c: string; line: number }[] = [];
  let line = 1;
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === '\n') line++;
    else if (c === '/' && code[i + 1] === '/') {
      while (i < code.length && code[i] !== '\n') i++;
      i--;
    } else if (c === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2);
      const stop = end === -1 ? code.length : end + 2;
      line += code.slice(i, stop).split('\n').length - 1;
      i = stop - 1;
    } else if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < code.length && code[j] !== c && (c === '`' || code[j] !== '\n')) j += code[j] === '\\' ? 2 : 1;
      if (code[j] !== c) return { message: `Line ${line}: a string is missing its closing ${c}.`, line };
      if (c === '`') line += code.slice(i, j).split('\n').length - 1;
      i = j;
    } else if (PAIRS[c]) stack.push({ c, line });
    else if (c === ')' || c === '}' || c === ']') {
      const open = stack.pop();
      if (!open) return { message: `Line ${line}: there's an extra ${c} with nothing to close.`, line };
      if (PAIRS[open.c] !== c) {
        return {
          message: `Line ${line}: expected ${PAIRS[open.c]} to close the ${NAMES[open.c]} from line ${open.line}, but found ${c}.`,
          line,
        };
      }
    }
  }
  const open = stack.pop();
  if (open) return { message: `Line ${open.line}: this ${NAMES[open.c]} is never closed. Add ${PAIRS[open.c]}.`, line: open.line };
  return undefined;
}

function friendlySyntax(code: string, message: string, line: number): { message: string; line: number } {
  const brackets = bracketProblem(code);
  if (brackets) return brackets;
  const text = code.split('\n')[line - 1] ?? '';
  if (/Unterminated string/i.test(message)) return { message: `Line ${line}: a string is missing its closing quote.`, line };
  if (/Unexpected token/i.test(message) && /\b(if|while|for)\s*[^(\s]/.test(text)) {
    return { message: `Line ${line}: the condition after if, while or for goes in brackets, e.g. if (score > 0) {`, line };
  }
  if (/Unexpected keyword|reserved word/i.test(message)) {
    return { message: `Line ${line}: a keyword is in the wrong place. Check the line before for a missing ; or }.`, line };
  }
  if (/Identifier .* has already been declared/i.test(message)) {
    const name = /Identifier '([^']+)'/.exec(message)?.[1];
    return { message: `Line ${line}: ${name ?? 'a variable'} is declared twice. Drop let or const the second time.`, line };
  }
  if (/Assigning to rvalue|Invalid left-hand side/i.test(message)) {
    return { message: `Line ${line}: you can only assign to a variable. To compare, use == or ===.`, line };
  }
  return { message: `Line ${line}: JavaScript can't read this line. Check for a missing operator, comma or quote.`, line };
}

export function checkJsSyntax(code: string | undefined): CheckResult {
  if (code === undefined) return fail('Create script.js first.');
  if (!code.trim()) return fail('script.js is empty. Write your JavaScript in it.');
  const p = parseJs(code);
  return p.error ? fail(p.error.message, { line: p.error.line }) : pass();
}

/* ------------------------------------------------------------- the AST */

function walk(ast: AnyNode, visit: (n: AnyNode, parent?: AnyNode) => void) {
  full(ast, (n) => visit(n as AnyNode));
}

/** A top-level function (declaration, or a function stored in a variable). */
export function findFunction(ast: AnyNode, name: string): AnyNode | undefined {
  for (const s of ast.body as AnyNode[]) {
    if (s.type === 'FunctionDeclaration' && s.id?.name === name) return s;
    if (s.type === 'VariableDeclaration') {
      for (const d of s.declarations as AnyNode[]) {
        if (d.id?.name === name && /Function/.test(d.init?.type ?? '')) return d.init;
      }
    }
  }
  return undefined;
}

export function checkDefines(code: string | undefined, name: string, params?: number): CheckResult {
  if (code === undefined) return fail('Create script.js first.');
  const p = parseJs(code);
  if (!p.ast) return fail(`Fix the error in script.js first. ${p.error!.message}`, { line: p.error!.line });
  const fn = findFunction(p.ast, name);
  if (!fn) {
    // Wrong capitals is the commonest reason.
    let close: string | undefined;
    walk(p.ast, (n) => {
      if (n.type === 'FunctionDeclaration' && n.id?.name?.toLowerCase() === name.toLowerCase()) close = n.id.name;
    });
    if (close) return fail(`Your function is called ${close}. JavaScript is case-sensitive: call it ${name}.`);
    return fail(`Write a function called ${name} in script.js, e.g. function ${name}(…) { … }`);
  }
  if (params !== undefined && (fn.params as AnyNode[]).length !== params) {
    return fail(`${name} should take ${params} parameter${params === 1 ? '' : 's'}.`, { line: fn.loc?.start.line });
  }
  return pass();
}

const isCall = (n: AnyNode, name: string) =>
  n.type === 'CallExpression' &&
  ((n.callee.type === 'Identifier' && n.callee.name === name) ||
    (n.callee.type === 'MemberExpression' && !n.callee.computed && n.callee.property.name === name));
const isMember = (n: AnyNode, name: string) =>
  n.type === 'MemberExpression' && !n.computed && n.property?.name === name;

export function usesConstruct(ast: AnyNode, construct: Construct): boolean {
  let found = false;
  walk(ast, (n) => {
    if (found) return;
    switch (construct) {
      case 'for':
        found = n.type === 'ForStatement' || n.type === 'ForOfStatement' || n.type === 'ForInStatement';
        break;
      case 'while':
        found = n.type === 'WhileStatement';
        break;
      case 'doWhile':
        found = n.type === 'DoWhileStatement';
        break;
      case 'if':
        found = n.type === 'IfStatement';
        break;
      case 'elseIf':
        found = n.type === 'IfStatement' && n.alternate?.type === 'IfStatement';
        break;
      case 'switch':
        found = n.type === 'SwitchStatement';
        break;
      case 'array':
        found = n.type === 'ArrayExpression';
        break;
      case 'function':
        found = n.type === 'FunctionDeclaration';
        break;
      case 'getElementById':
        found = isCall(n, 'getElementById');
        break;
      case 'innerHTML':
        found = n.type === 'AssignmentExpression' && isMember(n.left, 'innerHTML');
        break;
      case 'alert':
        found = isCall(n, 'alert');
        break;
      case 'documentWrite':
        found = isCall(n, 'write') || isCall(n, 'writeln');
        break;
      case 'stringLength':
        found = isMember(n, 'length');
        break;
      case 'substring':
        found = isCall(n, 'substring') || isCall(n, 'substr') || isCall(n, 'slice') || isCall(n, 'charAt');
        break;
    }
  });
  return found;
}

const CONSTRUCT_HELP: Record<Construct, string> = {
  for: 'Use a for loop, e.g. for (let i = 0; i < 5; i++) { … }',
  while: 'Use a while loop, e.g. while (count < 5) { … }',
  doWhile: 'Use a do … while loop, e.g. do { … } while (answer == "");',
  if: 'Use an if statement, e.g. if (score > 0) { … }',
  elseIf: 'Use else if for the middle case, e.g. } else if (score == 1) {',
  switch: 'Use a switch statement, e.g. switch (unit) { case "km": … break; }',
  array: 'Store the values in an array, e.g. let items = ["a", "b", "c"];',
  function: 'Write a function, e.g. function name(param) { … }',
  getElementById: 'Get the element with document.getElementById("…")',
  innerHTML: 'Change what the element shows by setting its innerHTML, e.g. chosenElement.innerHTML = "…";',
  alert: 'Show a message box with alert("…");',
  documentWrite: 'Write to the page with document.write("…");',
  stringLength: 'Use .length to find how long the string is.',
  substring: 'Pick out part of the string with .substring(start, end)',
};

export function checkUses(code: string | undefined, construct: Construct): CheckResult {
  if (code === undefined) return fail('Create script.js first.');
  const p = parseJs(code);
  if (!p.ast) return fail(`Fix the error in script.js first. ${p.error!.message}`, { line: p.error!.line });
  return usesConstruct(p.ast, construct) ? pass() : fail(CONSTRUCT_HELP[construct]);
}

/* ------------------------------------------------------------ loop guard */

/**
 * Add __nbGuard(line) to every loop body, without adding any newlines, so an
 * infinite loop throws instead of freezing the browser. Code that doesn't
 * parse is returned unchanged: the browser reports the syntax error itself.
 */
export function guardLoops(code: string): string {
  const p = parseJs(code);
  if (!p.ast) return code;
  const inserts: { at: number; text: string }[] = [];
  walk(p.ast, (n) => {
    if (!/^(For|ForIn|ForOf|While|DoWhile)Statement$/.test(n.type)) return;
    const line = n.loc!.start.line;
    const body = n.body as AnyNode;
    const call = `__nbGuard(${line});`;
    if (body.type === 'BlockStatement') inserts.push({ at: body.start + 1, text: call });
    else {
      inserts.push({ at: body.start, text: `{${call}` });
      inserts.push({ at: body.end, text: '}' });
    }
  });
  inserts.sort((a, b) => b.at - a.at);
  let out = code;
  for (const i of inserts) out = out.slice(0, i.at) + i.text + out.slice(i.at);
  return out;
}

/* -------------------------------------------------------------- mistakes */

const lineOf = (s: string, i: number) => s.slice(0, i).split('\n').length;

/**
 * Mistakes worth pointing out in script.js whatever the level. `ids` is every
 * id in index.html, so getElementById("x") can be checked against the page.
 */
export function jsMistakes(code: string | undefined, ids: Set<string> | null): Mistake[] {
  if (!code) return [];
  const out: Mistake[] = [];
  const add = (message: string, index: number) => {
    const line = lineOf(code, index);
    out.push({ message: `script.js line ${line}: ${message}`, line });
  };
  for (const m of code.matchAll(/\.(getElementByID|getElementbyId|getElementbyID|GetElementById|getElementsById)\b/g)) {
    add(`JavaScript is case-sensitive: it's getElementById, not ${m[1]}.`, m.index!);
  }
  for (const m of code.matchAll(/\.(innerHtml|InnerHTML|innerhtml|innerHTMl)\b/g)) {
    add(`JavaScript is case-sensitive: it's innerHTML, not ${m[1]}.`, m.index!);
  }
  for (const m of code.matchAll(/getElementById\(\s*["']#([^"']*)["']\s*\)/g)) {
    add(`getElementById takes the id without the #: getElementById("${m[1]}").`, m.index!);
  }
  if (ids) {
    for (const m of code.matchAll(/getElementById\(\s*["']([^"'#]+)["']\s*\)/g)) {
      if (!ids.has(m[1])) add(`there's no element with id="${m[1]}" in index.html.`, m.index!);
    }
  }
  const p = parseJs(code);
  if (p.ast) {
    walk(p.ast, (n) => {
      if ((n.type === 'IfStatement' || n.type === 'WhileStatement') && n.test?.type === 'AssignmentExpression') {
        add('= stores a value. To compare in a condition, use == or ===.', n.test.start);
      }
    });
  }
  return out;
}

/** The ids in a parsed page, for jsMistakes. */
export function pageIds(doc: Document): Set<string> {
  return new Set(Array.from(doc.querySelectorAll('[id]'), (el) => el.id));
}
