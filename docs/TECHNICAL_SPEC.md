# ArtNet Technical Specification

**Status:** Initial canonical draft  
**Last updated:** 2026-09-01
**Authority:** This document records the approved product direction and the implementation demonstrated in the ArtNet development history. When this document conflicts with running code, the code describes current behavior and this document must be updated. When it conflicts with `PROJECT_BIBLE.md` on product intent, the Bible takes precedence.

## 1. Purpose and status vocabulary

ArtNet is an interactive visual-storytelling system intended to let creators compose cinematic, non-linear graphic narratives from panels, imagery, dialogue, motion, camera direction, effects, audio, and reader input.

Every capability in this specification has one of these labels:

- **Implemented** — present in the TypeScript prototype and demonstrated by successful runtime or serialization diagnostics.
- **Planned** — part of the approved direction, but not demonstrated as a complete working feature.
- **Exploratory** — a possible direction requiring product or technical validation before commitment.

An implemented domain object or log-level executor does not imply that a production renderer, audio backend, editor, database, or user-facing application exists.

## 2. Architectural baseline

### 2.1 Current architecture — Implemented

The current system is a framework-independent TypeScript prototype. It separates authored story structure, reusable resources, reconstruction, and runtime execution:

```text
Serialized project
├── Story hierarchy
│   └── State-owned configuration and resource IDs
└── Resource library
    ├── Effects
    ├── Audio cues
    ├── Overlays
    ├── Camera paths
    └── Panel groups
          │
          ▼
StorySerializer.fromJSON()
          │ resolves IDs
          ▼
Runtime object graph
          │
          ▼
Engine lifecycle, input, transitions, timers, and preloading
```

The prototype uses classes and explicit composition. The serializer emits JSON and the loader rebuilds class instances and selected cross-object references through typed resource registries.

The demonstrated sample, *The Forest of Onekus*, contains one chapter and two states. It is a fixture and proof of architecture, not a schema limit.

### 2.2 Planned architecture — Planned

The intended product separates four concerns:

1. **Authoring/editor:** creates and validates stories without exposing runtime implementation details.
2. **Canonical project format:** versioned, portable story data plus resource references and asset metadata.
3. **Runtime/player:** loads the project, resolves references, restores reader state, and coordinates visual, motion, audio, accessibility, and input systems.
4. **Persistence/services:** stores projects, versions, publications, assets, and reader progress behind explicit interfaces.

The editor and player should consume the same domain rules and serialization contract, but should not share mutable session state. Rendering, storage, identity, publishing, and collaboration technology choices remain unresolved.

## 3. Domain model and entity relationships

### 3.1 Core entities — Implemented

