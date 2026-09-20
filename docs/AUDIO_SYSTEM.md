# Audio System

**Status:** Design direction. See [TECHNICAL_SPEC.md](TECHNICAL_SPEC.md) for implemented audio contracts.

## Near-term

Keep music, ambience, effects, and voice tied to authored state and timing. Backward prompting should restore the previous musical state deterministically. A reverse sound effect is an optional authored flourish, never a requirement for correct navigation. Playback must respect mute, device restrictions, and reader volume choices.

## Later capabilities

- Adaptive music may combine stems within one arrangement and switch between synchronized alternate arrangements on a common clock. Explore immediate, beat, bar, and marker boundaries with clear fallback when alignment cannot be honored.
- The timeline editor should show audio clip duration and placement visually and allow direct manipulation and preview.
- Community voiceovers are a separate, much later social feature. Define creator consent, performer attribution, rights, moderation, and whether recordings are official or fan contributions before implementation.

Audio should deepen story pacing. It must not carry essential information without captions, transcript, text, or another accessible route.
