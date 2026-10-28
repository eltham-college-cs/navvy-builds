# Na<>y Builds: build specification

## 1. Brief

- **Release 1:** one lesson, "My hobby page", for **Year 8** as a recap of Year 7 HTML.
- **Later:** expanded into a multi-week unit for the current Year 7. The content
  model must allow more lessons and per-year themes without code changes.
- **How it is used:** the teacher's slide deck covers recall and teaching, then
  signposts students to this site. Students build one web page about their own
  hobby, one level at a time, with automatic feedback.

### Content covered

| HTML | CSS (internal, in `<head>`) |
|---|---|
| `<!DOCTYPE html>`, `html`, `head`, `title`, `body` | `<style>` element in `head` |
| `h1`–`h6` | Selectors: element names (`body`, `h1`, `p`, `li`, `a`) |
| `p` | `color`, `background-color` |
| `ul`, `ol`, `li` | `font-family`, `font-size` |
| `a` with `href` | `text-align` |
| `img` with `src`, `alt` (and `width`) | Rule syntax: `selector { property: value; }` |

### The 60-minute lesson

| Time | Where | What |
|---|---|---|
| 0–10 | Slides | Recall quiz on Year 7 HTML |
| 10–25 | Slides | Teaching: page structure, then CSS basics |
| 25–28 | Slides → site | Signpost: short URL and QR code to the site |
| 28–55 | Site | Levels 1–7 (about 4 minutes each), boss level for those who finish |
| 55–60 | Slides | Plenary; students download their page |

Most students should reach level 5; strong students level 7 and the boss level.
Progress is saved, so the page can be finished at home.

## 2. Site map

```
/                         Home: logo scene, "Start building" button, lesson list
/lessons/my-hobby-page/   Lesson intro: choose your hobby, then level map
/lessons/my-hobby-page/play/#level-3     Builder at a given level (deep-linkable)
/help/                    Tag and property cheat sheet, common mistakes
```

Deep links matter: the teacher can put `…/play/#level-5` on a slide.
Base path: `https://eltham-college-cs.github.io/navvy-builds/`; use
`import.meta.env.BASE_URL` for all internal links and assets.

## 3. Repository layout

```
navvy-builds/
├── CLAUDE.md
├── docs/SPEC.md
├── design/                       reference only
├── src/
│   ├── content.config.ts         zod schemas for lessons
│   ├── content/lessons/01-my-hobby-page/lesson.json
│   ├── components/
│   │   ├── LogoScene.astro       sky, clouds, ground, mascot, </> block, title
│   │   ├── LevelMap.astro        row of level blocks: locked, current, done
│   │   ├── HobbyPicker.astro
│   │   ├── Builder.astro         editor + preview + checks + feedback
│   │   ├── Editor.ts             CodeMirror 6 setup (HTML mode, CSS inside <style>)
│   │   ├── Preview.astro         fake browser frame showing <title> on a tab
│   │   ├── ChecklistPanel.astro  the level's goals, ticking as they pass
│   │   ├── Mascot.astro          pixel mascot, moods idle | happy | tryagain
│   │   └── Celebrate.ts          pixel coin/particle burst on level complete
│   ├── checker/
│   │   ├── run.ts                runs a level's checks, returns results
│   │   ├── dom.ts                structure, text, attribute checks
│   │   ├── style.ts              computed style checks from the preview iframe
│   │   ├── source.ts             raw-source checks (doctype, tags, CSS syntax)
│   │   └── *.test.ts
│   ├── styles/theme.css
│   └── pages/ …
├── public/images/hobbies/        image library students can use (§ 7)
└── .github/workflows/deploy.yml
```

## 4. Look and feel

Reference: `design/navvy-builds-logo.dc.html` (top section, "Navvy Builds").

- Retro platform-game style in Eltham navy and gold: sky blue `#7CC4F2`,
  navy `#0A1B2E` / `#163351`, gold `#F2B533` with bevel shades `#B07D12` /
  `#FFE08A`, green `#1F9D5C`, blue `#2F7DD1`, page `#FBFAF5`.
- Blocks have a 4px navy border and inset bevel shadows, like the `</>` block.
- Fonts: Press Start 2P for the logo, level titles and badges; Lexend for all
  reading text (18px body, Year 8 size); JetBrains Mono in the editor (16px).
  Self-host the fonts with `@fontsource`.
- The name is written "Na<>y Builds" ("NA<>Y BUILDS" in Press Start 2P). The logo is a gold pixel cube with `</>` on its front face (`src/lib/cube.ts`): it appears in the header, the home scene and as the favicon.
- Motion is pixel-stepped (`steps()`), short, and only in response to actions,
  apart from the home page scene. Reduced motion shows end states only.