| Entity | Responsibility | Principal relationships |
|---|---|---|
| `Story` | Root narrative metadata and chapter collection | Owns ordered `Chapter[]`; associated with an `ArtNetResources` library at project load/save boundaries |
| `Chapter` | Named narrative subdivision | Owns ordered `State[]` |
| `State` | Primary runtime scene/snapshot | Owns prompts, zoom configuration, layer directives, assets, camera data, timeline, lifecycle/input settings; holds resolved resource objects at runtime |
| `Prompt` | Reader or automatic interaction contract | Contains an input type, a reconstructed `Transition`, and optional target ID |
| `Transition` | Directed edge in the state graph | Names `destinationStateId`, owns a `TransitionEffect`, and holds registered triggered audio cues at runtime; cue references serialize as IDs |
| `TransitionEffect` | Transition timing and input policy | Type, duration, fast-forward permission, and input-lock behavior |
| `Timeline` | State-relative scheduled instruction collection | Owns `TimelineEvent[]` |
| `TimelineEvent` | Timestamped typed dispatch | Type plus runtime payload; serialized as `payloadId` for supported resource types |
| `Clock` | Injectable runtime scheduling boundary | `SystemClock` delegates to platform timers; `DeterministicClock` supports explicit advancement in tests |
| `Renderer` | Platform-neutral visual dispatch boundary | Receives state, panel, camera-path, effect, and overlay operations with the canonical render context |
| `Effect` | Reusable effect description | Registered by ID; includes type, trigger, and duration |
| `AudioCue` | Reusable audio description | Registered by ID; includes file, kind, loop, volume, trigger, persistence, fades, and layer group |
| `OverlayAsset` | Reusable moving/placed overlay description | References a camera/path ID and contains rotation, duration, and path-following behavior |
| `CameraFocalPoint` | Position and zoom target | Used by camera paths and state camera configuration |
| `CameraPath` | Reusable camera motion | Connects start/end focal points; includes duration, easing, and speed multiplier |
| `CameraEvent` | Schedules a camera path | Contains trigger time and a runtime `CameraPath`; serialized as `cameraPathId` |
| `PanelGroup` | Coordinated panel reveal unit | Owns `PanelReveal[]` |
| `Panel` | Reusable visual panel definition | Registered by ID; optionally carries an asset and accessible description |
| `PanelReveal` | Panel layout and reveal instruction | Holds a resolved `Panel` at runtime plus delay, x/y, width/height, and rotation; serializes the reference as `panelId` |
| `ZoomRegion` | Inspectable target in a state | ID, bounds, and textual description |
| `Asset` | State-associated preload descriptor | File and asset type |
| `AudioStack` / audio layer | Layered audio configuration | Maintains layers and activation/deactivation behavior |
| `ArtNetResources` | Project-scoped resource library | Owns registries for effects, audio, overlays, camera paths, panels, and panel groups |
| `Engine` | Runtime coordinator | Holds current state; manages inputs, transition pipeline, timers, timelines, assets, layers, and playback dispatch |

### 3.2 Relationship rules — Implemented

- A story owns chapters; a chapter owns states.
- Prompts form directed graph edges between states by destination ID.
- Top-level reusable resources have stable IDs and a single canonical serialized definition.
- State effects, state audio cues, transition-triggered audio cues, state camera paths, camera-event paths, panel reveals, state panel groups, and typed timeline payloads serialize as IDs and are resolved back to runtime objects by the loader.
- The loader uses domain methods such as `addEffect`, `addAudioCue`, `addCameraPath`, and `addPanelGroup` to reconstruct state membership.
- Missing typed resources and transition destinations are rejected with path-specific validation errors before reconstruction.

### 3.3 Known normalization gaps — Planned

- It has not been demonstrated that overlays can be directly attached to a state outside timeline references.
- Resource IDs are unique within each typed registry and state IDs are unique across the story. Allowed characters and rename/migration semantics are not yet specified.

## 4. Story hierarchy and reading model

### Implemented

- Ordered hierarchy: `Story → Chapter → State`.
- Each chapter declares an `entryStateId`, and validation treats its states as a directed graph rooted at that state.
- States declare whether they are intentional endings; unreachable states and accidental dead ends are rejected, while reachable cycles are allowed.
- States can expose multiple prompts with input types including directional taps and pinch/zoom inspection.
- A prompt can target another state or the current state, enabling inspection behavior without mandatory narrative advancement.
- `ZoomRegion` provides bounded, described targets for inspectable content.
- Panel groups can reveal multiple panels with independent delay and layout values.

### Planned

- Support deliberate non-linear reading orders, optional discoveries, branching reveals, and revisitation while maintaining comprehensible navigation.
- Define cross-chapter transition and chapter-exit rules beyond the currently implemented story-wide destination lookup.

### Exploratory

- Branching reveals that change visible composition without changing story state.
- Multiple simultaneous perspectives, flashbacks, split timelines, and interaction-determined reading order.

## 5. Runtime lifecycle

### Implemented

The runtime coordinates a state lifecycle with phases conceptually including pre-entry, entry, active, exiting, and exited. Demonstrated behavior includes:

1. Start a state and clear timers left by the prior state.
2. Apply audio-layer activation/deactivation rules.
3. Schedule the state's timeline events.
4. Accept or reject reader input according to input-lock state.
5. Resolve the matching prompt and destination state.
6. Prepare the transition and preload destination/nearby assets.
7. Execute transition behavior and triggered-audio dispatch at the prototype level.
8. Exit the source state, enter the destination, and start the new state lifecycle.
9. Clear abandoned timers so events from an exited state cannot fire later.
10. Unload distant state assets according to the prototype's proximity policy.

