# Importing DCML corpora

The library can import pieces from the annotated corpora of the [DCML](https://github.com/DCMLab/dcml_corpora)
(Digital and Cognitive Musicology Lab), for example the Mozart piano sonatas or the Beethoven sonatas. Nothing is
interpreted beyond what the tables say; whatever you do not want can be switched off before importing, and everything
imported is an ordinary piece you can edit afterwards.

## Where the data comes from

- **A corpus on GitHub:** a link such as `https://github.com/DCMLab/mozart_piano_sonatas`, a link to a branch, tag or
  commit (`…/tree/ad4a9df…`, recommended for citing: the data stays exactly the one you used), `DCMLab/ABC@v2.0`, or a
  corpus chosen from the collection's list. The app reads `metadata.tsv` for the list of pieces and then
  `harmonies/<piece>.harmonies.tsv` and `measures/<piece>.measures.tsv` straight from `raw.githubusercontent.com` in
  your browser (no server of ours is involved).
- **Files from your device:** the `harmonies` and `measures` tables of a piece (and optionally `metadata.tsv`).

## What becomes what

| In the tables | In the piece |
|---|---|
| `globalkey` (+ `localkey`, a roman numeral counted from the global tonic, case = mode) | the key path: one stretch per local key, from the bar and beat of the label where it changes; the home key is the global key |
| `mc`, `mc_onset`, `act_dur`, `mc_offset` | bar and beat positions; an anacrusis is bar 0, the two halves of a bar split by a repeat share one bar |
| `next` (jumps back) | repeat signs (start and end) |
| `volta` | numbered endings |
| `timesig`, `keysig` | meter and key-signature changes (the first time signature is always taken) |
| `barline` (`double`, `end`) | double and final bar lines |
| `relativeroot` + `numeral` | optional: applied chords as dashed stretches in the key they point at (`V` and `vii` → dominant, other → tonicisation) |
| `cadence` | optional: a marker with the label (PAC, HC …) |
| `metadata.tsv` | composer, title, movement, catalogue number, year; source, annotators and a licence note in the notes |

Not in these corpora, so not imported: sections of the form (exposition, development …). Add them in the *Aufbau*
tab.

## Things to know

- **Local keys:** in a minor global key the degrees are those of the natural minor scale (`III` is the relative major,
  `VI` the major key a minor sixth above, `VII` the one a minor seventh above); `#`/`b` raise/lower by a semitone.
  Chains of applied chords (`V/V`) are resolved from the right.
- **Bar numbers** follow the physical measures (`mc`). After numbered endings the printed numbers (`mn`) are lower than
  the bars in the chart, because the second ending is printed with the number of the first. The import says so.
- A label lasts until the next label; the last one until the end of the piece, and the first key stretch starts with the
  piece even if the first label comes later.
- **Licence:** the data belongs to the corpus and has its licence (CC BY-NC-SA 4.0 for the Mozart sonatas). Cite the
  corpus when you publish; the piece's source field contains the repository and the commit.
