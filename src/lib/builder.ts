/**
 * The builder screen: editor, live preview, goals that tick as you type, and
 * the mascot's reaction when you press Check my page.
 */
import { celebrate } from '../components/Celebrate';
import { createEditor, type Editor } from '../components/Editor';
import { fillHobby, hobbyLabel, isOpenHobby } from '../checker/hobby';
import { pageMistakes, preparePage, runLevel, type LevelResult, type Page } from '../checker/run';
import { previewHtml, unstyledHtml } from '../checker/sanitize';
import { documentStyleEnv } from '../checker/style';
import type { Highlight } from '../checker/types';
import type { Lesson } from '../lesson-schema';
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

export interface BuilderData {
  lesson: Lesson;
  /** Absolute URL of the site root, e.g. https://…/navvy-builds/ */
  siteUrl: string;
  /** Absolute URL of the image library folder. */
  libraryUrl: string;
  lessonUrl: string;
  mascotName: string;
  imagesPerHobby: number;
}

const RENDER_DELAY = 400;
const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

/** Wrap code-looking parts of a hint (<h1>, h1 { … }) in <code>. */
function richText(el: HTMLElement, text: string) {
  el.textContent = '';
  const re = /(<\/?[a-zA-Z!][^>]*>(?:[^<]*<\/[a-z0-9]+>)?|[a-z0-9-]+ \{[^}]*\}|[a-z-]+: [^;]+;|https?:\/\/\S*|images\/\S+)/g;
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

