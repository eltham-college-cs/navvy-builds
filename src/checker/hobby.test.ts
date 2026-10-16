import { describe, expect, it } from 'vitest';
import { fillHobby, hobbyLabel, mentionsHobby, wordCount } from './hobby';

describe('hobby', () => {
  it('fills {hobby}', () => {
    expect(fillHobby('My love of {hobby}', 'music')).toBe('My love of music');
    expect(fillHobby('My love of {hobby}', 'other')).toBe('My love of your hobby');
    expect(hobbyLabel('')).toBe('your hobby');
  });
  it('matches whole words and simple forms', () => {
    expect(mentionsHobby('Cooking with Gran', 'cooking')).toBe(true);
    expect(mentionsHobby('I like to cook', 'cooking')).toBe(true);
    expect(mentionsHobby('My pet animal', 'animals')).toBe(true);
    expect(mentionsHobby('Dancing queen', 'dance')).toBe(true);
    expect(mentionsHobby('Gaming', 'gaming')).toBe(true);
    expect(mentionsHobby('My page', 'music')).toBe(false);
    expect(mentionsHobby('Sweeping', 'swimming')).toBe(false);
  });
  it('needs every word of a typed hobby', () => {
    expect(mentionsHobby('Rock climbing rocks', 'rock climbing')).toBe(true);
    expect(mentionsHobby('Climbing', 'rock climbing')).toBe(false);
  });
  it('counts words', () => {
    expect(wordCount('  one two   three - ')).toBe(3);
  });
});
