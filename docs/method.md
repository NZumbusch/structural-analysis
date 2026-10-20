# Method notes

What the chart and the statistics do, in the terms a methods section would use. The app can write a short version of
this for you (Export → Bildunterschrift & Methode).

## The chart

- Every stretch of music is a bar in the row of its key. Minor keys sit in the row of their relative major, so
  E♭ major and c minor share a row. Rows are ordered by the fifths from the home key: sharp side up, flat side down.
- A dashed outline marks a **tonicisation** of the key it points at (secondary dominant, secondary leading-tone chord,
  Neapolitan, other). Circles are **passing chords** that do not establish a key. Vertical lines join consecutive
  stretches where the key changes.
- Positions are bars. `to` of a stretch is the bar where the next one begins (exclusive).

## Distance and statistics

- "Distance" is counted in the unit chosen under Auswertung → Optionen & Methode (see `analysis-format.md`). The chart's
  right-hand column always shows the distance of the *rows*.
- Time shares refer to the **analysed bars**: stretches are counted once (overlaps are resolved in favour of the earlier
  one) and bars without any key are left out. The check panel lists such cases.
- Tonicisations count towards the key they aim at and are reported separately.
- A **modulation** is a change of key between consecutive established stretches; tonicisations in between do not
  count as keys. A **visit** is one run of established stretches in the same key.
- Repeats are counted once by default; "count repeats" lays the piece out in play order first.

## Reproducibility

Exported SVG, PDF and PNG files carry the app version and the export date (and, if filled in, source and analyst) in
their metadata. The project file stores the complete analysis and settings; the analysis JSON stores the data only.
