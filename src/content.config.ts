import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { lessonSchema } from './lesson-schema';

const lessons = defineCollection({
  loader: glob({ pattern: '*/lesson.json', base: './src/content/lessons' }),
  schema: lessonSchema,
});

export const collections = { lessons };