Auto-advance configuration, an optional auto-advance prompt, fast-forward flags/multipliers, and transition-level fast-forward/input-lock rules exist in the domain/runtime prototype. Starting a state now schedules both its timeline and eligible auto-advance through the engine's injected clock.

All timeline, panel-reveal, and auto-advance timers use the `Clock` interface and are registered for lifecycle cleanup. `SystemClock` preserves normal runtime behavior, while `DeterministicClock` executes tasks in due-time and insertion order under explicit test advancement. Fired timers remove themselves from the active set, and clearing active timers cancels pending timeline, panel, and auto-advance work.

When fast-forward is active and the current state permits it, timeline timestamps, panel-reveal delays, and auto-advance delays are divided by the state's validated multiplier. This decision is made when each timer is scheduled; toggling fast-forward does not currently reschedule existing timers. Transition-effect duration remains descriptive prototype data rather than a scheduled transition animation.

Timeline dispatch recognizes panel group, camera, effect, audio, and overlay event types. Panel reveal scheduling and camera/effect/audio/overlay executors have been exercised through console-level prototype behavior. This is not evidence of final graphical or audio playback.

### Planned

- Replace placeholder/log executors with production rendering, animation, effects, and audio adapters.
- Formalize cancellation, interruption, idempotency, and error behavior for every lifecycle phase.
- Define pause/resume semantics, background-tab behavior, and synchronization between animation, audio, and timelines.
- Extend fast-forward into future timed adapters and honor reduced-motion/accessibility policy.

## 6. Navigation and state restoration

### Implemented

- Prompt input resolves a destination state by ID and changes the engine's current state.
- Directional navigation and self-targeted inspection are represented in the sample graph.
- The engine can determine the current state's position for nearby-state asset preloading.

### Planned

- Persist and restore, at minimum: project/story version, chapter ID, state ID, navigation history or checkpoint, active branch decisions, revealed content, accessibility preferences, audio preferences, and any state-local variables introduced later.
- Define back-navigation separately from authored `tapLeft` prompts; a narrative edge is not automatically browser-style history.
- Restore into a deterministic lifecycle checkpoint without replaying one-shot cues or losing persistent ambience.
- Handle saves whose story version has changed through migration or a clearly reported incompatibility path.
- Support safe checkpoints around transitions so a crash cannot leave progress between source and destination states.

### Exploratory

- Cross-device synchronization, cloud saves, bookmarks, multiple reading profiles, and creator-authored checkpoint policies.
- Replaying a scene from its start versus restoring its exact elapsed timeline position.

## 7. Panel and layer systems

### Implemented

- A `Panel` is a first-class reusable resource with an ID and optional asset and accessible description.
- A `PanelGroup` contains ordered `PanelReveal` placement instructions. Serialized reveals carry `panelId`; runtime reveals hold the registered `Panel` instance.
- Each reveal contains delay, position, dimensions, and rotation in a fixed 1600×900 logical-pixel canvas. The origin is top-left, positive x points right, and positive y points down.
- Renderers uniformly contain the logical canvas inside the viewport, preserving aspect ratio. Letterboxing or pillarboxing occupies any remainder; cropping and non-uniform stretching are outside the version-1 contract.
- Visual layers are ordered back-to-front as background, panels, overlays, effects, dialogue, and interaction/accessibility UI.
- Panel groups can belong to states and can be triggered from typed timelines.
- The engine schedules each reveal independently and cancels pending reveals when state timers are cleared.
- `Renderer` is injectable. `PrototypeRenderer` preserves console diagnostics; no DOM, canvas, native, or other production renderer is implemented.
- Audio layer activation/deactivation directives are attached to states; cues also carry a `layerGroup` classification.

### Planned

- Layout constraints, clipping, safe areas, aspect-ratio policy, and deterministic hit testing.
- Panel visibility/reveal state restoration and a documented relationship between state ownership and timeline ownership.
- Audio-layer mixing rules, exclusivity, crossfades, ducking, and persistence across state boundaries.

