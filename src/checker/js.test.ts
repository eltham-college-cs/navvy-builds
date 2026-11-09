import { describe, expect, it } from 'vitest';
import { bracketProblem, checkDefines, checkJsSyntax, checkUses, guardLoops, jsMistakes, parseJs, usesConstruct } from './js';

describe('syntax', () => {
  it('passes valid code', () => {
    expect(checkJsSyntax('let a = 1;\nfunction f(x) { return x * 2; }').pass).toBe(true);
  });
  it('says when script.js is missing or empty', () => {
    expect(checkJsSyntax(undefined).message).toMatch(/Create script.js/);
    expect(checkJsSyntax('  \n').message).toMatch(/empty/);
  });
  it('names an unclosed curly bracket and its line', () => {
    const r = checkJsSyntax('function f() {\n  return 1;\n');
    expect(r.pass).toBe(false);
    expect(r.line).toBe(1);
    expect(r.message).toMatch(/curly bracket \{ is never closed/);
  });
  it('names a wrong closing bracket', () => {
    expect(bracketProblem('if (a > 1} {\n}')?.message).toMatch(/expected \) to close the bracket \( from line 1, but found \}/);
  });
  it('spots an unclosed string', () => {
    expect(checkJsSyntax('let a = "hello;\n').message).toMatch(/missing its closing "/);
  });
  it('explains a condition without brackets', () => {
    expect(checkJsSyntax('if score > 1 {\n}').message).toMatch(/goes in brackets/);
  });
  it('ignores brackets in comments and strings', () => {
    expect(bracketProblem('// (\nlet s = "{[";\n/* } */')).toBeUndefined();
  });
});

describe('functions and constructs', () => {
  it('finds a function declaration or a function in a variable', () => {
    expect(checkDefines('function checkPassword(p) { return 0; }', 'checkPassword').pass).toBe(true);
    expect(checkDefines('const checkPassword = (p) => 0;', 'checkPassword').pass).toBe(true);
  });
  it('points out wrong capitals', () => {
    expect(checkDefines('function checkpassword(p) {}', 'checkPassword').message).toMatch(/called checkpassword.*case-sensitive/);
  });
  it('checks the number of parameters', () => {
    expect(checkDefines('function f(a, b) {}', 'f', 1).message).toMatch(/1 parameter/);
  });
  it('finds each construct', () => {
    const ast = parseJs(`
      let a = [1, 2];
      for (let i = 0; i < a.length; i++) {}
      while (false) {}
      do {} while (false);
      if (a) {} else if (b) {}
      switch (x) { case 1: break; }
      document.getElementById("r").innerHTML = "x";
      alert("hi");
      document.write("x");
      "abc".substring(0, 1);
    `).ast!;
    for (const c of ['for', 'while', 'doWhile', 'if', 'elseIf', 'switch', 'array', 'getElementById', 'innerHTML', 'alert', 'documentWrite', 'stringLength', 'substring'] as const) {
      expect(usesConstruct(ast, c), c).toBe(true);
    }
    expect(usesConstruct(parseJs('let x = 1;').ast!, 'for')).toBe(false);
  });
  it('explains a missing construct', () => {
    expect(checkUses('let x = 1;', 'switch').message).toMatch(/switch statement/);
  });
});

describe('loop guard', () => {
  it('adds a guard to every loop without changing line numbers', () => {
    const code = 'for (let i = 0; i < 3; i++) {\n  x++;\n}\nwhile (true) x++;\ndo {\n} while (y);';
    const out = guardLoops(code);
    expect(out.split('\n').length).toBe(code.split('\n').length);
    expect(out).toContain('{__nbGuard(1);');
    expect(out).toContain('{__nbGuard(4);x++;}');
    expect(out).toContain('{__nbGuard(5);');
  });
  it('stops an infinite loop', () => {
    let n = 0;
    const guard = (line: number) => {
      if (++n > 1000) throw new Error(`__NB_LOOP__${line}`);
    };
    const run = new Function('__nbGuard', guardLoops('let i = 0;\nwhile (i < 10) {\n  i = i - 1;\n}'));
    expect(() => run(guard)).toThrow('__NB_LOOP__2');
  });
  it('leaves code that does not parse alone', () => {
    expect(guardLoops('while (true {')).toBe('while (true {');
  });
});

describe('mistakes', () => {
  const ids = new Set(['result', 'app']);
  const messages = (code: string) => jsMistakes(code, ids).map((m) => m.message);
  it('spots wrong capitals in DOM names', () => {
    expect(messages('document.getElementByID("result");')[0]).toMatch(/getElementById, not getElementByID/);
    expect(messages('el.innerHtml = 1;')[0]).toMatch(/innerHTML, not innerHtml/);
  });
  it('spots a # in getElementById', () => {
    expect(messages('document.getElementById("#result");')[0]).toMatch(/without the #/);
  });
  it('spots an id that is not in the page', () => {
    expect(messages('document.getElementById("output");')[0]).toMatch(/no element with id="output"/);
  });
  it('spots = in a condition', () => {
    expect(messages('if (a = 1) {}')[0]).toMatch(/use == or ===/);
  });
  it('gives line numbers', () => {
    expect(jsMistakes('let a;\n\ndocument.getElementByID("result");', ids)[0].line).toBe(3);
  });
});
