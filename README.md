# Tonartenverlauf

Web app for drawing key-plan charts of a piece of music: which keys are reached in which bars, and how far
they sit from the home key on the circle of fifths. Runs entirely in the browser; data is stored in
`localStorage` and can be saved to / loaded from `.tonart.json` files.

Workflow: **Bibliothek** (new / open / import) → **Stück** (title, composer, year, home key …) →
**Aufbau** (bars, meter, repeats, sections) → **Analyse** (enter the modulations) → **Auswertung** (statistics) →
**Export** (appearance, SVG, PNG, project file).

## Quick entry syntax

```
1-9 c          c minor from bar 1 until the next stretch starts in bar 9
9-11 >As       secondary dominant aiming at A-flat major (dashed)
41-42:3 f      positions can be beats: bar 42, beat 3 (= 42.5 in 4/4); 42:2.5 is the "and" of beat 2
44-45 As "V7"  optional text on the bar
// comment
```

Set the time signature under **Stück** so beat positions and the beat grid are right.

## Features

- **Aufbau (score setup):** a MuseScore-style measure grid without notes. Select bars, then add events from the
  palette: time-signature changes, repeats, 1st/2nd endings, parts of the form (with sub-parts, e.g.
  Exposition → Thema 1) and other markers (rehearsal letters, text, barlines, key signatures, fermatas). Bars can be
  inserted or deleted anywhere (everything after them moves). Anacrusis counts as bar 0. Repeats are drawn as signs
  or written out in play order (setting); statistics can count repeated bars once or twice.

- **Views (Ausschnitte):** named zooms of a bar range, with bar/beat grid, rows fitted to what is visible; pick one in
  the preview, export one or all (ZIP).
- **Edit in the preview:** click to select (the editor row lights up), drag bar edges (neighbours follow, Alt holds
  them), passing chords and annotations; snaps to bar / beat / half beat. Del removes the selection.
- Annotations (global and per-item hide, nudge with a leader line), bar markers, text on bars.
- Row spelling (flats / sharps for the outer rows, or per-row labels), colour-blind-safe palette.
- Export: SVG (optional physical width in cm), PNG (scale or cm + dpi), PDF via the print dialog (vector),
  clipboard, native share sheet, project file, share link (deflate-compressed, ~1.6 kB for 120 bars).
- **Auswertung (statistics):** summary figures, time per key, distribution by distance from the centre, distance
  over time, per-section comparison and a modulation list; every chart exports as SVG/PNG, every table as CSV
  (Excel-friendly) or to the clipboard.
- **Prüfung (data check):** lists overlaps, gaps, stretches outside the piece, unmatched repeats and similar problems,
  each with a jump-to link and a one-click fix; a badge on the tab shows how many there are.
- **Distance measure** (Auswertung → Optionen & Methode): the statistics can count distance as fifths of the chart
  rows (default; relative keys share a row), fifths of the tonics (same-tonic keys are 0 apart), or the fewest steps
  over fifth / relative / same-tonic relations. The chart's rows always use the first. A caption and a method note
  describing the conventions are generated under Export → Bildunterschrift & Methode.
- **Fonts and PDF:** the charts use bundled open fonts (Inter, Source Serif 4, JetBrains Mono; SIL OFL). SVG and PNG
  embed the font, so figures look the same everywhere; "text to outlines" is available for journals that ask for it.
  PDF is written by the app itself (vector, TrueType fonts embedded, selectable text, page size = chart size or the
  chosen width in cm). Accidentals are drawn shapes because the fonts have no ♭ ♯ ♮.
- **Print helpers:** optional hatching for minor (black-and-white print), a "target label size in pt" fit for a given
  figure width, CMYK values for the palette (rough conversion, no colour profile), and an alt text that is written
  into the SVG.
- Works offline once opened (service worker); installable on phones.

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
src/lib/export/      SVG / PNG / PDF / ZIP, project files, share links
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
