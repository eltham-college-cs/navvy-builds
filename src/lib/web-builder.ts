/**
 * The Sixth Form builder screen (SPEC-SIXTH-FORM § 5): three files in tabs, a
 * preview that runs the student's JavaScript, goals that tick as they type,
 * and Fix, Trace and Exam challenges on code they didn't write.
 */
import { celebrate } from '../components/Celebrate';
import { cleanForDownload, createCodeEditor, type CodeEditor, type Language } from '../components/CodeEditor';
import { runnerPage, staticPage, type Files } from '../checker/files';
import { RunnerFrame, frameRuntime, type RunnerEvent } from '../checker/runner';
import { previewHtml, unstyledHtml } from '../checker/sanitize';
import { documentStyleEnv, type StyleEnv } from '../checker/style';
import type { Highlight } from '../checker/types';
import {
  fillBrief,
  friendlyRuntime,
  prepareProject,
  projectMistakes,
  runWebCheck,
  runWebLevel,
  type Project,
  type WebLevelResult,
} from '../checker/webapp';
import { config } from '../config';
import { FILE_NAMES, type Brief, type Challenge, type FileName, type Lesson } from '../lesson-schema';
import { applyLevelMap, guardLockedLinks } from './level-map';
import { mascotSvg, type Mood } from './mascot';
import {
  currentIndex,
  isUnlocked,
  levelHash,
  loadProgress,
  parseLevelHash,
  saveProgress,
  type LevelId,
} from './progress';
import { makeZip } from './zip';

export interface WebBuilderData {
  lesson: Lesson;
  siteUrl: string;
  libraryUrl: string;
  lessonUrl: string;
  mascotName: string;
}

interface ChallengeState {
  done: boolean;
  /** Trace: right first time. Fix: fixed. */
  correct?: boolean;
  answer?: string;
  code?: string;
  marks?: number;
  ticked?: number[];
}

interface Extra {
  /** Levels whose addFiles and given code have been applied. */
  applied: string[];
  challenges: Record<string, ChallengeState>;
}

const RENDER_DELAY = 600;
const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
const LANG: Record<FileName, Language> = { 'index.html': 'html', 'style.css': 'css', 'script.js': 'js' };
const LANG_NAME: Record<FileName, string> = { 'index.html': 'HTML', 'style.css': 'CSS', 'script.js': 'JavaScript' };
const DOT: Record<FileName, string> = { 'index.html': '#F7A35C', 'style.css': '#7CC4F2', 'script.js': '#F2B533' };

/** Wrap code-looking parts of a goal or hint in <code>. */
function richText(el: HTMLElement, text: string) {
  el.textContent = '';
  const re =
    /(<\/?[a-zA-Z!][^>]*>(?:[^<]*<\/[a-z0-9]+>)?|[#.]?[a-zA-Z0-9-]+ \{[^}]*\}|[a-z-]+: [^;]+;|\b(?:document|chosenElement|form)\.[\w.]+(?:\([^)]*\))?|\b[a-zA-Z_]\w*\([^()]*\)|(?:index\.html|style\.css|script\.js)|#[a-zA-Z][\w-]*|\.[a-z][\w-]*(?=[\s,]|$)|https?:\/\/\S*)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) el.append(text.slice(last, m.index));
    const code = document.createElement('code');
    code.textContent = m[0];
    el.append(code);
    last = m.index! + m[0].length;
  }
  if (last < text.length) el.append(text.slice(last));
}

function loadFrame(frame: HTMLIFrameElement, html: string): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      frame.removeEventListener('load', done);
      resolve();
    };
    frame.addEventListener('load', done);
    frame.srcdoc = html;
  });
}

const extraKey = (lessonId: string) => `${config.storageKey}:${lessonId}:extra`;
function loadExtra(lessonId: string): Extra {
  try {
    const d = JSON.parse(localStorage.getItem(extraKey(lessonId)) ?? 'null');
    if (d && Array.isArray(d.applied) && typeof d.challenges === 'object') return d;
  } catch {
    /* fall through */
  }
  return { applied: [], challenges: {} };
}
function saveExtra(lessonId: string, extra: Extra) {
  try {
    localStorage.setItem(extraKey(lessonId), JSON.stringify(extra));
  } catch {
    /* the page still works, it just won't remember */
  }
}

/** Compare outputs ignoring case and spacing. */
const norm = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