export function startBuilder(data: BuilderData): void {
  const { lesson } = data;
  const ids = lesson.levels.map((l) => l.id) as LevelId[];
  const progress = loadProgress(lesson.id);

  if (progress.hobby === null) {
    location.replace(`${data.lessonUrl}?need=hobby`);
    return;
  }
  const hobby = progress.hobby;

  // Which level? #level-N, or carry on from where you were.
  const levelFromHash = (): number | null => {
    const id = parseLevelHash(location.hash);
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

  /* ---------------------------------------------------------- elements */
  const preview = $<HTMLIFrameElement>('[data-preview]');
  const twin = $<HTMLIFrameElement>('[data-twin]');
  const tabTitle = $('[data-tab-title]');
  const tabAnnounce = $('[data-tab-announce]');
  const linkNote = $('[data-link-note]');
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
  const confirm = $<HTMLDialogElement>('[data-confirm]');
  const library = $<HTMLDetailsElement>('[data-library]');

  /* ------------------------------------------------------------- state */
  const starter = lesson.starter.replaceAll('{hobby}', isOpenHobby(hobby) ? 'hobby' : hobby);
  let code = progress.code ?? starter;
  let page: Page = preparePage(code, hobby);
  let result: LevelResult | null = null;
  let checked = false; // pressed Check on this level yet?
  let renderToken = 0;
  let renderTimer: ReturnType<typeof setTimeout> | undefined;
  let rendering: Promise<void> = Promise.resolve();
  let lastSummary = '';
  let gotoLine: number | undefined;

  const save = () => {
    progress.code = code;
    saveProgress(lesson.id, progress);
  };

  /* ------------------------------------------------------------ editor */
  const editor: Editor = createEditor({
    parent: $('[data-editor]'),
    doc: code,
    label: 'HTML code editor for your page',
    onChange: (c) => {
      code = c;
      save();
      clearHighlight();
      scheduleRender();
    },
    onEscape: () => checkBtn.focus(),
  });
  // A handle for testing in the browser console during development only.
  if (import.meta.env.DEV) Object.assign(window, { navvyEditor: editor });

  /* ------------------------------------------------------------ mascot */
  function setMood(mood: Mood, react = false) {
    mascot.innerHTML = mascotSvg(mood, `${data.mascotName} the snake`);
    mascot.className = `mascot mood-${mood}`;
    mascot.dataset.mood = mood;
    if (react) {
      void mascot.offsetWidth; // restart the animation
      mascot.classList.add('react');
    }
  }

  function say(text: string, opts: { good?: boolean; line?: number; mistakes?: string[] } = {}) {
    message.textContent = text;
    bubble.classList.toggle('good', !!opts.good);
    gotoLine = opts.line;
    gotoBtn.hidden = opts.line === undefined;
    if (opts.line !== undefined) gotoBtn.textContent = `Go to line ${opts.line}`;
    const mistakes = (opts.mistakes ?? []).filter((m) => !text.includes(m));
    mistakesList.hidden = mistakes.length === 0;
    mistakesList.replaceChildren(
      ...mistakes.map((m) => {
        const li = document.createElement('li');
        li.textContent = m;
        return li;
      }),
    );
  }

  gotoBtn.addEventListener('click', () => {
    if (gotoLine !== undefined) editor.goToLine(gotoLine);
  });

  /* ------------------------------------------------------------- level */
  function showLevel(index: number) {
    levelIndex = index;
    checked = false;
    const level = lesson.levels[index];
    const isBoss = level.id === 'boss';
    $('[data-level-tag]').textContent = isBoss ? 'EXTRA' : `LEVEL ${level.id}`;
    $('[data-level-title]').textContent = level.title;
    $('[data-level-intro]').textContent = fillHobby(level.intro, hobby);
    document.title = `${isBoss ? level.title : `Level ${level.id}: ${level.title}`} · Na<>y Builds`;

    goalsList.replaceChildren(
      ...level.goals.map((goal) => {
        const li = goalTemplate.content.firstElementChild!.cloneNode(true) as HTMLLIElement;
        richText(li.querySelector('.text')!, fillHobby(goal.text, hobby));
        const hintsEl = li.querySelector<HTMLOListElement>('.hints')!;
        const btn = li.querySelector<HTMLButtonElement>('.hint-btn')!;
        const hints = goal.hints.map((h) => fillHobby(h, hobby));
        if (hints.length === 0) btn.remove();
        else btn.setAttribute('aria-label', `Hint for: ${fillHobby(goal.text, hobby)}`);
        btn.addEventListener('click', () => {
          const shown = hintsEl.children.length;
          const item = document.createElement('li');
          richText(item, hints[shown]);
          hintsEl.append(item);
          hintsEl.hidden = false;
          if (shown + 1 >= hints.length) btn.remove();
          else {
            btn.textContent = `Hint ${shown + 2} of ${hints.length}`;
            btn.setAttribute('aria-label', `Hint ${shown + 2} of ${hints.length} for: ${fillHobby(goal.text, hobby)}`);
          }
          item.tabIndex = -1;
          item.focus();
        });
        return li;
      }),
    );

    const usesImages = level.goals.some((g) => g.checks.some((c) => 'selector' in c && /\bimg\b/.test(c.selector)));
    library.open = usesImages;

    applyLevelMap(document, ids, progress.completed, level.id);
    updateNext();
    setMood('idle');
    say(
      progress.completed.includes(level.id)
        ? 'You have already cleared this level. Change anything you like, then check again.'
        : 'Type your code, then press Check my page.',
    );
    lastSummary = '';
    renderNow();
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
    nextBtn.innerHTML = `${next === 'boss' ? 'Boss level' : 'Next level'} <span aria-hidden="true">▶</span>`;
    if (done) {
      nextBtn.removeAttribute('aria-disabled');
      nextBtn.classList.add('btn-gold');
    } else {
      nextBtn.setAttribute('aria-disabled', 'true');
      nextBtn.classList.remove('btn-gold');
    }
  }

  nextBtn.addEventListener('click', (e) => {
    if (nextBtn.getAttribute('aria-disabled') === 'true') {
      e.preventDefault();
      say('Clear every goal on this level first, then press Check my page.');
    }
  });

  /* ----------------------------------------------------------- preview */
  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderNow, RENDER_DELAY);
  }

  function renderNow(): Promise<void> {
    clearTimeout(renderTimer);
    renderTimer = undefined;
    const token = ++renderToken;
    page = preparePage(code, hobby);
    const html = previewHtml(page.safeHtml, data.siteUrl, data.libraryUrl);
    twin.style.width = `${preview.clientWidth || 600}px`;
    rendering = Promise.all([loadFrame(preview, html), loadFrame(twin, unstyledHtml(html))]).then(() => {
      if (token !== renderToken) return;
      wirePreviewLinks();
      const title = page.doc.title.trim();
      tabTitle.textContent = title || 'Untitled';
      tabTitle.classList.toggle('empty', !title);
      if (tabAnnounce.textContent !== `Browser tab title: ${title || 'none'}`) {
        tabAnnounce.textContent = `Browser tab title: ${title || 'none'}`;
      }
      const env = documentStyleEnv(preview.contentDocument!, twin.contentDocument!);
      result = runLevel(lesson, levelIndex, page, env);
      showGoals(result);
    });
    // Goals that don't need the preview can tick straight away.
    result = runLevel(lesson, levelIndex, page);
    showGoals(result);
    return rendering;
  }

  function showGoals(r: LevelResult) {
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
      if (showMsg) msg.textContent = g.message!;
    });
    if (!r.pending) {
      const done = r.goals.filter((g) => g.pass).length;
      const summary = `${done} of ${r.goals.length} goals done.`;
      if (summary !== lastSummary) {
        goalSummary.textContent = lastSummary ? summary : '';
        lastSummary = summary;
      }
    }
    if (checked) {
      const mistakes = pageMistakes(page)
        .map((m) => m.message)
        .filter((m) => !(message.textContent ?? '').includes(m));
      mistakesList.hidden = mistakes.length === 0 || bubble.classList.contains('good');
      mistakesList.replaceChildren(
        ...mistakes.map((m) => {
          const li = document.createElement('li');
          li.textContent = m;
          return li;
        }),
      );
    }
  }

  /** Links in the preview open in a new tab instead of replacing the preview. */
  function wirePreviewLinks() {
    const doc = preview.contentDocument;
    if (!doc) return;
    doc.addEventListener('click', (e) => {
      const a = (e.target as Element).closest?.('a');
      if (!a) return;
      e.preventDefault();
      const href = a.getAttribute('href') ?? '';
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
    });
  }

  function clearHighlight() {
    preview.contentDocument?.querySelectorAll('[data-preview-highlight]').forEach((el) => el.removeAttribute('data-preview-highlight'));
  }

  function highlight(h: Highlight | undefined) {
    const doc = preview.contentDocument;
    if (!h || !doc) return;
    let el: Element | undefined;
    try {
      el = doc.querySelectorAll(h.selector)[h.index ?? 0];
    } catch {
      return;
    }
    if (!el) return;
    if (!doc.getElementById('nb-highlight-style')) {
      const style = doc.createElement('style');
      style.id = 'nb-highlight-style';
      style.textContent = '[data-preview-highlight]{outline:4px dashed #D9455F !important;outline-offset:3px !important}';
      doc.head?.append(style);
    }
    el.setAttribute('data-preview-highlight', '');
    const top = el.getBoundingClientRect().top + (doc.scrollingElement?.scrollTop ?? 0);
    doc.scrollingElement?.scrollTo({ top: Math.max(0, top - 60) });
  }

  /* ------------------------------------------------------------- check */
  async function check() {
    checked = true;
    await renderNow();
    if (!result) return;
    const level = lesson.levels[levelIndex];
    const isBoss = level.id === 'boss';
    if (result.pass) {
      const firstTime = !progress.completed.includes(level.id);
      if (firstTime) progress.completed.push(level.id);
      save();
      setMood('happy', true);
      const next = ids[levelIndex + 1];
      const praise = isBoss
        ? 'You beat the boss level! Your page is finished. Download your report to hand it in.'
        : `Level ${level.id} complete! ${next === 'boss' ? 'The boss level is unlocked.' : `Level ${next} is unlocked.`}`;
      say(firstTime ? praise : `Everything still passes. ${praise}`, { good: true });
      applyLevelMap(document, ids, progress.completed, level.id);
      updateNext();
      showGoals(result);
      if (firstTime) celebrate(checkBtn);
      return;
    }
    setMood('tryagain', true);
    const failing = result.goals.find((g) => !g.pass)!;
    const left = result.goals.filter((g) => !g.pass).length;
    const lead = left === 1 ? 'Nearly there. ' : '';
    say(`${lead}${failing.message ?? failing.text}`, {
      line: failing.line,
      mistakes: pageMistakes(page).map((m) => m.message),
    });
    showGoals(result);
    highlight(failing.highlight);
  }

  checkBtn.addEventListener('click', () => void check());

  /* ------------------------------------------------- download and reset */
  $('[data-download]').addEventListener('click', () => {
    const blob = new Blob([code], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'my-hobby-page.html';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    say('Downloaded my-hobby-page.html. If you used library pictures, save them in a folder called images next to it.');
  });

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
      const env = documentStyleEnv(preview.contentDocument!, twin.contentDocument!);
      const levels = lesson.levels.map((level, i) => {
        const r = runLevel(lesson, i, page, env);
        return {
          label: level.id === 'boss' ? 'Boss level' : `Level ${level.id}: ${level.title}`,
          done: r.goals.filter((g) => g.pass).length,
          total: r.goals.length,
          cleared: progress.completed.includes(level.id),
        };
      });
      const { downloadReport } = await import('./report');
      const file = await downloadReport({
        name,
        hobby: isOpenHobby(hobby) ? 'Something else' : hobby,
        code,
        html: previewHtml(page.safeHtml, data.siteUrl, data.libraryUrl),
        title: page.doc.title.trim(),
        levels,
      });
      say(`Downloaded ${file}. Upload it to your Teams assignment.`, { good: true });
    } catch (err) {
      console.error(err);
      say('Sorry, your report couldn’t be made. Try again, or use Download my page instead.');
    } finally {
      reporting = false;
      reportBtn.removeAttribute('aria-disabled');
      reportBtn.textContent = 'Download my report';
    }
  }

  $('[data-reset]').addEventListener('click', () => confirm.showModal());
  confirm.addEventListener('close', () => {
    if (confirm.returnValue !== 'reset') return;
    progress.completed = [];
    code = starter;
    save();
    editor.setCode(starter);
    history.replaceState(null, '', levelHash(ids[0]));
    showLevel(0);
    say('Fresh start. Begin with the doctype.');
  });

  /* ----------------------------------------------------- image library */
  const pictureSet = !isOpenHobby(hobby) && lesson.hobbies.includes(hobby) ? hobby : 'other';
  const copyStatus = $('[data-copy-status]');
  $('[data-pictures]').replaceChildren(
    ...Array.from({ length: data.imagesPerHobby }, (_, i) => {
      const file = `${pictureSet}-${i + 1}.png`;
      const path = `images/${file}`;
      const li = document.createElement('li');
      li.innerHTML = `<img alt="" width="400" height="300" loading="lazy"><code></code><div class="row"><button type="button" class="btn">Copy path</button><a class="save">Save picture</a></div>`;
      const img = li.querySelector('img')!;
      img.src = data.libraryUrl + file;
      li.querySelector('code')!.textContent = path;
      const save = li.querySelector<HTMLAnchorElement>('.save')!;
      save.href = data.libraryUrl + file;
      save.download = file;
      save.setAttribute('aria-label', `Save picture ${i + 1}`);
      const btn = li.querySelector('button')!;
      btn.setAttribute('aria-label', `Copy path ${path}`);
      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(path);
          btn.textContent = 'Copied!';
          copyStatus.textContent = `Copied ${path}. Paste it between the quotes in src="".`;
        } catch {
          const range = document.createRange();
          range.selectNodeContents(li.querySelector('code')!);
          getSelection()?.removeAllRanges();
          getSelection()?.addRange(range);
          btn.textContent = 'Press Ctrl+C';
          copyStatus.textContent = `${path} is selected. Press Control C to copy it.`;
        }
        setTimeout(() => (btn.textContent = 'Copy path'), 2000);
      });
      return li;
    }),
  );
  if (pictureSet === 'other') {
    const note = document.createElement('p');
    note.className = 'library-note';
    note.textContent = `No library pictures for ${hobbyLabel(hobby)} yet. Use one of these, or any https:// image address.`;
    $('[data-pictures]').before(note);
  }

  /* -------------------------------------------------------- navigation */
  guardLockedLinks(document, (id) =>
    say(`${id === 'boss' ? 'The boss level' : `Level ${id}`} is locked. Clear this level first.`),
  );
  window.addEventListener('hashchange', () => {
    const i = openOrRedirect(levelFromHash());
    if (i !== null && i !== levelIndex) showLevel(i);
  });

  showLevel(levelIndex);
}
