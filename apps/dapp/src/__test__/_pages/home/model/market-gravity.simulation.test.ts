import { describe, expect, it } from 'vitest';
import {
  advanceGravitySimulation,
  createGravitySimulation,
  syncGravityBodies,
} from '@/_pages/home/model/market-gravity.simulation';
import type { TMarketBubbleNode } from '@/_pages/home/model/market-scene.mapper';

const node = (
  id: TMarketBubbleNode['id'],
  position: readonly [number, number, number],
  radius = 0.6,
): TMarketBubbleNode => ({
  id,
  symbol: id.slice(0, 3).toUpperCase(),
  name: id,
  radius,
  mass: radius ** 3,
  seedPosition: position,
  seedVelocity: [0, 0, 0],
  activity: 0.5,
  haloColor: '#8B5CF6',
  haloIntensity: 0.5,
});

const input = {
  frameDelta: 1 / 60,
  bounds: [4, 2.25, 1.4] as const,
  pointer: { active: false, position: [0, 0, 0] as const },
};

describe('[MarketGravitySimulation]', () => {
  it('should initialize deterministic explicit bodies', () => {
    const nodes = [node('bitcoin', [-2, 0, 0]), node('ethereum', [2, 0, 0])];
    expect(createGravitySimulation(nodes)).toEqual(
      createGravitySimulation(nodes),
    );
  });

  it('should not mutate for zero, negative, or non-finite frame deltas', () => {
    const simulation = createGravitySimulation([node('bitcoin', [2, 0, 0])]);
    const before = structuredClone(simulation);
    advanceGravitySimulation(simulation, { ...input, frameDelta: 0 });
    advanceGravitySimulation(simulation, { ...input, frameDelta: -1 });
    advanceGravitySimulation(simulation, {
      ...input,
      frameDelta: Number.NaN,
    });
    expect(simulation).toEqual(before);
  });

  it('should attract a body toward the chamber center', () => {
    const simulation = createGravitySimulation([node('bitcoin', [2, 0, 0])]);
    advanceGravitySimulation(simulation, input);
    expect(simulation.bodies[0]?.velocity[0]).toBeLessThan(0);
  });

  it('should separate overlapping spheres and keep finite values', () => {
    const simulation = createGravitySimulation([
      node('bitcoin', [0, 0, 0], 0.8),
      node('ethereum', [0.5, 0, 0], 0.8),
    ]);
    advanceGravitySimulation(simulation, input);
    const [bitcoin, ethereum] = simulation.bodies;
    const separation = Math.hypot(
      (ethereum?.position[0] ?? 0) - (bitcoin?.position[0] ?? 0),
      (ethereum?.position[1] ?? 0) - (bitcoin?.position[1] ?? 0),
      (ethereum?.position[2] ?? 0) - (bitcoin?.position[2] ?? 0),
    );
    expect(separation).toBeGreaterThanOrEqual(1.6 - 0.001);
    expect(
      simulation.bodies
        .flatMap(({ position, velocity }) => [...position, ...velocity])
        .every(Number.isFinite),
    ).toBe(true);
  });

  it('should use a deterministic normal for coincident centers', () => {
    const simulation = createGravitySimulation([
      node('bitcoin', [0, 0, 0]),
      node('ethereum', [0, 0, 0]),
    ]);
    advanceGravitySimulation(simulation, input);
    expect(simulation.bodies[0]?.position[0]).toBeLessThan(0);
    expect(simulation.bodies[1]?.position[0]).toBeGreaterThan(0);
  });

  it('should contain the full radius inside chamber bounds', () => {
    const simulation = createGravitySimulation([node('bitcoin', [3.9, 0, 0])]);
    advanceGravitySimulation(simulation, input);
    expect(simulation.bodies[0]?.position[0]).toBeLessThanOrEqual(3.4);
  });

  it('should repel a body away from an active pointer', () => {
    const simulation = createGravitySimulation([node('bitcoin', [0.7, 0, 0])]);
    advanceGravitySimulation(simulation, {
      ...input,
      pointer: { active: true, position: [0, 0, 0] },
    });
    expect(simulation.bodies[0]?.velocity[0]).toBeGreaterThan(0);
  });

  it('should preserve body identity and motion when market metrics refresh', () => {
    const simulation = createGravitySimulation([node('bitcoin', [1, 0, 0])]);
    const originalBody = simulation.bodies[0];
    if (!originalBody) throw new Error('Expected seeded body');
    originalBody.velocity = [0.4, 0.2, 0];
    syncGravityBodies(simulation, [node('bitcoin', [-3, 1, 0], 1)]);
    expect(simulation.bodies[0]).toBe(originalBody);
    expect(simulation.bodies[0]).toMatchObject({
      id: 'bitcoin',
      radius: 1,
      position: [1, 0, 0],
      velocity: [0.4, 0.2, 0],
    });
  });
});
