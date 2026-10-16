# Na<>y Builds

HTML and CSS practice for Eltham College. Students build a page about their
hobby, level by level, with live preview and friendly automatic checks.
See `CLAUDE.md` and `docs/SPEC.md`.

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
- `src/checker/`: source, structure and style checks, with tests.
- `src/lib/builder.ts`: the builder screen behaviour.
- `src/config.ts`: the mascot's name and other undecided settings.
- `scripts/make-images.mjs`: draws `public/images/hobbies/*.png` (pixel art made for the site).

## Deploying

Push to `main`. `.github/workflows/deploy.yml` tests, builds and publishes to
GitHub Pages at `https://eltham-college-cs.github.io/navvy-builds/`. In the repo's
settings, set Pages to deploy from GitHub Actions.