### Exploratory

- Constraint-based layouts, reusable layout templates, nested panel groups, and breakpoint-specific creator overrides.
- Dynamic panel reflow based on reader choice or device orientation.

## 8. Asset and resource management

### Implemented

- State assets identify a file and type.
- The engine preloads nearby destination assets, caches already-loaded assets, and can unload assets considered distant.
- `ArtNetResources` provides project-scoped typed registries for effects, audio, overlays, camera paths, panels, and panel groups.
- Serialization stores canonical resource definitions once and state/timeline references by ID for the resource types already migrated.
- Deserialization reconstructs registries first, then resolves state and timeline references into runtime class instances.

### Planned

- A complete asset manifest covering images, audio, fonts, captions/transcripts, thumbnails, and future media types.
- Content hashing, integrity verification, MIME/format validation, dimensions/duration metadata, dependency discovery, and duplicate detection.
- Platform-neutral logical asset URIs rather than relying on bare filenames.
- Loading states, retry/fallback behavior, memory budgets, priority queues, cancellation, and telemetry.
- Packaging and publication rules that guarantee every referenced asset is present and permitted for distribution.
- Schema validation before object construction and actionable errors for missing or incompatible resources.

### Exploratory

- CDN delivery, responsive image variants, streaming audio, offline bundles, delta updates, and creator-managed shared libraries across projects.

## 9. Effects, camera, overlays, and motion

### Implemented

- Effects carry ID, type, trigger, and duration and can be attached to states or timeline events.
- Camera focal points define x/y/zoom; paths define endpoints, duration, easing, and speed multiplier.
- Camera behaviors and scheduled camera events can be attached to states.
- Overlay assets can identify a visual asset, path, rotation, duration, and whether they follow the path.
- Transition effects define type, duration, fast-forward permission, and input-lock behavior.
- Timed events are cleared on transition, preventing stale motion/effects from executing in a later state.

### Planned

- Production render adapters for camera transforms, particles/effects, overlays, transitions, and compositing.
- A supported, versioned catalog of effect and easing types with validated parameters.
- Deterministic conflict resolution when multiple camera or transform instructions overlap.
- Reduced-motion alternatives and author preview of accessibility substitutions.
- Cleanup contracts for GPU/DOM/canvas resources and interrupted effects.

### Exploratory

- Keyframe tracks, reusable motion presets, physics-driven overlays, procedural effects, and plugin-defined effect types.

## 10. Audio triggers and adaptive audio

### Implemented

- `AudioCue` describes file, audio type, looping, volume, trigger, persistence across states, fade durations, and layer group.
- States reference audio cues and declare audio layers to activate or deactivate.
- Transitions can trigger audio cues.
- Timeline audio events can reference registered audio cues.
- The runtime prototype applies layer directives and dispatches audio events, but demonstrated execution is diagnostic/log-level rather than verified playback.

### Planned

- Real audio playback, decoding, mixing, fade/crossfade, loop boundaries, interruption, and cleanup.
- Adaptive audio driven by state entry/exit, transitions, narrative variables, and layer rules.
- Persistent ambience continuity across states without duplicate playback.
- User controls for master, music, ambience, effects, and narration where applicable.
- Captions/transcripts or equivalent alternatives for narratively meaningful audio.
- Browser/mobile audio-unlock behavior and graceful handling when autoplay is unavailable.

### Exploratory

- Beat-aware transitions, stems, spatial audio, procedural mixing, and device-aware quality tiers.

## 11. Editor/runtime boundaries

### Implemented

- Domain mutation methods provide a shared API used by construction and loading rather than requiring direct array manipulation.
- Serialized project data is separated from reconstructed runtime class instances.
- The resource library is distinct from state ownership, supporting reuse and centralized edits.

No visual editor is implemented in the evidenced prototype.

### Planned

- The editor operates on an authoring document with commands, validation, undo/redo, stable IDs, and explicit dirty/version state.
- The runtime consumes a validated immutable snapshot; it must not mutate the canonical authoring document.
- Preview uses the production runtime contract while isolating preview session state from authored data.
- Publishing compiles/validates editor data into a versioned runtime package.
- Editor-only metadata must be namespaced or omitted from runtime packages.

