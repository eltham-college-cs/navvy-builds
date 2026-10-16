/** Hobby helpers shared by the checker and the UI. */

export const OTHER = 'other';

/** True when any text should count as "mentioning the hobby". */
export function isOpenHobby(hobby: string | undefined | null): boolean {
  return !hobby || hobby.trim() === '' || hobby.trim().toLowerCase() === OTHER;
}

/** The hobby as it reads in a sentence: "football", or "your hobby" for "other". */
export function hobbyLabel(hobby: string | undefined | null): string {
  return isOpenHobby(hobby) ? 'your hobby' : hobby!.trim();
}

/** Replace every {hobby} in a piece of lesson text. */
export function fillHobby(text: string, hobby: string | undefined | null): string {
  return text.replaceAll('{hobby}', hobbyLabel(hobby));
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Cut a word back to a stem so "swim", "swimmer" and "swimming" all match
 * "swimming". Stems are never shorter than three letters.
 */
export function stem(word: string): string {
  let w = word.toLowerCase();
  for (const suffix of ['ing', 'ers', 'er', 'es', 's', 'e']) {
    if (w.endsWith(suffix) && w.length - suffix.length >= 3) {
      w = w.slice(0, -suffix.length);
      break;
    }
  }
  // swimm -> swim, runn -> run
  if (w.length > 3 && w.at(-1) === w.at(-2) && !/[aeiou]/.test(w.at(-1)!)) w = w.slice(0, -1);
  return w;
}

/**
 * Case-insensitive word match. Every word of the hobby must appear at the
 * start of a word in the text ("football" matches "footballs"; "other" matches
 * any non-empty text).
 */
export function mentionsHobby(text: string, hobby: string | undefined | null): boolean {
  const t = text.trim();
  if (!t) return false;
  if (isOpenHobby(hobby)) return true;
  const words = hobby!.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return words.every((w) => new RegExp(`(^|[^\\p{L}\\p{N}])${escape(stem(w))}`, 'iu').test(t));
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}
