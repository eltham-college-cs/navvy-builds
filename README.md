# Na<>y Builds

HTML and CSS practice for Eltham College. Year 8 students build a page about
their hobby, level by level, with live preview and friendly automatic checks.
Sixth Form students (OCR H446) build a small web app across index.html,
style.css and script.js, with Fix, Trace and Exam challenges.
See `CLAUDE.md`, `docs/SPEC.md` and `docs/SPEC-SIXTH-FORM.md`.

```
npm install
npm run dev      # http://localhost:4321/navvy-builds/
npm test         # checker tests (Vitest)
npm run check    # type check
npm run build    # static site in dist/
npm run images   # redraw the hobby image library
```

## Where things live

- `src/content/lessons/*/lesson.json`: lesson content. A new folder is a new lesson,
  with its own pages, no code changes needed.
- `src/lesson-schema.ts`: the zod schema every lesson is validated against.
- `src/checker/`: source, structure and style checks, with tests. Sixth Form:
  `files.ts` (the three files), `css-source.ts`, `js.ts`, `webapp.ts`, and
  `harness.ts` / `runner.ts` for running student JavaScript safely.
- `src/lib/web-builder.ts`: the Sixth Form builder screen.
- `src/lib/builder.ts`: the builder screen behaviour.
- `src/config.ts`: the mascot's name and other undecided settings.
- `scripts/make-images.mjs`: draws `public/images/hobbies/*.png` (pixel art made for the site).

## Deploying

Push to `main`. `.github/workflows/deploy.yml` tests, builds and publishes to
GitHub Pages at `https://eltham-college-cs.github.io/navvy-builds/`. In the repo's
settings, set Pages to deploy from GitHub Actions.
