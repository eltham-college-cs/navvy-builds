# Na<>y Builds Sixth Form: build specification

This extends `docs/SPEC.md` (the Year 8 site). Anything not mentioned here
works as described there. Where the two disagree for the Sixth Form lesson,
this file wins.

Design reference: `design/sixth-form-builder.html` (the approved comp).

## 1. Brief

- **Audience:** Year 12 and 13, OCR A Level Computer Science (H446),
  specification section **1.3.4 Web technologies**, with the language
  reference in **Appendix 5d** (HTML, CSS, JavaScript).
- **Spec requirement:** students must understand the purpose of HTML, CSS
  and JavaScript, have written web pages using all three, recognise the
  code in Appendix 5d, and be able to **read, write, amend and interpret**
  it.
- **What students make:** one small working web app (their chosen *brief*,
  § 6), built across three real files: `index.html`, `style.css` and
  `script.js`. The app grows level by level, as in the Year 8 site.
- **What else they do:** at most levels, short challenges on code they did
  not write: **Fix** (amend), **Trace** (interpret) and **Exam** (read),
  alongside **Build** (write). § 7 describes them.
- **Same site, same repo.** This is a new lesson with a new theme and a
  few new components. It is not a separate app. The Year 8 lesson must
  keep working unchanged.

### Content covered (Appendix 5d, complete)

| HTML | CSS | JavaScript |
|---|---|---|
| `html`, `head`, `title`, `body` | `style` attribute (inline) | Input read from a form (given code, § 5.4) |
| `link` to a CSS file | External style sheet, element selectors | Output: `getElementById(…).innerHTML = …` |
| `h1`, `h2`, `h3`, `p`, `div` | Class selectors (`.infoBox`) | Output: `document.write(…)` |
| `img` with `src`, `alt`, `height`, `width` | Identifier selectors (`#menu`) | Output: `alert(…)` |
| `a` with `href` | `background-color`, `color` (named and hex) | JavaScript equivalents of the pseudocode structures: variables, selection, `switch`, `for`, `while`, `do … while`, functions and procedures, arrays, string handling |
| `ul`, `ol`, `li` | `border-color`, `border-style`, `border-width` | |
| `form`, `input type="text"` with `name`, `input type="submit"` | `font-family`, `font-size`, `height`, `width` | |
| `script` | | |

Out of scope, because the spec excludes them: JavaScript OOP, file
handling, and anything where passing by value or by reference matters.
Anything else is "explained in the question" in the exam, so the site does
not drill it.

> The JavaScript structures list is taken from the H446 pseudocode guide.
> Check it against the current specification before writing level 7.

### Timing

Four 60-minute lessons (two levels each), with the exam boss level as
homework or a fifth lesson. Each lesson follows the Year 8 pattern: slides
for recall and teaching, then about 35 minutes on the site, then a plenary.

| Lesson | Levels | Focus |
|---|---|---|
| 1 | 1–2 | HTML structure and content |
| 2 | 3–4 | CSS: external, inline, classes, identifiers |
| 3 | 5–6 | Forms and first JavaScript |
| 4 | 7–8 | JavaScript logic; debugging |
| 5 or homework | Boss | Exam-style paper |

## 2. Site map

```
/lessons/web-app/                 Lesson intro: choose your brief, then level map
/lessons/web-app/play/#level-6    Builder at a given level (deep-linkable)
/lessons/web-app/play/#boss       Exam boss level
/help/sixth-form/                 Appendix 5d coverage, pseudocode ↔ JavaScript panel
```

The home page lists the lesson under a "Sixth Form" heading, below the
Year 8 lesson.

## 3. Repository changes

```
src/
├── content/lessons/02-web-app/lesson.json   the Sixth Form lesson (§ 11)
├── lesson-schema.ts          extended (§ 11); Year 8 lesson still validates
├── checker/
│   ├── files.ts              NEW: the three-file project, assembling the page
│   ├── css-source.ts         NEW: parses style.css and style="" attributes
│   ├── js.ts                 NEW: JavaScript parse, AST checks, loop guard
│   ├── runner.ts             NEW: talks to the script-running preview (§ 5)
│   └── *.test.ts
├── components/
│   ├── FileTabs.astro        NEW: index.html / style.css / script.js tabs
│   ├── Console.astro         NEW: console, errors and alert() under the preview
│   ├── BriefPicker.astro     NEW: replaces HobbyPicker for this lesson
│   ├── Challenge.astro       NEW: Fix, Trace and Exam cards (§ 7)
│   └── PseudocodePanel.astro NEW: side panel, also used on the help page
├── runner/harness.js         NEW: injected into the running preview (§ 5.2)
└── styles/theme-sixth-form.css
```

