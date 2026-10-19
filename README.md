# Tonartenverlauf

Web app for drawing key-plan charts of a piece of music: which keys are reached in which bars, and how far
they sit from the home key on the circle of fifths. Runs entirely in the browser; data is stored in
`localStorage` and can be saved to / loaded from `.tonart.json` files.

Workflow (four tabs): **Bibliothek** (new / open / import) → **Stück** (title, composer, year, home key …) →
**Analyse** (enter the modulations) → **Export** (appearance, SVG, PNG, project file).

## Quick entry syntax

```
1-9 c          c minor from bar 1 until the next stretch starts in bar 9
9-11 >As       secondary dominant aiming at A-flat major (dashed)
41-42.5 f      half bars allowed
// comment
```

Capital letter = major, lower case = minor (`Es`, `c`, `Fis`, `b` = B-flat minor); `Cm`, `A-Dur`, `F# minor` also work.
German note names by default (B = B-flat, H = B); switch to English under Export → Beschriftung.

## Development

```bash
npm install
npm run dev      # dev server
npm test         # unit tests (keys, parser, renderer)
npm run check    # svelte-check / TypeScript
npm run build    # static site in dist/
```

## Structure

```
src/lib/domain/      data model, key theory + parser, quick-entry text format, example piece (pure TS, tested)
src/lib/render/      SVG chart renderer, palettes, chart labels (pure function: Piece -> SVG string)
src/lib/export/      SVG / PNG / project-file download and import
src/lib/stores/      app state (Svelte 5 runes), localStorage persistence, undo history
src/lib/i18n/        UI strings (de, en)
src/lib/components/  views (Library, Piece, Analysis, Export) and editors
```

The preview, library thumbnails and all exports use the same `renderChart()`, so what you see is what you export.
PNG export rasterises the SVG in the browser using system fonts.

## Publishing on GitHub Pages

1. Push to the `main` branch (merge this branch first).
2. In the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. `.github/workflows/deploy.yml` checks, tests, builds and deploys on every push to `main`
   (or run it manually under **Actions**). The site appears at `https://<user>.github.io/<repo>/`.

The build uses a relative base path, so it works under any repository name.
