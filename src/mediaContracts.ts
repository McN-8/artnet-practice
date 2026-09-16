export const MEDIA_CONTRACT_VERSION = 1;
export const MAX_PARTICLES_V1 = 500;
export const RANDOM_ALGORITHM_V1 = "mulberry32" as const;

export interface AnimationFrame {
  atMs: number;
  panelId: string;
}

export interface AnimationAudioClip {
  atMs: number;
  audioCueId: string;
}

export class AnimationSequence {
  constructor(
    public id: string,
    public category: string,
    public durationMs: number,
    public frames: AnimationFrame[],
    public audioClips: AnimationAudioClip[],
    public reducedMotionPanelId: string
  ) {}
}

export interface MotionPoint {
  atMs: number;
  x: number;
  y: number;
}

export class MotionPath {
  constructor(
    public id: string,
    public durationMs: number,
    public points: MotionPoint[]
  ) {}
}

export interface ParticleVisual {
  panelId: string;
  weight: number;
}

export type ParticleEmitterShape = "point" | "circle";
export type ParticleBoundsPolicy = "none" | "stopAtCanvas";

export class ParticleEffect {
  constructor(
    public id: string,
    public category: string,
    public seed: number,
    public emitterShape: ParticleEmitterShape,
    public originX: number,
    public originY: number,
    public radius: number,
    public directionDegrees: number,
    public coneDegrees: number,
    public count: number,
    public lifetimeMs: number,
    public speed: number,
    public speedVariation: number,
    public scaleMin: number,
    public scaleMax: number,
    public rotationVariationDegrees: number,
    public visuals: ParticleVisual[],
    public boundsPolicy: ParticleBoundsPolicy,
    public reducedMotionPanelId: string,
    public motionPathId?: string,
    public motionPathIds?: string[]
  ) {}
}

export interface ParticleSpawn {
  panelId: string;
  x: number;
  y: number;
  angleDegrees: number;
  speed: number;
  scale: number;
  rotationDegrees: number;
  motionPathId?: string | undefined;
}

// Version-1 seeded sampling; changing this algorithm requires a contract revision.
export function sampleParticleSpawns(effect: ParticleEffect): ParticleSpawn[] {
  let state = effect.seed >>> 0;
  const random = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const totalWeight = effect.visuals.reduce(
    (sum, visual) => sum + visual.weight, 0
  );
  const spawns: ParticleSpawn[] = [];

  for (let index = 0; index < effect.count; index++) {
    const emitterAngle = random() * Math.PI * 2;
    const emitterDistance = effect.emitterShape === "circle"
      ? Math.sqrt(random()) * effect.radius : 0;
    const x = effect.originX + Math.cos(emitterAngle) * emitterDistance;
    const y = effect.originY + Math.sin(emitterAngle) * emitterDistance;
    const angleDegrees = effect.directionDegrees +
      (random() - 0.5) * effect.coneDegrees;
    const speed = effect.speed *
      (1 + (random() * 2 - 1) * effect.speedVariation);
    const scale = effect.scaleMin +
      random() * (effect.scaleMax - effect.scaleMin);
    const rotationDegrees = (random() * 2 - 1) *
      effect.rotationVariationDegrees;
    let choice = random() * totalWeight;
    let panelId = effect.visuals[effect.visuals.length - 1]!.panelId;
    for (const visual of effect.visuals) {
      choice -= visual.weight;
      if (choice < 0) {
        panelId = visual.panelId;
        break;
      }
    }
    spawns.push({
      panelId, x, y, angleDegrees, speed, scale,
      rotationDegrees,
      motionPathId: effect.motionPathIds?.[index] ?? effect.motionPathId
    });
  }
  return spawns;
}

export interface HapticPulse {
  atMs: number;
  durationMs: number;
  intensity: number;
}

export class HapticPattern {
  constructor(
    public id: string,
    public durationMs: number,
    public pulses: HapticPulse[],
    public visualAlternative: string
  ) {}
}

export interface MediaCapabilities {
  animation: boolean;
  particles: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  hapticsEnabled: boolean;
}

export interface MediaAdapter {
  capabilities: MediaCapabilities;
  playAnimation(sequence: AnimationSequence): void;
  playParticles(effect: ParticleEffect): void;
  playHaptics(pattern: HapticPattern): void;
  showReducedMotionPanel(panelId: string): void;
  showHapticAlternative(text: string): void;
  cancelAll(): void;
}

export class NoopMediaAdapter implements MediaAdapter {
  capabilities: MediaCapabilities = {
    animation: false,
    particles: false,
    haptics: false,
    reducedMotion: false,
    hapticsEnabled: false
  };

  playAnimation(): void {}
  playParticles(): void {}
  playHaptics(): void {}
  showReducedMotionPanel(): void {}
  showHapticAlternative(): void {}
  cancelAll(): void {}
}
