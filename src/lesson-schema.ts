import { z } from 'zod';

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
]);

const goal = z.object({
  text: z.string(),
  checks: z.array(check).min(1),
  hints: z.array(z.string()).max(3).default([]),
});

const level = z.object({
  id: z.union([z.number().int(), z.literal('boss')]),
  title: z.string(),
  intro: z.string(),
  goals: z.array(goal).min(1),
});

export const lessonSchema = z.object({
  id: z.string(),
  title: z.string(),
  year: z.number().int(),
  minutes: z.number().int(),
  summary: z.string(),
  /** Optional per-year look; falls back to the default retro theme. */
  theme: z.string().optional(),
  hobbies: z.array(z.string()).min(1),
  starter: z.string(),
  levels: z.array(level).min(1),
});

export type Check = z.infer<typeof check>;
export type Goal = z.infer<typeof goal>;
export type Level = z.infer<typeof level>;
export type Lesson = z.infer<typeof lessonSchema>;