New dependencies: `acorn` and `acorn-walk` (JavaScript parsing and loop
guard), `fflate` (zip download). All bundled; nothing loaded from a CDN.

## 4. Look and feel

Same brand as Year 8 (navy, gold, pixel cube, the snake mascot
`config.mascot.name`), applied more sparingly for older students:

- Press Start 2P only for the logo, level numbers and the "EXAM" badge.
- Lexend at **16px** body (Year 8 uses 18px); JetBrains Mono **14px** in
  the editor.
- The editor is always dark (`#0D2136`), whatever the site theme. The rest
  of the page has light and dark themes.
- The header shows the brief name and "Level N of 8" next to the level blocks.
- Task-type pills use one colour each: Build blue `#2F7DD1`, Fix red
  `#D2483B`, Trace green `#1F9D5C`, Exam gold `#B07D12`.
- Layout at 1366×768: goals column 300px, editor and preview share the
  rest. Below 1100px the goals move above; below 820px everything stacks.

## 5. The builder screen

Layout as in the comp: goals on the left, editor with file tabs in the
middle, preview with feedback on the right.

### 5.1 Three files

- The project is `{ "index.html", "style.css", "script.js" }`, all saved to
  `localStorage` on every change, as the Year 8 code is.
- Files appear when a level first needs them: `index.html` from level 1,
  `style.css` from level 3, `script.js` from level 6 (§ 11, `addFiles`).
- To build the preview, `files.ts` replaces `<link rel="stylesheet"
  href="style.css">` with the stylesheet's text, and `<script
  src="script.js"></script>` with the script's text. If the tag is missing
  or the file name is wrong, the file is **not** included, and the goal
  says why ("Your page doesn't link to style.css yet").
- Error line numbers always refer to the file the student typed, not the
  assembled page.

### 5.2 Running student JavaScript (changes a CLAUDE.md rule)

The Year 8 site never runs student scripts. This lesson must. The rule in
`CLAUDE.md` changes to: **student scripts run only in the runner frame,
which never has `allow-same-origin`**. Update `CLAUDE.md` when this lands.

Two frames:

| Frame | Sandbox | Scripts | Used for |
|---|---|---|---|
| **Static** (exists today, hidden) | `allow-same-origin` | stripped | DOM and computed-style checks, as in Year 8 |
| **Runner** (visible preview) | `allow-scripts allow-forms` | run | What the student sees and uses; JavaScript checks |

The runner frame has an opaque origin, so it cannot reach the site,
`localStorage` or cookies. It talks to the builder only through
`postMessage`. `runner/harness.js` is injected first into the runner page
and:

- replaces `alert()` with a message to the builder, which draws an alert
  box over the preview (sandboxed frames cannot show real dialogs);
- forwards `console.log`, uncaught errors (with file and line) and
  `document.write` calls to the Console panel;
- adds a last-in-line `submit` listener: if the student's code didn't stop
  the form submitting, it prevents the reload and says "Your form tried to
  reload the page. End the handler with `return false`."
- answers test requests from `runner.ts`: call a function with arguments,
  type into an input by `name`, submit a form, read an element's text,
  return what was alerted or written. Every request has a 2-second timeout.

**Infinite loops:** before running, `js.ts` adds a guard to every `for`,
`while` and `do … while` body (acorn + acorn-walk). The guard throws after
100,000 iterations with "This loop never stops. Check the condition on
line N." The guard is invisible to the student and removed from downloads.

The preview reruns 600 ms after typing stops (Year 8: 400 ms), and every
rerun starts a fresh runner frame.

### 5.3 Goals, hints and feedback

As in Year 8: goals tick live, up to three hints each, the mascot reacts on
**Check my code**, and feedback names the problem and the fix. New for this
lesson:

- Each goal can show a small spec tag under its text (e.g. "5d JS · output
  by alert box"), from the goal's `spec` field.
- JavaScript feedback quotes what actually happened, e.g. "`checkPassword
  ("hunter22")` returned `undefined`. Did you forget `return score`?"

### 5.4 Given code

The spec says students will not be expected to memorise how input is read
from a form. So code that reads the form (and the `return false` that
stops the reload) is **given**: the level inserts it, and the editor shades
those lines with a "GIVEN" label. The lines end in `// given` in the file;
the editor uses that to draw the shading and hides the comment from view.
Students may edit given lines; nothing locks them.

