# Runtime and Reader Behavior

**Status:** Design and backlog. [TECHNICAL_SPEC.md](TECHNICAL_SPEC.md) records verified implementation.

## Established baseline

The prototype has state transitions, deterministic timer cleanup, reader-owned hands-free auto-prompt controls, traditional presentation modes in project data, and bounded traditional page navigation. Production reader presentation and complete media behavior remain planned.

## Near-term behavior

- Traditional/static graphic novels must work as first-class paged or vertical stories with an import-to-publish path and no required motion or audio.
- Auto-prompt stays off by default. Readers can enable it, alter the delay, pause, and skip; authored timing and reader pacing remain distinct.
- Backward prompts restore state first. Explore an optional rewind transition that reverses a reversible animation, then replays normally from its beginning. Music returns to the prior state; reversed effects are optional. Define interruption, replay, and reduced-motion behavior before shipping.

## Later expressive behaviors

- Layered panels and moving panel viewports over larger illustrations should reuse assets to create motion without full animation.
- Seamlessly tiled backgrounds may loop along a path; edge continuity, reset position, and visible seam behavior need editor preview.
- Motion blur should support an adjustable strength control and be scoped to the moving object or layer. Reduced-motion settings need a stable still alternative.
- Native frame sequences, random-motion particles, directional explosion/splash scatter, and timed haptics should share authored clocks and deterministic replay. Device vibration is optional and must never be the only channel for information.
- Object shake should support speed and an authored back-and-forth axis, from slow directional movement through vibration-like motion, while remaining deterministic under replay and backward restoration. Reduced motion may lower amplitude/rate or replace the shake with a static emphasis chosen by the creator.
- The “HA HA HA” effect should place and remove text sporadically inside an authored region, with adjustable speed, size, optional per-instance size variation, and entry/exit modes including fade, grow-in, and shrink-out. Seeded placement and size selection should make playback, preview, and restoration reproducible.

Each new timed behavior needs cancellation, cleanup, backwards navigation, fast-forward, resource-budget, and accessibility rules.
