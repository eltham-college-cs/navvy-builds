/** An element to outline in the preview: the nth match of a selector. */
export interface Highlight {
  selector: string;
  index?: number;
}

export interface CheckResult {
  pass: boolean;
  /** Names the problem and the fix. Only set when the check fails. */
  message?: string;
  line?: number;
  highlight?: Highlight;
  /** The check needs the live preview (style checks) and it isn't ready yet. */
  pending?: boolean;
}

export interface Mistake {
  message: string;
  line?: number;
}

export const pass = (): CheckResult => ({ pass: true });
export const fail = (message: string, extra: Partial<CheckResult> = {}): CheckResult => ({
  pass: false,
  message,
  ...extra,
});
