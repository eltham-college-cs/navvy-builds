# Na<>y Builds

An HTML and CSS practice site for Eltham College. Students write code in a
panel, see a live preview, and get instant, friendly feedback from automatic
checks. Two lessons: a Year 8 recap, where each student builds a web page
about their own hobby, and a Sixth Form lesson (OCR A Level H446, 1.3.4 web
technologies) where students build a small web app in HTML, CSS and
JavaScript and try Fix, Trace and Exam challenges on code they didn't write.

Read `docs/SPEC.md` before writing any code. It is the source of truth.
`docs/SPEC-SIXTH-FORM.md` extends it for the Sixth Form lesson.
`src/content/lessons/01-my-hobby-page/lesson.json` holds every level, check
and hint for lesson 1; `02-web-app/lesson.json` does the same for the Sixth
Form lesson (`src/lib/web-builder.ts`, `src/checker/webapp.ts`). `design/`
holds the approved logo and look as reference HTML: match it, do not ship
those files.

## Stack

- Astro (static output), TypeScript, Astro content collections (JSON + zod).
- CodeMirror 6 editor. Preview in a sandboxed iframe. No server, no Pyodide.
- Vitest for the checker. Hosted on GitHub Pages from `eltham-college-cs`,
  deployed by GitHub Actions on push to `main`.

## Rules

- No student data leaves the browser. No accounts, analytics or cookies.
  Work is saved in `localStorage` only.
- Preview iframes with `allow-same-origin` never get `allow-scripts`. Student
  JavaScript (Sixth Form only) runs in the runner frame, which has
  `sandbox="allow-scripts allow-forms"` and never `allow-same-origin`, and
  talks to the site only through `postMessage` (`src/checker/harness.ts`).
- Model answers are never shipped on the site. Hints only. Sixth Form exam
  mark schemes are the one exception, shown only after the student answers.
- Every animation respects `prefers-reduced-motion`.
- British English in all copy; sentence case for buttons and headings.
  Code examples use real CSS spelling (`color`), and the checker explains why.
- Accessible: keyboard only must work, visible focus, contrast at least 4.5:1,
  touch targets at least 44px, usable at 1366×768 school laptop size.
- Press Start 2P is for the logo, level titles and badges only. Body text is Lexend.

## Commands

- `npm run dev` · `npm run build` · `npm run check` · `npm test`