### Exploratory

- Real-time collaboration, comments, branching project history, reusable templates, marketplace resources, and third-party editor extensions.

## 12. Persistence and versioning

### Implemented

- `StorySerializer.toJSON()` produces a JSON representation of the story and resource library.
- `StorySerializer.fromJSON()` recreates the story, resource library, registries, prompts and transitions, camera events, and the demonstrated state/timeline references.
- Serialized projects declare numeric `schemaVersion: 1`.
- Loading dispatches documents by schema version before validation. Registered migrations run sequentially on a cloned document until the current version is reached; current-version documents bypass migration.
- A version 0 compatibility migration upgrades the pre-graph shape by deriving each chapter entry from its first state and deriving `isEnding` from whether a state has prompt transitions. Version 1 remains the current serializer output; version 2 has not been introduced.
- Migration failures throw `ProjectMigrationError` with path-specific issues. The loader rejects versions newer than it supports, missing sequential migration steps, and legacy graph metadata that cannot be derived safely.
- Loading rejects malformed JSON, missing or unsupported schema versions, invalid title/creator fields, missing resource collection arrays, and a non-array chapter collection before runtime reconstruction begins.
- Each chapter must be an object with a string title, an `entryStateId`, and a state array. Each state must be an object with the required scalar fields, an explicit boolean `isEnding`, collection arrays, and a timeline containing an event array emitted by the version 1 serializer.
- Prompt validation requires a supported input type, optional string target ID, and a transition containing a destination-state ID, transition-effect fields, and string triggered-audio IDs.
- Timeline events require a numeric timestamp, supported dispatch type, and string payload ID. Camera events require a numeric trigger time and string camera-path ID.
- Resource validation covers effects, audio cues, overlays, camera paths with focal points, panels, and panel groups with reveals. Each resource entry must match the field types consumed by reconstruction.
- Remaining state validation covers zoom regions, assets, camera behaviors, camera focal points, resource-ID arrays, and audio-layer name arrays.
- Integrity validation resolves state-owned resource IDs, transition-triggered audio, camera events, overlay paths, panel-reveal references, and type-directed timeline payloads against their typed registries. Transition destinations must identify an existing state.
- Duplicate definitions are rejected within each typed resource registry, and duplicate state IDs are rejected across all chapters.
- Each chapter entry must reference a state owned by that chapter. Reachability is computed from that entry through prompt transitions whose destinations remain inside the chapter; story-wide transition destination validation continues to permit cross-chapter references.
- A state with no prompt transitions must declare `isEnding: true`, and a state with one or more prompt transitions must declare `isEnding: false`. Reachable cycles are valid and are not treated as errors.
- Integrity checks run only after structural/type validation succeeds, avoiding secondary missing-reference errors caused by malformed fields.
- All numeric values must be finite. Durations, delays, timestamps, and trigger times must be nonnegative; dimensions, zoom levels, and camera-path speed multipliers must be positive; audio volume is limited to 0–1; and state fast-forward multipliers must be at least 1. Coordinates and rotation may be negative.
- Version 1 closes the existing `InputType` and timeline-event discriminators, asset types to `image` or `audio`, and audio-cue types to `music`, `ambience`, `soundEffect`, or `voice`. Effect names, triggers, easing names, camera behaviors, and transition-effect names remain open strings until their runtime catalogs are specified.
- Omitted constructor-backed optional fields receive version 1 defaults before validation: audio persistence/fades/layer group, overlay rotation/duration/path-following, camera-path speed multiplier, panel-reveal layout values, state configuration and empty collections/timeline, transition triggered-audio IDs, and transition-effect fast-forward/input-lock flags. Older version-1 files without `resources.panels` receive minimal panel definitions derived from unique panel-group reveal IDs; newly serialized files always emit the panel registry.
- Unknown fields are rejected at every validated object boundary in schema version 1 rather than silently ignored. Future fields require a schema revision, migration, or an explicitly specified extension namespace.
- Nested validation issues use indexed paths such as `$.chapters[0].states[1].timeline.events`, and independent issues are aggregated before loading stops.
- Project validation failures throw `ProjectValidationError` with one or more path-specific issues.
- A serialize/load round trip has been demonstrated for one story, two states, and registered resource examples.

