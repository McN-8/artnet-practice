# Editor System

**Status:** Product design and backlog. Implementation facts are governed by [TECHNICAL_SPEC.md](TECHNICAL_SPEC.md).

## Creator flow

The simplest path is import pages, order them, preview, and publish. Advanced controls appear when the creator asks for them. Direct manipulation, fast preview, undo, and clear visual feedback should make creation feel rewarding. Draw inspiration from Super Mario Maker's playful placement and stacking, with optional small sounds, button squish, and Easter eggs that confirm actions rather than demand attention.

## Near-term editor backlog

- Provide an editing grid that can be shown, hidden, and adjusted. Offer optional guides for shared X/Y edges, centers, widths, and heights.
- Keep snapping non-invasive: visible guide/preview, reversible placement, and a temporary way to loosen or bypass snapping while dragging. Never silently override deliberate placement.
- Explore a brief, editable handedness preference. During touch drag, place one or two relevant contextual controls near the drag contact and within reach of the other fingers; mirror placement for left and right hands and avoid covering the object. Keyboard and pointer equivalents are required.
- Provide object and sticker transforms: non-destructive crop, flip, stretch/deform, opacity, filters, outlines with thickness/color, layering, grouping, cut/trim, and region-based growth/shrink with size and speed limits. Confirm which existing primitives cover each behavior before building UI.
- Make traditional page import and simple paged/vertical presentation a complete creator workflow before advanced effects become necessary.

## Later authoring tools

- Apple Pencil support, with standard and Pro capabilities evaluated separately after target devices and gestures are defined.
- A native frame-sequence timeline: frame import, expandable/condensable horizontal time scale, visual audio waveforms/clips, drag placement, and synchronized preview. Reuse timing contracts rather than implying video-file playback.
- Reusable motion presets for irregular/random particles (fireflies), per-particle or shared artwork, size variation, and authored seeds. Burst/scatter presets should support explosions, splashes, direction cones, and ground-limited arcs; manual paths remain available for precise choreography.
- Optional, editable micro-delights and Easter eggs once core editing is dependable.

Every tool needs a clear undo path, touch target, keyboard route, reduced-motion behavior, and an accessible description where visual cues alone would be insufficient.
