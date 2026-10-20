# Analysis JSON format

"Analysis as JSON" (Export → Daten) writes the harmonic analysis without any chart settings, so it can be reused in
other tools or attached to a paper. The project file (`*.tonart.json`) is a different thing: it holds everything needed to
keep editing in the app, including appearance settings.

```jsonc
{
  "format": "tonartenverlauf-analysis",
  "version": 1,
  "generator": { "name": "Tonartenverlauf", "version": "1.1.0" },
  "exportedAt": "2026-10-20T08:00:00.000Z",
  "work": { "composer": "", "title": "", "movement": "", "catalog": "", "year": "",
            "source": "", "analyst": "", "analysisDate": "" },
  "conventions": {
    "noteNames": "de",                 // "de" (H, B, Es) or "en" (B, Bb, Eb) – how key names are spelled
    "positions": "…",                  // human-readable reminder, see below
    "rows": "…",
    "distanceMeasure": "rows"          // "rows" | "tonic" | "steps"
  },
  "homeKey": { "name": "c", "fifths": 0, "mode": "minor", "row": -3 },
  "meter": { "beats": 4, "unit": 4 },  // default time signature (meter events below override it)
  "pickupBeats": 0,
  "bars": 120,
  "segments": [
    { "from": 1, "to": 9,              // positions in bars, `to` exclusive
      "key": { "name": "c", "fifths": 0, "mode": "minor", "row": -3, "distance": 0 },
      "kind": "key",                   // "key" | "dominant" | "leading" | "neapolitan" | "tonicization"
      "label": "" }
  ],
  "passingChords": [ { "pos": 74.5, "key": { /* as above */ } } ],
  "annotations": [ { "pos": 59, "key": { /* name, fifths, mode, row */ }, "text": "…" } ],
  "events": [ { "kind": "section", "pos": 1, "name": "Exposition" } ],
  "summary": { "analysedBars": 117, "distinctKeys": 14, "modulations": 22, "maxDistance": 4,
               "meanDistance": 1.09, "shareAtDistance0": 0.517, "shareInExactHomeKey": 0.35,
               "majorShare": 0.513, "minorShare": 0.487 }
}
```

## Conventions

- **Positions** are measured in bars. `1` is the start of bar 1, `42.5` the middle of bar 42 (a position
  written `42:3` in the app is beat 3 of bar 42 in the meter valid there). An anacrusis is bar 0: its last beat before
  bar 1 is at a position just below 1. **End positions are exclusive**: a stretch `1`–`9` covers bars 1 to 8.
- **Keys** are given by `fifths` (position of the tonic on the circle of fifths counted from C: F = −1, C = 0, G = 1 …,
  sharps positive, flats negative) and `mode` (`major`/`minor`). `row` is the row of the chart: the fifths position of the
  *relative major*, so E♭ major and c minor both have row −3. `name` is the spelled name (German or English per
  `conventions.noteNames`).
- **distance** is measured from the home key in the unit of `conventions.distanceMeasure`:
  `rows` – fifths between chart rows (relative keys 0 apart, same-tonic keys 3 apart);
  `tonic` – fifths between tonics (same-tonic keys 0 apart, relative keys 3 apart);
  `steps` – fewest steps over the relations fifth, relative key and same-tonic key (one step each).
- **kind**: `key` is an established key; the others are tonicisations of `key` drawn dashed (secondary dominant,
  secondary leading-tone chord, Neapolitan, other).
- **events** use `kind` of `meter` (`beats`, `unit`), `repeat-start`, `repeat-end` (`times`), `volta` (`to`, `endings`),
  `section`/`subsection` (`name`), `marker`/`text` (`label`), `barline` (`style`), `keysig` (`fifths`), `fermata`.
  A repeat sign "after bar 8" has position 9.