**Mascot:** the pixel snake from the logo, with three moods matching the Python
site: `idle`, `happy` (level complete) and `tryagain` (checks failing). The
mascot's name and whether it wears a builder's hard hat are still to be
decided: keep the name in one config value (`mascot.name`).

## 5. The builder screen

```
┌ header: </> NAVVY BUILDS · My hobby page · level blocks 1–7 + boss ┐
├──────────────── goals ───────────────┬────────────── preview ───────┤
│ Level 4: Lists                       │ ┌ tab: <title text> ───────┐ │
│ ☑ Add a ul with 3+ things you need  │ │                          │ │
│ ☐ Add an ol of your top 3            │ │  live page               │ │
│ [Hint]                               │ │                          │ │
├──────────── editor (HTML) ───────────┤ └──────────────────────────┘ │
│ <!DOCTYPE html> …                    │ mascot + feedback message    │
│                                      │ [Check my page]  [Next ▶]   │
└──────────────────────────────────────┴──────────────────────────────┘
```

- **One page that grows.** The code carries forward from level to level; each
  level adds to the same file. A student can jump back to any completed level.
- **Preview** updates 400 ms after typing stops. It is drawn inside a fake
  browser frame whose tab shows the page's `<title>`, so students see the
  difference between `title` and `h1`.
- **Goals** list the level's checks in plain English. Goals tick live as the
  student types, so they get feedback continuously; pressing **Check my page**
  plays the mascot reaction and, when everything passes, unlocks the next level
  with a celebration.
- **Hints:** each goal has up to three hints, shown one at a time.
- **Feedback** names the problem and the fix, never just "wrong".
  Highlight the related element in the preview with an outline when relevant.
- **Save:** code, hobby and level progress go to `localStorage` on every change.
  **Download my page** saves `my-hobby-page.html`. **Start again** asks to
  confirm first.
- **Report:** **Download my report** asks for the student's name (used only in
  the PDF, never saved) and downloads `my-hobby-page-report-<name>.pdf`, made in
  the browser: a summary of every level (goals passing now, cleared or not), a
  picture of the page laid out at 1000px wide, and all the code with line
  numbers. Students upload it to their Teams assignment themselves. Pictures
  from other websites may be missing from the picture, and the PDF says so.

## 6. Hobby personalisation

Before level 1 the student picks a hobby from tiles (football, gaming, music,
art, cooking, dance, reading, animals, swimming, other) or types their own.
The hobby is used to:

- fill the starter comments and hint examples ("e.g. <h1>My love of football</h1>"),
- suggest images from the library (§ 7),
- check that the `h1` and `title` mention the hobby (case-insensitive, word
  match). For "other", that check accepts any text.

## 7. Images

School networks may block external images, so ship an image library:
`public/images/hobbies/<hobby>-1.png` … `-3.png` (pixel-art style, 400×300,
copyright-free or made for the site). The builder shows the student's hobby images
with a **Copy path** button, e.g. `images/football-1.png`. Make the preview
resolve these relative paths (inject `<base href>` into the preview only;
strip it from the downloaded file). External `https://` images are also allowed.

## 8. Levels

Defined in `lesson.json` (§ 11). Summary:

| # | Title | Student does | Teaches |
|---|---|---|---|
| 1 | Foundations | Doctype, `html`, `head`, `title`, `body` | Page skeleton |
| 2 | Headings | `h1` with hobby, two `h2` sections, one `h3` | Heading levels, one `h1` |
| 3 | Paragraphs | Two or more `p` with real sentences | Text content |
| 4 | Lists | `ul` of equipment, `ol` of top 3 | Ordered vs unordered, `li` inside lists |
| 5 | Links | `a` to a website about the hobby | `href`, `https://`, clear link text |
| 6 | Images | `img` with `src` and a useful `alt` | Alt text and why it matters |
| 7 | Style it | `<style>` in `head`; colour, background, font, size, alignment | CSS rules and syntax |
| ★ | Boss level | Use `h4`–`h6` correctly, style `li` and `a`, keep everything passing | Extension |

The starter for level 1 is an empty file with one comment. Students type the
skeleton themselves, because this is a recap.

## 9. The checker

Runs entirely in the browser after each edit (debounced) and on **Check my page**.

**Three kinds of check:**