This is object serialization, not yet durable application persistence.

### Planned

- Add explicit migration steps and compatibility fixtures whenever future schema versions are introduced.
- Define versioned effect, trigger, easing, camera-behavior, and transition-effect catalogs when production subsystem contracts exist.
- Validate asset availability before publish or play.
- Separate project identity/version from story title and creator display name.
- Use atomic writes or transactional storage for projects and progress.
- Preserve backward compatibility for published stories according to a documented support policy.
- Add import/export and recovery/backup behavior.

### Exploratory

- Local-first storage, hosted database persistence, event sourcing, collaborative operation logs, and signed publication bundles.

## 13. Accessibility

### Implemented

- Zoom regions contain textual descriptions, providing a domain location for non-visual meaning.
- Fast-forward and input-lock concepts exist, which can support timing accommodations after policy is defined.

No complete accessibility experience has been demonstrated.

### Planned

- Full keyboard, switch, touch, and assistive-technology navigation for every prompt and interactive region.
- Semantic labels, reading order, focus management, visible focus, and non-gesture alternatives.
- Text scaling and reflow policy for dialogue without loss of content or controls.
- Reduced-motion mode that substitutes or skips nonessential camera motion, effects, and animated transitions.
- Captions/transcripts and visual alternatives for meaningful audio; audio descriptions or equivalent text for meaningful visuals.
- Color contrast, color-independent cues, configurable timing, pause/skip/replay controls, and avoidance of unsafe flashing.
- Editor validation that flags missing descriptions, inaccessible interaction-only gestures, unsafe timing, and contrast risks.
- Establish a concrete compliance target before public release; no target is assumed here.

### Exploratory

- Creator-authored alternate reading orders, simplified-motion compositions, sign-language media tracks, and automated accessibility assistance subject to human review.

## 14. Performance and reliability

### Implemented

- Nearby-state asset preloading.
- A loaded-asset cache that avoids duplicate work.
- Distant-state asset unloading hooks.
- Active timer tracking and cleanup on state changes.
- Reference-based serialization reduces repeated resource definitions.

### Planned

- Define measurable budgets for startup, state transition latency, memory, frame time, asset size, and audio synchronization on target devices.
- Use bounded look-ahead preloading based on graph probability/priority rather than only list proximity where narratives branch.
- Instrument load, decode, render, transition, dropped-frame, memory, and audio timing behavior.
- Ensure timers and event handlers cannot leak across state changes, story unload, preview restart, or app suspension.
- Provide degraded modes and asset fallbacks for constrained devices or failed loads.
- Test large graphs, long sessions, rapid input, repeated navigation, and cancellation races.

### Exploratory

- Predictive prefetching, worker-based decode, renderer-specific batching, level-of-detail assets, and streaming project packages.

## 15. Testing strategy

### Implemented

- The development history demonstrates manual executable diagnostics for object construction, transition flow, asset caching, timer cancellation, registry contents, serialization, deserialization, and timeline payload reconstruction.
- Vertical-slice verification has been used while migrating resource references: serializer change, loader resolution, diagnostic, then commit.
- An automated Node test suite verifies schema-version emission, valid version 1 envelope and nested chapter/state loading, semantic serialize/load/serialize equivalence, runtime class reconstruction and shared resource identity, panel normalization and legacy compatibility, renderer dispatch, coordinate/layer constants, deterministic clock ordering, timeline and panel scheduling, auto-advance, lifecycle cancellation, fast-forward timing and opt-out, version dispatch, legacy migration and source immutability, missing migration steps, path-specific migration failures, malformed JSON diagnostics, missing and unsupported versions, structural/type errors throughout the demonstrated shape, typed reference resolution, transition destinations, duplicate resource/state IDs, chapter entries, reachability, intentional endings and cycles, optional defaults, numeric boundaries, closed catalogs, and unknown-field rejection.

