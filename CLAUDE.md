# Na<>y Builds

An HTML and CSS practice site for Eltham College. Students write code in a
panel, see a live preview, and get instant, friendly feedback from automatic
checks. The first release is one 60-minute lesson: a Year 8 recap, where each
student builds a web page about their own hobby, level by level.

Read `docs/SPEC.md` before writing any code. It is the source of truth.
`src/content/lessons/01-my-hobby-page/lesson.json` holds every level, check
and hint for lesson 1. `design/` holds the approved logo and look as reference
HTML: match it, do not ship those files.

## Stack

- Astro (static output), TypeScript, Astro content collections (JSON + zod).
- CodeMirror 6 editor. Preview in a sandboxed iframe. No server, no Pyodide.
- Vitest for the checker. Hosted on GitHub Pages from `eltham-college-cs`,
  deployed by GitHub Actions on push to `main`.

## Rules

- No student data leaves the browser. No accounts, analytics or cookies.
  Work is saved in `localStorage` only.
- The preview iframe uses `sandbox="allow-same-origin"` and never `allow-scripts`.
- Model answers are never shipped on the site. Hints only.
- Every animation respects `prefers-reduced-motion`.
- British English in all copy; sentence case for buttons and headings.
  Code examples use real CSS spelling (`color`), and the checker explains why.
- Accessible: keyboard only must work, visible focus, contrast at least 4.5:1,
  touch targets at least 44px, usable at 1366×768 school laptop size.
- Press Start 2P is for the logo, level titles and badges only. Body text is Lexend.

## Commands

- `npm run dev` · `npm run build` · `npm run check` · `npm test`
