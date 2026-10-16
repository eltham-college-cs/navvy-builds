import { getCollection } from 'astro:content';
import type { Lesson } from '../lesson-schema';

/** Every lesson, in folder order (01-…, 02-…). */
export async function allLessons(): Promise<Lesson[]> {
  const entries = await getCollection('lessons');
  return entries.sort((a, b) => a.id.localeCompare(b.id)).map((e) => e.data as Lesson);
}
