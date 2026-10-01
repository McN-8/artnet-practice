# Product Decisions and Open Questions

**Status:** Design decisions from the Ideas discussion, 2026-09-20. Technical decisions remain in [TECHNICAL_SPEC.md](TECHNICAL_SPEC.md).

## Accepted direction

1. **Creator flow:** Reduce friction with direct manipulation, progressive controls, reversible placement, and tactile confirmation of real work.
2. **Reward philosophy:** Celebrate making, learning, reading, contribution, and curiosity. Avoid streak pressure, variable rewards designed to prolong sessions, and interruptions to authored scenes.
3. **Achievement disclosure:** Use three layers: small checked achievement icon, optional expanded card, then a details page. Exact placement, timing, and graphic identity await UI testing.
4. **Traditional mode:** Static graphic novels are first-class works and should be easy to import and publish.
5. **Age filtering:** The purpose is age-appropriate content access. The proposed playful quiz is an idea, not a verification solution.
6. **Drop-target feedback:** During drag and drop, compatible attachment regions may temporarily enlarge on hover and return to normal when the hover or placement ends. This communicates where an item can attach without altering the published composition.
7. **Explicit geometry confirmation:** Direction, cones, and expandable effect regions preview during manipulation and commit through a nearby handedness-aware checkmark rather than immediately on release.
8. **Feature-level help:** Each distinct feature should expose a contextual “?” explanation so creators can understand its purpose and controls without leaving their work.

## Achievement backlog (long-term)

- **Reading:** first story/chapter, pages or time read, first zoom, auto-prompt use, backward navigation, and hidden-detail discovery.
- **Creating:** first published work, panel/sticker/audio milestones, first adaptive cue, moving panel, particle effect, animation, or collaboration.
- **Community:** first constructive comment, first received comment, following a creator, collaboration, and eventual voiceover participation.
- **Exploration:** trying another genre, finishing a “Try Something New” pick, or reading a debut creator.

Unexpected achievements may delight, but milestones should recognize meaningful actions rather than require repetitive grinding. Counts and thresholds remain undecided. Reader metrics need privacy-conscious storage and opt-out design.

## Open design questions

- How should touch controls adapt to handedness, finger position, screen edges, and assistive input without covering the art?
- What snap thresholds, guide persistence, and temporary override feel helpful rather than corrective?
- Which rewind effects can be reversed faithfully, and which should simply restore and restart?
- How do achievements recognize reading time/pages without rewarding compulsive use?
- What permissions, licensing, and moderation would community voiceovers require?
- Which discovery signals preserve diversity, privacy, and fair exposure?
- Which shake parameters beyond speed belong in the first useful version, and what reduced-motion substitute best preserves its narrative meaning?
- Should shake direction snap to common angles while preserving free rotation, and how should creators enter exact angles without a pointer?
- Should the “HA HA HA” effect use fixed creator text, localized text, reusable presets, or a general regional text-emitter primitive? Which size settings apply to the whole region versus individual instances?

Promote each major feature through a short proposal covering purpose, reader/creator problem, smallest useful version, accessibility, technical fit, and how it will be evaluated.