### 5.5 Console

A collapsible panel under the preview shows, in order: `console.log`
output, `document.write` output, alerts, and errors (red, with "script.js
line N" links that move the editor cursor there).

### 5.6 Save, download, report

- **Download my code** saves `web-app.zip` with the three files (guards and
  `// given` comments removed). The page opens correctly from the unzipped
  folder.
- **Download my report** works as in Year 8, plus: all three files with
  line numbers, and a table of challenge results (Trace: right first time
  or not; Fix: fixed or not; Exam: marks and the student's answer).
- **Start again** asks to confirm, as now.

## 6. Briefs

Before level 1 the student picks one of four briefs. The brief changes the
names, wording and test data; the HTML, CSS and JavaScript taught are the
same for everyone.

| Brief | Function (level 6) | Level 6 behaviour | Level 7 adds |
|---|---|---|---|
| Password checker | `checkPassword(pwd)` | Score 0–2: 8+ characters; contains a digit (loop) | Uppercase check, `switch` for the strength word, array of banned passwords |
| Grade calculator | `getGrade(mark)` | "Pass" if mark ≥ 40, else "Fail" | Array of boundaries with a loop, A*–U |
| Café order | `orderCost(drink, qty)` | Price × quantity for one drink, in pence (avoids floating-point surprises) | Arrays of drinks and prices, search with a loop |
| Unit converter | `convert(value, unit)` | km ↔ miles (8 km = 5 miles, so answers are exact) | `switch` over five units; repeat with `while` until valid |

Each brief in `lesson.json` gives: `id`, `name`, `pitch` (one line),
`title` (the expected page title), `fn` (function name), `inputName` (the
text box `name`), and `tests` per level (§ 11). Text in the lesson can use
`{brief}`, `{fn}` and `{inputName}`.

There is no "other" brief: the JavaScript checks need known test data.

## 7. Task types

Every level has **Build** goals on the student's own app. Most levels also
have one or two **challenges** shown after the Build goals pass. A level is
complete when its Build goals pass **and** each of its challenges has been
attempted. Challenges use small, separate code samples, never the student's
app, so a student's own bugs can't block them.

| Type | Spec verb | Student does | Done when |
|---|---|---|---|
| **Build** | write | Adds to their app | All goals pass |
| **Fix** | amend | Edits broken code in a mini editor; the Console shows the real error | The challenge's checks pass |
| **Trace** | interpret | Types the predicted output, then presses **Run it** | An answer is entered and run; correct first time is recorded |
| **Exam** | read | Writes an answer to an OCR-style question, then ticks the mark scheme points they earned | Answer entered and self-marked |

Rules:

- **Trace:** the expected output is found by running the code in the
  runner, so no answer is stored in the lesson file. Comparison trims
  spaces and ignores case. After a wrong answer, the actual output is
  shown with a prompt to trace it again.
- **Fix:** checks use the same check types as Build. The broken code is
  restored by a **Reset** button.
- **Exam:** the answer box must be non-empty before the mark scheme
  appears. Marks = number of ticked points, capped at the question's marks.
  Answers and marks go in the report. This is an exception to "model
  answers are never shipped": mark schemes are part of the learning here,
  and they only appear after an attempt.

## 8. Levels

| # | Title | Build goals (student's app) | Challenges |
|---|---|---|---|
| 1 | Page skeleton | Doctype, `html`, `head`, `title` naming the brief, `body`, `h1`, `p` | Trace: which text shows on the tab and which on the page |
| 2 | Content and links | `h2`/`h3` sections, `div`, `ul` or `ol` with `li`, `img` with `src`, `alt`, `height`, `width`, `a` with `href` | Fix: `li` outside a list and `img` without `alt` |
| 3 | External stylesheet | Create `style.css`, link it, element rules for `body` and `h1` using `font-family`, `font-size`, `color` (one named, one hex); one inline `style=""` | Trace: inline `style` against a stylesheet rule, which colour wins |
| 4 | Classes and identifiers | `#menu` on the header `div`, `.infoBox` on the result box; `background-color`, `border-style`, `border-width`, `border-color`, `height`, `width` | Fix: `.menu` used for an id; Exam: "Explain the difference between `#menu` and `.infoBox` [2]" |
| 5 | Forms | `form` with an `id`, `input type="text"` with `name="{inputName}"`, `input type="submit"`, an empty `div id="result"` | Fix: input with no `name` |
| 6 | Make it respond | Create `script.js` and load it with `<script>` at the end of `body`; write `{fn}`; output to `#result` with `getElementById` and `innerHTML`; stretch: `alert()` for a bad input | Trace: a `for` loop with `document.write`; Exam: "Write a statement that displays the score in the element with id `result` [2]" |
| 7 | Logic | Brief's level 7 behaviour (§ 6) using selection, `switch`, a loop and an array | Trace: `while` loop with string handling; Pseudocode panel opens on first visit |
| 8 | Debug and amend | A broken version of a different brief's app across all three files: fix five planted bugs (syntax, wrong selector, off-by-one, `getElementByID`, missing `link`) | Exam: "Explain how you found and fixed one error [3]" |
| ★ | Exam boss | No build. A paper of 8–10 unseen items: Trace, Fix and Exam, 25 marks, 30-minute timer shown (not enforced) | All items attempted |

Level 6's full content is in `docs/sixth-form/level-6.example.json`.

## 9. The checker

All Year 8 checks still exist. Source checks gain an optional `file`
(default `index.html`). New checks:

### 9.1 CSS (`css-source.ts`)

Parse `style.css` and every `style=""` attribute with a small rule parser
(selector list, declarations, line numbers). The existing `style` check
(computed style in the static frame) still decides whether the CSS
*works*; these checks decide whether it's written the way the spec means.

| Mistake | Message |
|---|---|
| `.menu` in CSS but `id="menu"` in HTML (or the reverse) | "`#` selects an id, `.` selects a class. Your div has `id="menu"`, so use `#menu`." |
| `<link>` with `href="styles.css"` or a missing `rel` | "Your page links to `styles.css`, but your file is called `style.css`." |
| CSS rules pasted into `index.html` without `<style>` | "That's CSS. Put it in `style.css`." |
| `border-width` without `border-style` | "A border needs `border-style` (e.g. `solid`) to show at all." |
| Hex colour without `#` or with the wrong length | "Hex colours start with # and have 3 or 6 digits, e.g. `#A2441B`." |
| Same id used twice | "An id must be unique on the page. Use a class for repeats." |

### 9.2 JavaScript (`js.ts`, `runner.ts`)

| Mistake | Message |
|---|---|
| Syntax error (acorn) | Line and a plain-English cause: missing `)`, `}` or quote |
| `getElementByID`, `getElementbyId`, `innerHtml` | "JavaScript is case-sensitive: `getElementById`, `innerHTML`." |
| `getElementById("#result")` | "`getElementById` takes the id without the `#`." |
| `getElementById` returns null at runtime | "There is no element with `id="result"` in index.html." |
| Function never returns | "`{fn}(…)` returned `undefined`. Did you forget `return`?" |
| `=` used in an `if` condition | "`=` stores a value. To compare, use `==` or `===`." |
| Form reloads the page | See § 5.2 |
| Script in `head` runs before the form exists | "Your script runs before the page is built. Move `<script>` to the end of `body`." |
| Infinite loop | See § 5.2 |
| Comparing the text box value as a number without converting | "Values from a text box are strings. Use `Number(…)` before comparing." |

Write Vitest tests for every check and every mistake in both tables, as
Year 8 does. Runner tests use jsdom for the harness logic and Playwright
for one end-to-end run of level 6.

## 10. Accessibility and safety

As Year 8, plus:

- The alert box drawn over the preview is a real dialog element: it takes
  focus, and Enter or Esc closes it.
- Console messages are announced through the existing `aria-live` region,
  errors first.
- No network from student code: the runner page gets a
  `Content-Security-Policy` meta of `default-src 'none'; img-src data:
  https: 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'`.
  `fetch` and form submission to other sites therefore fail, with a
  message.

## 11. Content format

`lesson-schema.ts` changes. All new fields are optional, so the Year 8
lesson validates unchanged.

**Lesson:** `hobbies` becomes optional; new optional `briefs[]` (§ 6) and
`files` (default `["index.html"]`). Exactly one of `hobbies` or `briefs`
must be present.

**Level:** new optional fields:

- `addFiles`: `{ "style.css": "…starter…" }`, created when the level
  starts if the file doesn't exist.
- `given`: snippets appended to a file once, when the level starts:
  `[{ "file": "script.js", "code": "…" }]`. Lines end in `// given`.
- `challenges[]`: see below.

**Goal:** new optional `spec` (short text under the goal) and `stretch`
(true: not needed to complete the level).

**Brief tests:** `briefs[].tests` is keyed by level, each a list of
`{ "args": [...], "returns": … }` or `{ "input": "…", "expect": "…" }`.
The `js-call` and `js-event` checks with `"tests": "brief"` use these.

**New check types:**

| type | fields |
|---|---|
| `file-exists` | `file` |
| `links-file` | `file` (checks the `link` or `script` tag in index.html that loads it) |
| `css-rule` | `selector`, optional `property` (rule exists in style.css with that property) |
| `inline-style` | `selector`, `property` (element has it in a `style=""` attribute) |
| `js-syntax` | `file` |
| `js-defines` | `name`, optional `params` (top-level function) |
| `js-uses` | `construct`: `for` / `while` / `doWhile` / `if` / `switch` / `array` / `getElementById` / `innerHTML` / `alert` / `documentWrite` / `stringLength` / `substring` |
| `js-no-error` | none (no uncaught error on load or on submit) |
| `js-call` | `fn`, `tests` (list, or `"brief"`) |
| `js-event` | `form`, `tests` (list, or `"brief"`), `expect`: `innerHTML` with `selector`, or `alert`, or `write` |

**Challenge:**

```json
{
  "type": "trace" | "fix" | "exam",
  "title": "…",
  "spec": "…",
  "files": { "index.html": "…", "script.js": "…" },
  "checks": [ … ],             // fix only
  "question": "…",              // exam only
  "marks": 2,                   // exam only
  "markScheme": ["…", "…"]      // exam only
}
```

## 12. Build phases

1. Schema extension with Year 8 lesson still valid; three-file project and
   tabs; assembled static preview (no scripts yet).
2. CSS source checks with tests.
3. Runner frame, harness, loop guard, Console, drawn alert box.
4. JavaScript checks with tests.
5. Brief picker, given code shading, zip download, report additions.
6. Challenges (Fix, Trace, Exam) and the boss level.
7. Lesson content for levels 1–8 and the boss; Sixth Form help page with
   the Appendix 5d coverage grid and pseudocode panel.
8. Accessibility pass, Year 8 regression check, deploy.

## 13. Done when

- A student can build their brief's app from an empty file to a working
  app, levels 1–8, using only the site.
- Every Appendix 5d item in § 1 is taught in a named level and checked by
  at least one goal.
- Every mistake in § 9 produces its message (tested).
- A `while (true) {}` in a student's script shows the loop message and
  leaves the site usable.
- Student code cannot read the site's `localStorage` (tested).
- The downloaded zip opens and works from a folder in Chrome and Edge.
- The Year 8 lesson passes all its existing tests unchanged.
- `#level-N` and `#boss` deep links work; 1366×768 and keyboard-only work.

## 14. Open questions for Mr Gordon

- Are four 60-minute lessons plus homework right, or should this be spread
  across a longer unit with the theory lessons on web technologies?
- Are the four briefs the right ones?
- Should the boss paper's timer be enforced?
- Should challenges be required to finish a level (as written) or optional?
- Confirm the JavaScript structures list against the current H446
  pseudocode guide (level 7).
