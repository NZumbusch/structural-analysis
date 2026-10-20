import { DEFAULT_STYLE, cloneStyle, createPiece } from './piece';
import { parseSegments } from './segments-text';
import { parseKey } from './keys';
import { newId } from './ids';
import { makeEvent } from './structure';
import type { Piece } from './types';

const SEGMENTS = `
// Exposition
1-9 c
9-11 >As
11-13 As
13-14 >B
14-26 B
26-41 Es
// Durchführung: Variation des 1. Themas
41-42.5 f
42.5-43 >Es
43-44 Es
44-44.5 >As
44.5-45.5 As
45.5-46 >Des
46-46.5 Des
46.5-47 >b
// Durchführung: Modulationskette
47-51 b
51-53 Des
53-57 es
57-59 as
59-61 Ges
61-62 >Es
62-63 Es
63-64 c
64-65 >g
65-66 g
// Überleitung zur Reprise
66-67 >d
67-68 d
68-69 >c
// Reprise
69-73 c
73-74 Es
77-86 c
86-88 >F
88-90 F
90-91 >G
91-103 G
103-121 c
`;

/** Haydn, Piano Sonata in C minor, 1st movement — the analysis the original script drew. */
export function createExample(): Piece {
  const names = 'de';
  const key = (s: string) => parseKey(s, names)!;
  const style = cloneStyle(DEFAULT_STYLE);
  return createPiece(
    {
      meta: {
        title: 'Klaviersonate c-Moll',
        composer: 'Haydn',
        year: '1771',
        catalog: 'Hob. XVI:20',
        movement: '1. Satz',
        center: key('c'),
        meter: { beats: 4, unit: 4 },
        pickup: 0,
        distanceMeasure: 'rows',
        subtitle: '',
        lastBar: 120,
        notes: '',
      },
      segments: parseSegments(SEGMENTS, names, { beats: 4, unit: 4 }).segments,
      passing: [
        { id: newId(), pos: 74.5, key: key('D') },
        { id: newId(), pos: 75.5, key: key('C') },
        { id: newId(), pos: 76.5, key: key('B') },
      ],
      annotations: [
        { id: newId(), pos: 59, key: key('as'), text: 'as-Moll · 4 Quinten', align: 'left', dx: 0, dy: 0, hidden: false },
        { id: newId(), pos: 77, key: key('D'), text: 'chromatische Terzfolge · D-Dur: 5 Quinten', align: 'left', dx: 0, dy: 0, hidden: false },
      ],
      events: [
        makeEvent('section', 1, { name: 'Exposition' }),
        makeEvent('section', 38, { name: 'Durchführung', shade: true }),
        makeEvent('section', 69, { name: 'Reprise' }),
      ],
    },
    style,
  );
}