The automated suite currently covers deterministic runtime timing, semantic reconstruction, a version 0 compatibility fixture, migration dispatch and diagnostics, required structure, field types, reference integrity, uniqueness scopes, story-graph rules, numeric policy, catalogs, defaults, and unknown-field behavior across the complete demonstrated version 1 document shape. No continuous integration pipeline is evidenced.

### Planned

- Unit tests for every domain invariant, registry operation, lifecycle transition, timer cancellation rule, and serializer mapping.
- Additional round-trip scenarios for larger multi-chapter projects and every future schema version.
- Compatibility fixtures for every future version and multi-step migration chain.
- Contract tests between editor output and runtime input.
- Integration tests for input → transition → preload → exit/enter → timeline behavior.
- Deterministic timing tests for future fades, transition animations, pause/resume, and interruption races.
- Accessibility, performance, malformed-data, and security regression suites.
- End-to-end tests on every supported rendering platform and representative device class.

## 16. Security and trust boundaries

### Implemented

- No application security subsystem is evidenced.
- TypeScript typing and registry lookups improve development safety but are not security controls.

### Planned

- Treat imported project JSON, asset metadata, filenames/URIs, creator text, and extension data as untrusted input.
- Validate against a strict versioned schema before allocating resources or constructing runtime objects.
- Prevent path traversal and disallow arbitrary local paths or executable asset types in published packages.
- Enforce file type, size, duration/dimension, decompression, and aggregate project limits.
- Escape/sanitize creator content at the rendering boundary; do not execute authored JavaScript or HTML by default.
- Apply least privilege and explicit authorization to project read/write, collaboration, publishing, and asset access.
- Protect stored credentials and private projects; define encryption, retention, deletion, and audit requirements before hosted launch.
- Establish dependency review, lockfile, vulnerability response, and build provenance practices.
- If extensions are supported, isolate them through capabilities/sandboxing and versioned APIs.

### Exploratory

- Signed story packages, content moderation pipelines, rights/provenance attestations, malware scanning, and privacy-preserving analytics.

## 17. Extensibility

### Implemented

- Typed registries provide a repeatable pattern for reusable resource categories.
- Timeline events dispatch by type and carry resource-backed payloads.
- Domain classes and add-methods provide extension seams without coupling authored JSON directly to runtime arrays.

### Planned

- Replace free-form type strings with versioned discriminated unions or an equivalent validated dispatch contract.
- Define subsystem interfaces for renderer, audio, asset loading, persistence, input, clock/scheduler, analytics, and accessibility preferences.
- Extend the sequential migration registry for future schema versions and define forward-compatible extension namespaces.
- Keep platform-specific implementations behind adapters so the domain and project format remain portable.
- Document lifecycle and cleanup requirements for every new resource/event type.

### Exploratory

- Capability-limited plugins, custom authoring inspectors, custom timeline tracks, third-party resource providers, and scripting through a non-arbitrary declarative rules system.

## 18. Current serialized shape

### Implemented

The demonstrated format is structurally equivalent to:

```json
{
  "schemaVersion": 1,
  "title": "...",
  "creator": "...",
  "resources": {
    "effects": [],
    "audio": [],
    "overlays": [],
    "cameraPaths": [],
    "panels": [
      {
        "id": "...",
        "asset": "...",
        "accessibleDescription": "..."
      }
    ],
    "panelGroups": []
  },
  "chapters": [
    {
      "title": "...",
      "entryStateId": "...",
      "states": [
        {
          "id": "...",
          "image": "...",
          "dialogue": "...",
          "isEnding": false,
          "prompts": [
            {
              "inputType": "tapRight",
              "transition": {
                "destinationStateId": "...",
                "effect": {
                  "type": "fadeIn",
                  "duration": 0,
                  "allowFastForward": true,
                  "locksInput": false
                },
                "triggeredAudioCueIds": ["..."]
              }
            }
          ],
          "effectIds": [],
          "audioCueIds": [],
          "cameraPathIds": [],
          "cameraEvents": [
            {
              "triggerTime": 0,
              "cameraPathId": "..."
            }
          ],
          "panelGroupIds": [],
          "timeline": {
            "events": [
              {
                "timestamp": 0,
                "type": "effect",
                "payloadId": "..."
              }
            ]
          }
        }
      ]
    }
  ]
}
```