1. **Source checks** (`source.ts`) on the raw text, because the browser silently
   repairs broken HTML:
   - doctype present and first;
   - each listed element opened and closed correctly, in order (a small tag-balance
     scanner that understands void elements like `img`);
   - `title` and `style` inside `head`; content inside `body`;
   - `</img>` flagged as unnecessary;
   - CSS syntax inside `<style>`: missing `{`, `}`, `:` or `;`.
2. **Structure checks** (`dom.ts`) on `DOMParser` output: element exists, count,
   parent/child (`li` inside `ul`/`ol`), text not empty, text contains hobby,
   attribute present and not empty, heading order, exactly one `h1`.
3. **Style checks** (`style.ts`) using `getComputedStyle` on the preview iframe's
   elements: compare against the value's resolved form, or "changed from the
   browser default" for open-ended goals (e.g. "give your h1 a colour").

**Targeted mistake detection** (each has a friendly message):

| Mistake | Message idea |
|---|---|
| `colour` / `background-colour` / `centre` | "CSS uses American spelling: color, center." |
| Unknown property (`font-szie`) | "Did you mean font-size?" (closest known property) |
| `title` text but no `h1`, or the reverse | "The title shows on the tab. The h1 shows on the page." |
| `<head>` used as a page header | "head holds information about the page. Put visible content in body." |
| `li` outside a list | "Every li needs to sit inside a ul or ol." |
| `href` without `https://` | "Web addresses need https:// at the start." |
| Link text "click here" / "here" | "Say where the link goes, e.g. 'Visit the FA website'." |
| `alt` missing, empty, or "image" / file name | "Describe the picture for someone who can't see it." |
| More than one `h1` | "A page has one h1, like a book has one title." |
| Heading skips (h2 → h4) | "Go down one level at a time." |
| Missing `;` between declarations | Point to the line. |

**Results** feed the goals list, the mascot mood, and the preview outline.
Write Vitest tests for every check and every mistake in the table, using
correct and broken sample pages.

## 10. Accessibility and safety

- The editor is fully keyboard usable; Tab inserts spaces only when the
  editor is focused, and Esc leaves the editor (announce this on screen).
- Results are announced via `aria-live="polite"`.
- Student HTML is never run as script: no `allow-scripts` on the iframe, and
  strip `<script>` and `on*` attributes before rendering the preview, with a
  gentle message if found.

## 11. Content format

`lesson.json` is validated by zod. Each level has `id`, `title`, `intro`,
`goals[]`. Each goal has `text` (shown to students), `checks[]` (all must pass)
and `hints[]`. Check types:

| type | fields |
|---|---|
| `source-doctype` | none |
| `source-balanced` | `tags[]` |
| `source-inside` | `tag`, `parent` |
| `exists` | `selector` |
| `count` | `selector`, `min` and/or `max` |
| `text` | `selector`, `notEmpty` / `containsHobby` / `minWords` |
| `attr` | `selector`, `attr`, `notEmpty` / `startsWith` / `notOneOf[]` |
| `headingOrder` | none |
| `style` | `selector`, `property`, `notDefault` or `equals` |
| `css-syntax` | none |
| `allPrevious` | none (boss level: every earlier goal still passes) |

Notes: in `text` checks, `selector@attr` reads an attribute's text (e.g. `img@alt`).
In `attr` checks, `textContent` means the element's visible text. `parent` may list
alternatives with `|` (e.g. `ul|ol`). Text comparisons are case-insensitive and trimmed.

`{hobby}` in any text is replaced with the student's hobby.

## 12. Build phases

1. Scaffold Astro, theme, header, home page with the logo scene.
2. Builder layout: editor, preview frame with title tab, save and download.
3. Checker (`source`, `dom`, `style`) with full tests.
4. Goals list, hints, mascot moods, level unlock and celebration.
5. Hobby picker, image library and path copying, hobby-aware checks and hints.
6. Lesson 1 content wired from `lesson.json`; level map and deep links.
7. Help page, accessibility pass, deploy.

## 13. Done when

- A student can go from an empty file to a styled hobby page, levels 1–7,
  using only the site, with every goal ticking correctly.
- Each mistake in § 9 produces its message (tested).
- Reloading keeps progress; the downloaded file opens correctly in a browser.
- `#level-N` links open the right level (locked levels open the level map).
- Works at 1366×768 and with keyboard only; reduced motion respected.

## 14. Open questions for Mr Gordon

- The mascot's name, and whether it should wear a hard hat in this site.
- Should students submit their page anywhere (e.g. upload the downloaded file
  to Teams or CodeBash), and if so, which?
- The final short URL for the slide signpost.
