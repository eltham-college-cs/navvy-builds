import { z } from 'zod';

/** The files a Sixth Form project can have. */
export const FILE_NAMES = ['index.html', 'style.css', 'script.js'] as const;
const fileName = z.enum(FILE_NAMES);
export type FileName = z.infer<typeof fileName>;

/** Language constructs a js-uses check can look for (SPEC-SIXTH-FORM § 11). */
export const JS_CONSTRUCTS = [
  'for',
  'while',
  'doWhile',
  'if',
  'elseIf',
  'switch',
  'array',
  'function',
  'getElementById',
  'innerHTML',
  'alert',
  'documentWrite',
  'stringLength',
  'substring',
] as const;

/** A test for a function call or a form submission. */
const callTest = z.object({ args: z.array(z.unknown()), returns: z.unknown() });
const eventTest = z.object({ input: z.string(), expect: z.string() });
const tests = z.union([z.literal('brief'), z.array(z.union([callTest, eventTest]))]);

const check = z.discriminatedUnion('type', [
  z.object({ type: z.literal('source-doctype') }),
  z.object({ type: z.literal('source-balanced'), tags: z.array(z.string()).min(1) }),
  z.object({ type: z.literal('source-inside'), tag: z.string(), parent: z.string() }),
  z.object({ type: z.literal('exists'), selector: z.string() }),
  z.object({
    type: z.literal('count'),
    selector: z.string(),
    min: z.number().int().optional(),
    max: z.number().int().optional(),
  }),
  z.object({
    type: z.literal('text'),
    selector: z.string(),
    notEmpty: z.boolean().optional(),
    containsHobby: z.boolean().optional(),
    minWords: z.number().int().optional(),
  }),
  z.object({
    type: z.literal('attr'),
    selector: z.string(),
    attr: z.string(),
    notEmpty: z.boolean().optional(),
    startsWith: z.string().optional(),
    notOneOf: z.array(z.string()).optional(),
  }),
  z.object({ type: z.literal('headingOrder') }),
  z.object({
    type: z.literal('style'),
    selector: z.string(),
    property: z.string(),
    notDefault: z.boolean().optional(),
    equals: z.string().optional(),
  }),
  z.object({ type: z.literal('css-syntax') }),
  z.object({ type: z.literal('allPrevious') }),

  /* Sixth Form checks */
  z.object({ type: z.literal('file-exists'), file: fileName }),
  z.object({ type: z.literal('links-file'), file: z.enum(['style.css', 'script.js']) }),
  z.object({ type: z.literal('css-file-syntax') }),
  z.object({
    type: z.literal('css-rule'),
    selector: z.string(),
    property: z.string().optional(),
    /** Accept a value written as a hex colour only. */
    hex: z.boolean().optional(),
  }),
  z.object({ type: z.literal('css-kind'), kind: z.enum(['element', 'class', 'id']) }),
  z.object({ type: z.literal('inline-style'), selector: z.string().optional(), property: z.string().optional() }),
  z.object({ type: z.literal('js-syntax') }),
  z.object({ type: z.literal('js-defines'), name: z.string(), params: z.number().int().optional() }),
  z.object({ type: z.literal('js-uses'), construct: z.enum(JS_CONSTRUCTS) }),
  z.object({ type: z.literal('js-no-error') }),
  z.object({ type: z.literal('js-call'), fn: z.string(), tests }),
  z.object({
    type: z.literal('js-event'),
    form: z.string(),
    tests,
    expect: z.enum(['innerHTML', 'alert', 'write']),
    selector: z.string().optional(),
  }),
]);

const goal = z.object({
  text: z.string(),
  /** A short spec reference shown under the goal. */
  spec: z.string().optional(),
  /** Stretch goals aren't needed to clear the level. */
  stretch: z.boolean().optional(),
  checks: z.array(check).min(1),
  hints: z.array(z.string()).max(3).default([]),
});

const challengeFiles = z.record(fileName, z.string());

const challenge = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('trace'),
    id: z.string(),
    title: z.string(),
    spec: z.string().optional(),
    prompt: z.string().default('What does the page show?'),
    /** What to compare the answer with: text written or alerted, or an element's text. */
    output: z.enum(['page', 'alert', 'console']).default('page'),
    files: challengeFiles,
  }),
  z.object({
    type: z.literal('fix'),
    id: z.string(),
    title: z.string(),
    spec: z.string().optional(),
    prompt: z.string(),
    /** The file the student edits; the others are shown read-only. */
    edit: fileName,
    files: challengeFiles,
    checks: z.array(check).min(1),
    hints: z.array(z.string()).max(3).default([]),
  }),
  z.object({
    type: z.literal('exam'),
    id: z.string(),
    title: z.string(),
    spec: z.string().optional(),
    question: z.string(),
    /** Code shown with the question. */
    code: z.string().optional(),
    marks: z.number().int().min(1),
    markScheme: z.array(z.string()).min(1),
  }),
]);

const given = z.object({ file: fileName, code: z.string() });

const level = z.object({
  id: z.union([z.number().int(), z.literal('boss')]),
  title: z.string(),
  intro: z.string(),
  goals: z.array(goal).default([]),
  /** Files created when the level starts, if the student doesn't have them yet. */
  addFiles: z.record(fileName, z.string()).optional(),
  /** Code appended once, when the level starts. Lines end in // given. */
  given: z.array(given).optional(),
  challenges: z.array(challenge).optional(),
});

const brief = z.object({
  id: z.string(),
  name: z.string(),
  pitch: z.string(),
  /** A word the page title and h1 must contain. */
  keyword: z.string(),
  fn: z.string(),
  inputName: z.string(),
  /** Example input for hints and the starter. */
  example: z.string(),
  /** Brief-specific instructions per level id, shown where an intro says {note}. */
  notes: z.record(z.string(), z.string()).optional(),
  /** Tests per level id. */
  tests: z.record(z.string(), z.array(z.union([callTest, eventTest]))),
});

export const lessonSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    year: z.number().int(),
    minutes: z.number().int(),
    summary: z.string(),
    /** Optional per-year look; falls back to the default retro theme. */
    theme: z.string().optional(),
    hobbies: z.array(z.string()).min(1).optional(),
    briefs: z.array(brief).min(1).optional(),
    files: z.array(fileName).default(['index.html']),
    starter: z.string(),
    levels: z.array(level).min(1),
  })
  .refine((l) => !!l.hobbies !== !!l.briefs, { message: 'A lesson has either hobbies or briefs, not both.' });

export type Check = z.infer<typeof check>;
export type Goal = z.infer<typeof goal>;
export type Level = z.infer<typeof level>;
export type Challenge = z.infer<typeof challenge>;
export type Brief = z.infer<typeof brief>;
export type CallTest = z.infer<typeof callTest>;
export type EventTest = z.infer<typeof eventTest>;
export type Lesson = z.infer<typeof lessonSchema>;
