/**
 * The builder's side of the runner frame (SPEC-SIXTH-FORM § 5.2). Each load
 * makes a fresh iframe with sandbox="allow-scripts allow-forms" and never
 * allow-same-origin, so student code can't reach the site or its storage.
 */
import type { CallOutcome, Runtime, SubmitOutcome } from './webapp';

export interface RunnerEvent {
  type: 'alert' | 'console' | 'write' | 'error' | 'reload' | 'link' | 'ready';
  text?: string;
  level?: string;
  message?: string;
  line?: number;
  file?: string;
  loopLine?: number | null;
  href?: string;
  title?: string;
}

const REQUEST_TIMEOUT = 2000;
const LOAD_TIMEOUT = 4000;

export interface LoadResult {
  errors: RunnerEvent[];
  title: string;
}

export class RunnerFrame {
  private frame: HTMLIFrameElement | null = null;
  private pending = new Map<number, (data: Record<string, unknown>) => void>();
  private nextId = 1;
  private loadErrors: RunnerEvent[] = [];
  private onReady: ((title: string) => void) | null = null;
  /** Marks this runner's frames, as two runners can share a host. */
  private readonly key = `r${Math.random().toString(36).slice(2, 8)}`;

  constructor(
    private host: HTMLElement,
    private opts: { title: string; visible: boolean; onEvent?: (e: RunnerEvent) => void },
  ) {
    window.addEventListener('message', (e) => {
      if (!this.frame || e.source !== this.frame.contentWindow) return;
      const d = e.data as Record<string, unknown> & RunnerEvent & { nb?: number; id?: number };
      if (!d || d.nb !== 1) return;
      if ((d.type as string) === 'result') {
        this.pending.get(d.id!)?.(d);
        this.pending.delete(d.id!);
        return;
      }
      if (d.type === 'error') this.loadErrors.push(d);
      if (d.type === 'ready') this.onReady?.(d.title ?? '');
      this.opts.onEvent?.(d);
    });
  }

  get element(): HTMLIFrameElement | null {
    return this.frame;
  }

  /** Load a page in a new frame. Resolves when it has loaded (or timed out). */
  load(html: string): Promise<LoadResult> {
    for (const resolve of this.pending.values()) resolve({ timeout: true });
    this.pending.clear();
    this.loadErrors = [];
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts allow-forms');
    frame.dataset.runner = this.key;
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.title = this.opts.title;
    if (!this.opts.visible) {
      frame.setAttribute('aria-hidden', 'true');
      frame.tabIndex = -1;
    }
    const hadFrame = !!this.frame;
    this.frame = frame;
    // Load the new frame behind the shown one, then swap, so the preview doesn't flash.
    if (hadFrame && this.opts.visible) frame.style.visibility = 'hidden';
    this.host.append(frame);
    return new Promise((resolve) => {
      const done = (title: string) => {
        clearTimeout(timer);
        if (this.onReady === done) this.onReady = null;
        if (this.frame === frame) {
          // The newest frame: show it and drop every older one.
          frame.style.visibility = '';
          this.host.querySelectorAll(`iframe[data-runner="${this.key}"]`).forEach((f) => f !== frame && f.remove());
        } else {
          // A newer load started; this one is no longer needed.
          frame.remove();
        }
        resolve({ errors: [...this.loadErrors], title });
      };
      const timer = setTimeout(() => done(''), LOAD_TIMEOUT);
      this.onReady = done;
      frame.srcdoc = html;
    });
  }

  request<T = Record<string, unknown>>(op: string, data: Record<string, unknown> = {}): Promise<T & { timeout?: boolean }> {
    const win = this.frame?.contentWindow;
    if (!win) return Promise.resolve({ timeout: true } as T & { timeout: boolean });
    const id = this.nextId++;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ timeout: true } as T & { timeout: boolean });
      }, REQUEST_TIMEOUT);
      this.pending.set(id, (d) => {
        clearTimeout(timer);
        resolve(d as T & { timeout?: boolean });
      });
      win.postMessage({ nb: 2, id, op, ...data }, '*');
    });
  }
}

/** A Runtime for the checker, backed by a freshly loaded runner frame. */
export async function frameRuntime(runner: RunnerFrame, html: string): Promise<Runtime> {
  const loaded = await runner.load(html);
  const slow = 'Your code took too long to finish.';
  return {
    async call(fn, args) {
      const r = await runner.request<CallOutcome>('call', { fn, args });
      return r.timeout ? { error: slow } : r;
    },
    async submit(form, inputName, value, selector) {
      const r = await runner.request<SubmitOutcome>('submit', { form, inputName, value, selector });
      return r.timeout ? { errors: [slow] } : r;
    },
    async loadErrors() {
      return loaded.errors.map((e) => e.message ?? 'Error');
    },
  };
}