Version 1 requires the displayed top-level metadata, five typed resource arrays, chapter structure, state fields, and the nested contents demonstrated by the serializer before reconstruction. Structural/type validation covers the complete demonstrated shape. Reference integrity covers the typed registries and transition destinations, with resource IDs unique per registry and state IDs unique across the story. Constructor-backed optional fields are defaulted before validation; numeric values and closed catalogs follow the policies in Section 12; unknown fields are rejected. Additional implemented state fields include zoom settings/regions, audio layer directives, assets, camera behaviors/focal points, auto-advance settings, and fast-forward settings. Prompt transitions serialize triggered audio as resource IDs; loading rebuilds `Prompt`, `Transition`, and `TransitionEffect` instances and attaches registered `AudioCue` objects. Camera events serialize their trigger time and a camera-path resource ID; loading reconstructs each runtime `CameraEvent` with the registered `CameraPath`. The displayed shape is illustrative, not yet a normative JSON Schema.

## 19. Unresolved questions

The following decisions must remain open until explicitly resolved:

1. What rendering platform and composition model will the first production player use: DOM/CSS, Canvas, WebGL, a hybrid, or another runtime?
2. What is the canonical definition of a panel? Is it an asset, content node, layout instance, state, or a separate entity referenced by reveals?
3. Are panel groups fundamentally state-owned, timeline-owned, or reusable resources that both can reference?
4. What coordinate system, origin, scaling, aspect-ratio, and safe-area rules govern panels, focal points, zoom regions, and overlays?
5. Are chapters strictly ordered containers, and how are chapter entry, exit, and cross-chapter edges represented?
6. Which state cycles are valid, and how should validation distinguish intentional loops from authoring mistakes?
7. What exactly constitutes reader progress: current state only, navigation history, revealed panels, elapsed timeline time, variables, or a full runtime snapshot?
8. On restoration, should timelines replay from zero, resume from elapsed time, or restore only declared persistent outcomes?
9. Which audio layer rules govern exclusivity, ducking, priority, crossfade, persistence, and conflict resolution?
10. Are any deliberately inline/value-owned resources allowed, or must all reusable domain objects be registry-backed?
11. What is the stable ID policy and how do renames affect references, migrations, saves, and published versions?
12. What is the versioning and compatibility policy for project files, runtime packages, and published stories?
13. What durable storage, identity, collaboration, publication, and deployment services will be used?
14. What accessibility conformance target and supported input/device matrix are required for launch?
15. What performance budgets and minimum supported devices/browsers define acceptance?
16. Which creator-authored content is permitted, and what sanitization, moderation, copyright, privacy, and asset-security policies apply?
17. Will extensibility allow executable code, declarative extensions only, or no third-party extensions in the initial release?
18. What variables/conditions system, if any, governs adaptive narrative and audio behavior beyond state graph transitions?
19. How should simultaneous or overlapping timeline instructions resolve priority and cancellation?
20. Where is editor-only metadata stored, and what portion is included in portable/exported projects?

## 20. Near-term technical priorities

These are Planned and ordered to reduce architectural risk; they are not claims of completion:

1. Specify progress snapshots and deterministic restoration semantics.
2. Define accessibility and performance acceptance criteria before production rendering work hardens assumptions.
3. Introduce subsystem interfaces for audio, assets, input, storage, and scheduling, and implement a production renderer adapter.

## 21. Canonical maintenance rules

- Never upgrade a capability from Planned or Exploratory to Implemented without code and verification evidence.
- Add schema changes and migrations to this document in the same change set as their implementation.
- Record new unresolved decisions here rather than allowing assumptions to become accidental architecture.
- Keep sample-story facts separate from platform guarantees.
- Document both serialized ownership and reconstructed runtime ownership when adding a new entity or reference.
- Every timed or asynchronous feature must define cancellation, cleanup, restoration, fast-forward, and reduced-motion behavior.
- Every user-visible media feature must define an accessible alternative.