export function startWebBuilder(data: WebBuilderData): void {
  const { lesson } = data;
  const ids = lesson.levels.map((l) => l.id) as LevelId[];
  const progress = loadProgress(lesson.id);
  const brief: Brief | undefined = lesson.briefs?.find((b) => b.id === progress.hobby);
  if (!brief) {
    location.replace(`${data.lessonUrl}?need=hobby`);
    return;
  }
  const extra = loadExtra(lesson.id);

  /* ------------------------------------------------------------ level */
  const levelFromHash = (): number | null => {
    const id = parseLevelHash(location.hash === '#boss' ? '#level-boss' : location.hash);
    if (id === null) return null;
    const i = ids.indexOf(id);
    return i === -1 ? null : i;
  };
  const openOrRedirect = (i: number | null): number | null => {
    if (i === null) {
      const c = currentIndex(ids, progress.completed);
      history.replaceState(null, '', levelHash(ids[c]));
      return c;
    }
    if (!isUnlocked(ids, progress.completed, i)) {
      location.replace(`${data.lessonUrl}?locked=${ids[i]}#map`);
      return null;
    }
    return i;
  };
  const first = openOrRedirect(levelFromHash());
  if (first === null) return;
  let levelIndex = first;

  /* ------------------------------------------------------------ files */
  const starter = fillBrief(lesson.starter, brief);
  let files: Files = { 'index.html': starter };
  if (progress.code) {
    try {
      const saved = JSON.parse(progress.code);
      if (saved && typeof saved['index.html'] === 'string') files = saved;
    } catch {
      /* keep the starter */
    }
  }
  const save = () => {
    progress.code = JSON.stringify(files);
    saveProgress(lesson.id, progress);
    saveExtra(lesson.id, extra);
  };

  /** Create files and add given code for every level up to this one, once. */
  function applyLevelSetup(upTo: number): FileName[] {
    const added: FileName[] = [];
    for (let i = 0; i <= upTo; i++) {
      const level = lesson.levels[i];
      const key = String(level.id);
      if (extra.applied.includes(key)) continue;
      for (const [name, content] of Object.entries(level.addFiles ?? {}) as [FileName, string][]) {
        if (files[name] === undefined) {
          files[name] = fillBrief(content, brief!);
          added.push(name);
        }
      }
      for (const g of level.given ?? []) {
        const code = fillBrief(g.code, brief!);
        const firstLine = code.split('\n')[0].trim();
        const current = files[g.file] ?? '';
        if (firstLine && current.includes(firstLine)) continue;
        files[g.file] = current + (current && !current.endsWith('\n') ? '\n' : '') + code;
        if (!added.includes(g.file)) added.push(g.file);
      }
      extra.applied.push(key);
    }
    if (added.length) save();
    return added;
  }

  /* --------------------------------------------------------- elements */
  const tabsEl = $('[data-tabs]');
  const editorsEl = $('[data-editors]');
  const fileLabel = $('[data-file-label]');
  const goalsList = $('[data-goals]');
  const goalTemplate = $<HTMLTemplateElement>('#goal-template');
  const goalSummary = $('[data-goal-summary]');
  const message = $('[data-message]');
  const bubble = message.parentElement!;
  const gotoBtn = $<HTMLButtonElement>('[data-goto]');
  const mistakesList = $('[data-mistakes]');
  const mascot = $('#mascot');
  const checkBtn = $<HTMLButtonElement>('[data-check]');
  const nextBtn = $<HTMLAnchorElement>('[data-next]');
  const tabTitle = $('[data-tab-title]');
  const tabAnnounce = $('[data-tab-announce]');
  const linkNote = $('[data-link-note]');
  const alertBox = $('[data-alert]');
  const alertText = $('[data-alert-text]');
  const consoleLines = $('[data-console-lines]');
  const consoleCount = $('[data-console-count]');
  const staticFrame = $<HTMLIFrameElement>('[data-static]');
  const twinFrame = $<HTMLIFrameElement>('[data-twin]');
  const challengesWrap = $('[data-challenges-wrap]');
  const challengesEl = $('[data-challenges]');
  const challengeCount = $('[data-challenge-count]');

  /* ---------------------------------------------------------- editors */
  const editors = new Map<FileName, { el: HTMLElement; editor: CodeEditor }>();
  let active: FileName = 'index.html';
  const newFiles = new Set<FileName>();

  function ensureEditor(name: FileName) {
    if (editors.has(name)) return;
    const el = document.createElement('div');
    el.id = `panel-${name.replace('.', '-')}`;
    el.setAttribute('role', 'tabpanel');
    el.setAttribute('aria-labelledby', `tab-${name.replace('.', '-')}`);
    el.hidden = true;
    editorsEl.append(el);
    const editor = createCodeEditor({
      parent: el,
      doc: files[name] ?? '',
      language: LANG[name],
      label: `${name}: ${LANG_NAME[name]} editor`,
      onChange: (c) => {
        files[name] = c;
        save();
        scheduleRender();
      },
      onEscape: () => checkBtn.focus(),
    });
    editors.set(name, { el, editor });
  }

  function buildTabs() {
    const present = FILE_NAMES.filter((n) => files[n] !== undefined);
    tabsEl.replaceChildren(
      ...present.map((name) => {
        ensureEditor(name);
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('role', 'tab');
        b.id = `tab-${name.replace('.', '-')}`;
        b.setAttribute('aria-controls', `panel-${name.replace('.', '-')}`);
        b.innerHTML = `<span class="dot" style="background:${DOT[name]}"></span>`;
        b.append(name);
        b.classList.toggle('new', newFiles.has(name));
        b.addEventListener('click', () => showFile(name));
        b.addEventListener('keydown', (e) => {
          const i = present.indexOf(name);
          const to = e.key === 'ArrowRight' ? present[(i + 1) % present.length] : e.key === 'ArrowLeft' ? present[(i - 1 + present.length) % present.length] : null;
          if (to) {
            e.preventDefault();
            showFile(to);
            document.getElementById(`tab-${to.replace('.', '-')}`)?.focus();
          }
        });
        return b;
      }),
    );
    if (!present.includes(active)) active = 'index.html';
    showFile(active, false);
  }

  function showFile(name: FileName, focus = false) {
    active = name;
    newFiles.delete(name);
    for (const [n, { el }] of editors) el.hidden = n !== name;
    tabsEl.querySelectorAll<HTMLButtonElement>('[role=tab]').forEach((b) => {
      const on = b.id === `tab-${name.replace('.', '-')}`;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on) b.classList.remove('new');
    });
    fileLabel.textContent = `${name} · ${LANG_NAME[name]}`;
    if (focus) editors.get(name)?.editor.focus();
  }

  function goTo(file: FileName, line?: number) {
    if (files[file] === undefined) return;
    showFile(file);
    if (line) editors.get(file)!.editor.goToLine(line);
    else editors.get(file)!.editor.focus();
  }

  /* ------------------------------------------------------------ mascot */
  function setMood(mood: Mood, react = false) {
    mascot.innerHTML = mascotSvg(mood, `${data.mascotName} the snake`);
    mascot.className = `mascot mood-${mood}`;
    if (react) {
      void mascot.offsetWidth;
      mascot.classList.add('react');
    }
  }

  let gotoTarget: { file: FileName; line: number } | undefined;
  function say(text: string, opts: { good?: boolean; goto?: { file: FileName; line: number }; mistakes?: string[] } = {}) {
    message.textContent = text;
    bubble.classList.toggle('good', !!opts.good);
    gotoTarget = opts.goto;
    gotoBtn.hidden = !opts.goto;
    if (opts.goto) gotoBtn.textContent = `Go to ${opts.goto.file} line ${opts.goto.line}`;
    const mistakes = (opts.mistakes ?? []).filter((m) => !text.includes(m)).slice(0, 4);
    mistakesList.hidden = mistakes.length === 0;
    mistakesList.replaceChildren(
      ...mistakes.map((m) => {
        const li = document.createElement('li');
        li.textContent = m;
        return li;
      }),
    );
  }
  gotoBtn.addEventListener('click', () => gotoTarget && goTo(gotoTarget.file, gotoTarget.line));

  /** Which file a failing goal is about, from its message. */
  function fileOf(msg: string | undefined): FileName {
    if (!msg) return active;
    if (/script\.js|function|getElementById|innerHTML|alert|return|loop/i.test(msg)) return files['script.js'] !== undefined ? 'script.js' : 'index.html';
    if (/style\.css|selector|rule|\{/.test(msg) && files['style.css'] !== undefined) return 'style.css';
    return 'index.html';
  }

  /* ----------------------------------------------------------- console */
  let consoleN = 0;
  function consoleLine(kind: string, text: string, link?: { file: FileName; line: number }) {
    consoleLines.querySelector('.empty')?.remove();
    const li = document.createElement('li');
    li.className = kind;
    const k = document.createElement('span');
    k.className = 'k';
    k.textContent = kind === 'write' ? 'write' : kind;
    const msg = document.createElement('span');
    msg.className = 'msg';
    msg.textContent = text;
    li.append(k, msg);
    if (link) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `${link.file}:${link.line}`;
      b.addEventListener('click', () => goTo(link.file, link.line));
      li.append(b);
    }
    consoleLines.append(li);
    consoleN++;
    consoleCount.textContent = `(${consoleN})`;
    li.scrollIntoView({ block: 'nearest' });
  }
  function clearConsole() {
    consoleN = 0;
    consoleCount.textContent = '';
    consoleLines.innerHTML = '<li class="empty">Nothing yet. console.log, document.write, alert and errors show here.</li>';
  }
  $('[data-console-clear]').addEventListener('click', (e) => {
    e.preventDefault();
    clearConsole();
  });

  /* ------------------------------------------------------------ alert */
  let alertQueue: string[] = [];
  function showAlert(text: string) {
    alertQueue.push(text);
    if (!alertBox.hidden) return;
    nextAlert();
  }
  function nextAlert() {
    const t = alertQueue.shift();
    if (t === undefined) {
      alertBox.hidden = true;
      return;
    }
    alertText.textContent = t;
    alertBox.hidden = false;
    $<HTMLButtonElement>('[data-alert-ok]').focus();
  }
  $('[data-alert-ok]').addEventListener('click', nextAlert);
  alertBox.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Enter') {
      e.preventDefault();
      nextAlert();
    }
  });

  /* ------------------------------------------------------------ frames */
  let scriptStart: number | undefined;
  function mapLine(e: RunnerEvent): { file: FileName; line: number } | undefined {
    if (!e.line) return undefined;
    if (/script\.js$/.test(e.file ?? '')) return { file: 'script.js', line: e.line };
    if (scriptStart !== undefined && e.line >= scriptStart) {
      const line = e.line - scriptStart + 1;
      if (line <= (files['script.js'] ?? '').split('\n').length) return { file: 'script.js', line };
    }
    return { file: 'index.html', line: e.line };
  }

  const preview = new RunnerFrame($('[data-runner-host]'), {
    title: 'Your app, running',
    visible: true,
    onEvent: (e) => {
      if (e.type === 'alert') {
        consoleLine('alert', e.text ?? '');
        showAlert(e.text ?? '');
      } else if (e.type === 'console') consoleLine('log', e.text ?? '');
      else if (e.type === 'write') consoleLine('write', e.text ?? '');
      else if (e.type === 'error') {
        const at = e.loopLine ? { file: 'script.js' as FileName, line: e.loopLine } : mapLine(e);
        consoleLine('error', friendlyRuntime(e.message ?? 'Error'), at);
      } else if (e.type === 'reload') {
        consoleLine('error', 'Your form tried to reload the page. End the onsubmit function with return false;');
      } else if (e.type === 'link') {
        const href = e.href ?? '';
        if (/^https:\/\//i.test(href)) {
          window.open(href, '_blank', 'noopener,noreferrer');
          linkNote.textContent = `Your link opened ${href} in a new tab.`;
        } else {
          linkNote.textContent = href
            ? `This link goes to "${href}". Web addresses need https:// at the start.`
            : 'This link has no href yet, so it doesn’t go anywhere.';
        }
        linkNote.hidden = false;
        setTimeout(() => (linkNote.hidden = true), 5000);
      }
    },
  });
  const tester = new RunnerFrame($('[data-test-host]'), { title: 'Test copy of your app', visible: false });
  const challengeRunner = new RunnerFrame($('[data-test-host]'), { title: 'Challenge code', visible: false });

  /* ------------------------------------------------------------- level */
  let project: Project = prepareProject(files, brief);
  let result: WebLevelResult | null = null;
  let checked = false;
  let renderToken = 0;
  let renderTimer: ReturnType<typeof setTimeout> | undefined;
  let rendering: Promise<void> = Promise.resolve();
  let lastSummary = '';
  let env: StyleEnv | undefined;

  function showLevel(index: number) {
    levelIndex = index;
    checked = false;
    result = null;
    const level = lesson.levels[index];
    const isBoss = level.id === 'boss';
    for (const name of applyLevelSetup(index)) {
      newFiles.add(name);
      const ed = editors.get(name);
      if (ed && ed.editor.getCode() !== files[name]) ed.editor.setCode(files[name] ?? '');
    }
    buildTabs();
    const fresh = [...newFiles];
    if (fresh.length) showFile(fresh.includes('script.js') ? 'script.js' : fresh[fresh.length - 1]);

    $('[data-web-builder]').classList.toggle('boss', isBoss);
    $('[data-level-tag]').textContent = isBoss ? 'EXAM' : `LEVEL ${level.id}`;
    $('[data-level-title]').textContent = level.title;
    $('[data-level-intro]').textContent = fillBrief(level.intro.replaceAll('{note}', brief!.notes?.[String(level.id)] ?? ''), brief!);
    $('[data-build-heading]').hidden = level.goals.length === 0;
    document.title = `${isBoss ? level.title : `Level ${level.id}: ${level.title}`} · Na<>y Builds`;

    goalsList.replaceChildren(
      ...level.goals.map((goal) => {
        const li = goalTemplate.content.firstElementChild!.cloneNode(true) as HTMLLIElement;
        const text = fillBrief(goal.text, brief!);
        richText(li.querySelector('.text')!, text);
        if (goal.stretch) li.classList.add('stretch');
        const spec = li.querySelector<HTMLElement>('.spec')!;
        if (goal.spec) {
          spec.textContent = goal.spec;
          spec.hidden = false;
        }
        const hintsEl = li.querySelector<HTMLOListElement>('.hints')!;
        const btn = li.querySelector<HTMLButtonElement>('.hint-btn')!;
        const hints = goal.hints.map((h) => fillBrief(h, brief!));
        if (hints.length === 0) btn.remove();
        else btn.setAttribute('aria-label', `Hint for: ${text}`);
        btn.addEventListener('click', () => {
          const shown = hintsEl.children.length;
          const item = document.createElement('li');
          richText(item, hints[shown]);
          hintsEl.append(item);
          hintsEl.hidden = false;
          if (shown + 1 >= hints.length) btn.remove();
          else {
            btn.textContent = `Hint ${shown + 2} of ${hints.length}`;
            btn.setAttribute('aria-label', `Hint ${shown + 2} of ${hints.length} for: ${text}`);
          }
          item.tabIndex = -1;
          item.focus();
        });
        return li;
      }),
    );

    renderChallenges(level.challenges ?? []);
    applyLevelMap(document, ids, progress.completed, level.id);
    updateNext();
    setMood('idle');
    say(
      progress.completed.includes(level.id)
        ? 'You have already cleared this level. Change anything you like, then check again.'
        : isBoss
          ? 'Exam boss: answer every item below. Your app stays on the right if you need it.'
          : 'Write your code, then press Check my code.',
    );
    lastSummary = '';
    void renderNow();
  }

  function updateNext() {
    const level = lesson.levels[levelIndex];
    const done = progress.completed.includes(level.id);
    const next = ids[levelIndex + 1];
    if (next === undefined) {
      nextBtn.hidden = true;
      return;
    }
    nextBtn.hidden = false;
    nextBtn.href = levelHash(next);
    nextBtn.innerHTML = `${next === 'boss' ? 'Exam boss' : 'Next level'} <span aria-hidden="true">▶</span>`;
    nextBtn.toggleAttribute('aria-disabled', !done);
    if (!done) nextBtn.setAttribute('aria-disabled', 'true');
    nextBtn.classList.toggle('btn-gold', done);
  }
  nextBtn.addEventListener('click', (e) => {
    if (nextBtn.getAttribute('aria-disabled') === 'true') {
      e.preventDefault();
      say('Clear this level first: every goal, then each challenge.');
    }
  });

  /* ----------------------------------------------------------- preview */
  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => void renderNow(), RENDER_DELAY);
  }

  const withLibrary = (html: string) => previewHtml(html, data.siteUrl, data.libraryUrl);

  function renderNow(): Promise<void> {
    clearTimeout(renderTimer);
    renderTimer = undefined;
    const token = ++renderToken;
    project = prepareProject(files, brief!);
    const ctx = { lesson, levelIndex };
    // Static goals tick straight away.
    void runWebLevel(project, ctx).then((r) => {
      if (token === renderToken && !result?.goals.length) showGoals(r);
      else if (token === renderToken) showGoals(mergePending(r));
    });

    const staticHtml = withLibrary(staticPage(files).html);
    const run = runnerPage(files);
    scriptStart = run.scriptStart;
    const runHtml = withLibrary(run.html);
    staticFrame.style.width = `${$('[data-runner-host]').clientWidth || 600}px`;
    twinFrame.style.width = staticFrame.style.width;
    clearConsole();
    alertQueue = [];
    alertBox.hidden = true;

    rendering = (async () => {
      await Promise.all([loadFrame(staticFrame, staticHtml), loadFrame(twinFrame, unstyledHtml(staticHtml)), preview.load(runHtml)]);
      if (token !== renderToken) return;
      const title = staticFrame.contentDocument?.title.trim() ?? '';
      tabTitle.textContent = title || 'Untitled';
      tabTitle.classList.toggle('empty', !title);
      if (tabAnnounce.textContent !== `Browser tab title: ${title || 'none'}`) tabAnnounce.textContent = `Browser tab title: ${title || 'none'}`;
      env = documentStyleEnv(staticFrame.contentDocument!, twinFrame.contentDocument!);
      const needsRuntime = lesson.levels[levelIndex].goals.some((g) => g.checks.some((c) => c.type.startsWith('js-') && c.type !== 'js-syntax' && c.type !== 'js-uses' && c.type !== 'js-defines'));
      const runtime = needsRuntime ? await frameRuntime(tester, runHtml) : undefined;
      if (token !== renderToken) return;
      const r = await runWebLevel(project, { ...ctx, env, runtime });
      if (token !== renderToken) return;
      result = r;
      showGoals(r);
    })();
    return rendering;
  }

  /** Keep goals that passed last time ticked while the runtime checks rerun. */
  function mergePending(r: WebLevelResult): WebLevelResult {
    return {
      ...r,
      goals: r.goals.map((g, i) => (g.pending && result?.goals[i]?.pass ? { ...result.goals[i], text: g.text } : g)),
    };
  }

  function showGoals(r: WebLevelResult) {
    const items = Array.from(goalsList.children) as HTMLLIElement[];
    r.goals.forEach((g, i) => {
      const li = items[i];
      if (!li) return;
      const state = g.pass ? 'pass' : g.pending ? 'pending' : 'fail';
      if (li.dataset.state !== state) li.dataset.state = state;
      li.querySelector('.goal-status')!.textContent = g.pass ? 'Done:' : 'Not done yet:';
      const msg = li.querySelector<HTMLElement>('.goal-msg')!;
      const showMsg = checked && !g.pass && !g.pending && !!g.message;
      msg.hidden = !showMsg;
      if (showMsg) richText(msg, g.message!);
    });
    if (!r.pending) {
      const done = r.goals.filter((g) => g.pass).length;
      const summary = `${done} of ${r.goals.length} goals done.`;
      if (summary !== lastSummary) {
        goalSummary.textContent = lastSummary ? summary : '';
        lastSummary = summary;
      }
    }
  }

  function highlight(h: Highlight | undefined) {
    if (h) void preview.request('highlight', { selector: h.selector, index: h.index ?? 0 });
  }

  $('[data-rerun]').addEventListener('click', () => void renderNow());

  /* ------------------------------------------------------------- check */
  function challengesLeft(): Challenge[] {
    return (lesson.levels[levelIndex].challenges ?? []).filter((c) => !extra.challenges[c.id]?.done);
  }

  function completeLevel() {
    const level = lesson.levels[levelIndex];
    const firstTime = !progress.completed.includes(level.id);
    if (firstTime) progress.completed.push(level.id);
    save();
    setMood('happy', true);
    const next = ids[levelIndex + 1];
    const praise =
      level.id === 'boss'
        ? 'You beat the exam boss! Download your report to hand it in.'
        : `Level ${level.id} complete! ${next === 'boss' ? 'The exam boss is unlocked.' : `Level ${next} is unlocked.`}`;
    say(firstTime ? praise : `Everything still passes. ${praise}`, { good: true });
    applyLevelMap(document, ids, progress.completed, level.id);
    updateNext();
    if (firstTime) celebrate(checkBtn);
  }

  async function check() {
    checked = true;
    checkBtn.setAttribute('aria-busy', 'true');
    await renderNow();
    checkBtn.removeAttribute('aria-busy');
    if (!result) return;
    if (result.pass) {
      const left = challengesLeft();
      if (left.length === 0) {
        completeLevel();
        return;
      }
      setMood('happy', true);
      say(
        lesson.levels[levelIndex].goals.length
          ? `Your app passes every goal. Now try the ${left.length === 1 ? 'challenge' : `${left.length} challenges`} under the goals to clear the level.`
          : `Answer every item under the goals. ${left.length} left.`,
        { good: true },
      );
      challengesWrap.scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    }
    setMood('tryagain', true);
    const failing = result.goals.find((g) => !g.pass && !g.stretch)!;
    const left = result.goals.filter((g) => !g.pass && !g.stretch).length;
    const lead = left === 1 ? 'Nearly there. ' : '';
    say(`${lead}${failing.message ?? failing.text}`, {
      goto: failing.line ? { file: fileOf(failing.message), line: failing.line } : undefined,
      mistakes: projectMistakes(project).map((m) => m.message),
    });
    highlight(failing.highlight);
  }
  checkBtn.addEventListener('click', () => void check());

  /** After a challenge attempt, clear the level if everything else is done. */
  function afterChallenge() {
    save();
    updateChallengeCount();
    if (challengesLeft().length) return;
    if (result?.pass && (checked || lesson.levels[levelIndex].goals.length === 0)) completeLevel();
    else if (!result?.pass) say('Challenges done. Now finish the goals for your app and press Check my code.');
    else say('Challenges done. Press Check my code to clear the level.');
  }

  /* -------------------------------------------------------- challenges */
  function updateChallengeCount() {
    const all = lesson.levels[levelIndex].challenges ?? [];
    const done = all.filter((c) => extra.challenges[c.id]?.done).length;
    challengeCount.textContent = all.length ? `${done} of ${all.length} tried` : '';
  }

  function codeBlock(file: string, code: string): HTMLElement[] {
    const name = document.createElement('p');
    name.className = 'file-name';
    name.textContent = file;
    const pre = document.createElement('pre');
    pre.className = 'code';
    pre.tabIndex = 0;
    pre.setAttribute('aria-label', `${file}, read only`);
    for (const line of code.replace(/\n$/, '').split('\n')) {
      const s = document.createElement('span');
      s.textContent = line || ' ';
      pre.append(s);
    }
    return [name, pre];
  }

  function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function renderChallenges(list: Challenge[]) {
    challengesWrap.hidden = list.length === 0;
    $('[data-challenge-note]').textContent =
      lesson.levels[levelIndex].goals.length === 0
        ? 'Unseen code, exam style. Answer every item to beat the boss.'
        : "Code you didn't write. Try each one to clear the level.";
    challengesEl.replaceChildren(...list.map(renderChallenge));
    updateChallengeCount();
  }

  function renderChallenge(c: Challenge): HTMLElement {
    const box = el('article', 'challenge');
    const state = (extra.challenges[c.id] ??= { done: false });
    box.dataset.done = String(state.done);
    const h = el('h3');
    const pill = el('span', `pill ${c.type}`, { trace: 'Trace', fix: 'Fix', exam: 'Exam' }[c.type]);
    const stateEl = el('span', 'state');
    h.append(pill, c.title, stateEl);
    box.append(h);
    if (c.spec) box.append(el('p', 'spec', c.spec));
    const mark = () => {
      box.dataset.done = String(state.done);
      stateEl.textContent = state.done
        ? c.type === 'exam'
          ? `${state.marks ?? 0} / ${c.marks}`
          : c.type === 'trace'
            ? state.correct
              ? 'Right first time'
              : 'Tried'
            : 'Fixed'
        : '';
    };
    mark();

    if (c.type === 'trace') {
      box.append(el('p', undefined, c.prompt));
      for (const [file, code] of Object.entries(c.files)) box.append(...codeBlock(file, code));
      const row = el('div', 'row');
      const id = `trace-${c.id}`;
      const label = el('label', undefined, 'Your answer:');
      label.htmlFor = id;
      const input = el('input');
      input.type = 'text';
      input.id = id;
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.value = state.answer ?? '';
      const btn = el('button', 'btn btn-gold', 'Run it');
      btn.type = 'button';
      row.append(label, input, btn);
      const res = el('p', 'result');
      res.setAttribute('role', 'status');
      const out = el('pre', 'console-out');
      out.hidden = true;
      box.append(row, res, out);
      const run = async () => {
        const answer = input.value.trim();
        if (!answer) {
          res.className = 'result bad';
          res.textContent = 'Commit to an answer first, then run it.';
          input.focus();
          return;
        }
        btn.disabled = true;
        const actual = await traceOutput(c);
        btn.disabled = false;
        const right = norm(answer) === norm(actual);
        if (!state.done) {
          state.done = true;
          state.correct = right;
        }
        state.answer = answer;
        res.className = `result ${right ? 'good' : 'bad'}`;
        res.textContent = right ? 'Correct.' : `Not quite. Trace it again line by line and see where your answer and the real output split.`;
        out.hidden = false;
        out.textContent = `The ${c.output === 'page' ? 'page shows' : c.output === 'alert' ? 'alert shows' : 'console shows'}:\n${actual || '(nothing)'}`;
        mark();
        afterChallenge();
      };
      btn.addEventListener('click', () => void run());
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') void run();
      });
    }

    if (c.type === 'fix') {
      box.append(el('p', undefined, fillBrief(c.prompt, brief!)));
      for (const [file, code] of Object.entries(c.files) as [FileName, string][]) {
        if (file !== c.edit) box.append(...codeBlock(file, code));
      }
      box.append(el('p', 'file-name', `${c.edit} (edit this)`));
      const host = el('div', 'mini-editor');
      box.append(host);
      const original = c.files[c.edit] ?? '';
      const ed = createCodeEditor({
        parent: host,
        doc: state.code ?? original,
        language: LANG[c.edit],
        label: `${c.edit} for the challenge ${c.title}`,
        compact: true,
        onChange: (code) => {
          state.code = code;
          saveExtra(lesson.id, extra);
        },
      });
      const row = el('div', 'row');
      const btn = el('button', 'btn btn-gold', 'Check my fix');
      btn.type = 'button';
      const reset = el('button', 'btn btn-quiet', 'Reset');
      reset.type = 'button';
      const hintBtn = el('button', 'btn btn-quiet', 'Hint');
      hintBtn.type = 'button';
      if (!c.hints.length) hintBtn.hidden = true;
      row.append(btn, reset, hintBtn);
      const hints = el('ol', 'hints');
      hints.hidden = true;
      const res = el('p', 'result');
      res.setAttribute('role', 'status');
      box.append(row, hints, res);
      hintBtn.addEventListener('click', () => {
        const n = hints.children.length;
        const li = el('li');
        richText(li, fillBrief(c.hints[n], brief!));
        hints.append(li);
        hints.hidden = false;
        if (n + 1 >= c.hints.length) hintBtn.hidden = true;
        else hintBtn.textContent = `Hint ${n + 2} of ${c.hints.length}`;
      });
      reset.addEventListener('click', () => {
        ed.setCode(original);
        res.textContent = '';
      });
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const r = await checkFix(c, ed.getCode());
        btn.disabled = false;
        res.className = `result ${r.pass ? 'good' : 'bad'}`;
        res.textContent = r.pass ? 'Fixed. Every check passes.' : r.message ?? 'Not fixed yet.';
        if (r.pass && !state.done) {
          state.done = true;
          state.correct = true;
          mark();
          afterChallenge();
        }
      });
    }

    if (c.type === 'exam') {
      const q = el('p');
      q.append(el('span', 'marks', `[${c.marks}]`));
      q.prepend(document.createTextNode(fillBrief(c.question, brief!) + ' '));
      q.style.display = 'flex';
      q.style.gap = '8px';
      box.append(q);
      if (c.code) box.append(...codeBlock('code', c.code));
      const id = `exam-${c.id}`;
      const label = el('label', undefined, 'Your answer');
      label.htmlFor = id;
      const area = el('textarea');
      area.id = id;
      area.value = state.answer ?? '';
      const btn = el('button', 'btn btn-gold', 'Show the mark scheme');
      btn.type = 'button';
      const scheme = el('ul', 'scheme');
      scheme.setAttribute('aria-label', 'Mark scheme: tick each point your answer makes');
      const score = el('p', 'result');
      score.setAttribute('role', 'status');
      box.append(label, area, btn, scheme, score);
      const showScheme = () => {
        btn.hidden = true;
        area.readOnly = false;
        scheme.replaceChildren(
          ...c.markScheme.map((point, i) => {
            const li = el('li');
            const cb = el('input');
            cb.type = 'checkbox';
            cb.id = `${id}-${i}`;
            cb.checked = state.ticked?.includes(i) ?? false;
            const l = el('label');
            l.htmlFor = cb.id;
            richText(l, point);
            l.style.fontWeight = '400';
            cb.addEventListener('change', () => {
              state.ticked = Array.from(scheme.querySelectorAll<HTMLInputElement>('input')).flatMap((x, n) => (x.checked ? [n] : []));
              state.marks = Math.min(state.ticked.length, c.marks);
              updateScore();
              mark();
              saveExtra(lesson.id, extra);
            });
            li.append(cb, l);
            return li;
          }),
        );
        updateScore();
      };
      const updateScore = () => {
        score.className = 'result';
        score.textContent = `Tick each point your answer makes: ${state.marks ?? 0} of ${c.marks} marks (up to ${c.marks} from ${c.markScheme.length} points).`;
      };
      area.addEventListener('input', () => {
        state.answer = area.value;
        saveExtra(lesson.id, extra);
      });
      btn.addEventListener('click', () => {
        if (!area.value.trim()) {
          score.className = 'result bad';
          score.textContent = 'Write your answer first. The mark scheme appears after you try.';
          area.focus();
          return;
        }
        state.answer = area.value;
        state.done = true;
        state.marks ??= 0;
        showScheme();
        mark();
        afterChallenge();
      });
      if (state.done) showScheme();
    }
    return box;
  }

  async function traceOutput(c: Extract<Challenge, { type: 'trace' }>): Promise<string> {
    const html = runnerPage(c.files as Files).html;
    const loaded = await challengeRunner.load(html);
    const r = await challengeRunner.request<{ log?: { alerts: string[]; writes: string[]; console: string[] } }>('log');
    if (loaded.errors.length) return `Error: ${friendlyRuntime(loaded.errors[0].message ?? '')}`;
    const log = r.log ?? { alerts: [], writes: [], console: [] };
    if (c.output === 'alert') return log.alerts.join('\n');
    if (c.output === 'console') return log.console.join('\n');
    if (log.writes.length) return log.writes.join('');
    const body = await challengeRunner.request<{ text?: string }>('text', { selector: 'body' });
    return (body.text ?? '').trim();
  }

  async function checkFix(c: Extract<Challenge, { type: 'fix' }>, code: string) {
    const fixFiles = { ...(c.files as Files), [c.edit]: code };
    const p = prepareProject(fixFiles, brief!);
    const runtime = await frameRuntime(challengeRunner, runnerPage(fixFiles).html);
    for (const check of c.checks) {
      const r = await runWebCheck(check, p, { lesson, levelIndex, runtime });
      if (!r.pass) return r;
    }
    return { pass: true, message: undefined };
  }

  /* ------------------------------------------------- download and reset */
  const downloadFiles = () => FILE_NAMES.filter((n) => files[n] !== undefined).map((n) => ({ name: n, text: cleanForDownload(files[n]!) }));

  $('[data-download]').addEventListener('click', () => {
    const zip = makeZip(downloadFiles());
    const blob = new Blob([zip as BlobPart], { type: 'application/zip' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'my-web-app.zip';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    say('Downloaded my-web-app.zip. Unzip it and open index.html in a browser: all three files must stay in the same folder.');
  });

  $('[data-pseudo-open]').addEventListener('click', () => $<HTMLDialogElement>('[data-pseudo]').showModal());

  const reportBtn = $<HTMLButtonElement>('[data-report-open]');
  const reportDialog = $<HTMLDialogElement>('[data-report]');
  const reportName = $<HTMLInputElement>('#report-name');
  let reporting = false;
  reportBtn.addEventListener('click', () => {
    if (reporting) return;
    reportDialog.returnValue = '';
    reportDialog.showModal();
  });
  $('[data-report-cancel]').addEventListener('click', () => reportDialog.close('cancel'));
  reportDialog.addEventListener('close', () => {
    if (reportDialog.returnValue === 'make') void makeReport(reportName.value.trim());
  });

  async function makeReport(name: string) {
    reporting = true;
    reportBtn.setAttribute('aria-disabled', 'true');
    reportBtn.textContent = 'Making your report…';
    say('Making your report. This takes a few seconds.');
    try {
      await renderNow();
      const runHtml = withLibrary(runnerPage(files).html);
      const levels = [];
      for (const [i, level] of lesson.levels.entries()) {
        const runtime = await frameRuntime(tester, runHtml);
        const r = await runWebLevel(prepareProject(files, brief!), { lesson, levelIndex: i, env, runtime });
        const required = r.goals.filter((g) => !g.stretch);
        levels.push({
          label: level.id === 'boss' ? 'Exam boss' : `Level ${level.id}: ${level.title}`,
          done: required.filter((g) => g.pass).length,
          total: required.length,
          cleared: progress.completed.includes(level.id),
        });
      }
      const challenges: [string, string][] = lesson.levels.flatMap((level) =>
        (level.challenges ?? []).map((c): [string, string] => {
          const s = extra.challenges[c.id];
          const where = level.id === 'boss' ? 'Boss' : `L${level.id}`;
          const label = `${where} ${{ trace: 'Trace', fix: 'Fix', exam: 'Exam' }[c.type]}: ${c.title}`;
          if (!s?.done) return [label, 'Not tried'];
          if (c.type === 'exam') return [label, `${s.marks ?? 0} / ${c.marks} marks`];
          if (c.type === 'trace') return [label, s.correct ? 'Right first time' : 'Tried'];
          return [label, 'Fixed'];
        }),
      );
      const { downloadReport } = await import('./report');
      const file = await downloadReport({
        name,
        hobby: brief!.name,
        code: files['index.html'] ?? '',
        html: withLibrary(staticPage(files).html),
        title: staticFrame.contentDocument?.title.trim() ?? '',
        levels,
        docTitle: 'My web app',
        topicLabel: 'Brief',
        fileStem: 'my-web-app',
        files: downloadFiles().map((f) => ({ name: f.name, code: f.text })),
        challenges,
      });
      say(`Downloaded ${file}. Upload it to your Teams assignment.`, { good: true });
    } catch (err) {
      console.error(err);
      say('Sorry, your report couldn’t be made. Try again, or use Download my code instead.');
    } finally {
      reporting = false;
      reportBtn.removeAttribute('aria-disabled');
      reportBtn.textContent = 'Download my report';
    }
  }

  const confirm = $<HTMLDialogElement>('[data-confirm]');
  $('[data-reset]').addEventListener('click', () => confirm.showModal());
  confirm.addEventListener('close', () => {
    if (confirm.returnValue !== 'reset') return;
    progress.completed = [];
    files = { 'index.html': starter };
    extra.applied = [];
    extra.challenges = {};
    for (const { el } of editors.values()) el.remove();
    editors.clear();
    active = 'index.html';
    save();
    history.replaceState(null, '', levelHash(ids[0]));
    showLevel(0);
    say('Fresh start. Begin with the doctype in index.html.');
  });

  /* -------------------------------------------------------- navigation */
  guardLockedLinks(document, (id) =>
    say(`${id === 'boss' ? 'The exam boss' : `Level ${id}`} is locked. Clear this level first.`),
  );
  window.addEventListener('hashchange', () => {
    const i = openOrRedirect(levelFromHash());
    if (i !== null && i !== levelIndex) showLevel(i);
  });

  clearConsole();
  showLevel(levelIndex);
}
