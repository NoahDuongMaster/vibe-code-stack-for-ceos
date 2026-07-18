import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TMarketBubbleNode } from '@/_pages/home/model/market-scene.mapper';
import { MarketGravityWorld } from '@/_pages/home/ui/market-gravity-world';

const r3fMocks = vi.hoisted(() => ({
  domElement: undefined as HTMLCanvasElement | undefined,
  frameCallbacks: [] as Array<
    (state: { pointer: { x: number; y: number } }, delta: number) => void
  >,
}));

const physicsMocks = vi.hoisted(() => ({
  advanceGravitySimulation: vi.fn(),
  createGravitySimulation: vi.fn(),
  syncGravityBodies: vi.fn(),
}));

const bubbleMocks = vi.hoisted(() => ({
  objects: new Map<string, { position: { set: ReturnType<typeof vi.fn> } }>(),
}));

vi.mock('@react-three/fiber', () => ({
  useFrame: (
    callback: (
      state: { pointer: { x: number; y: number } },
      delta: number,
    ) => void,
  ) => {
    r3fMocks.frameCallbacks.push(callback);
  },
  useThree: () => ({ gl: { domElement: r3fMocks.domElement } }),
}));

vi.mock('@react-three/drei', () => ({ Sparkles: () => null }));

vi.mock('@/_pages/home/model/market-gravity.simulation', () => ({
  advanceGravitySimulation: physicsMocks.advanceGravitySimulation,
  createGravitySimulation: physicsMocks.createGravitySimulation,
  syncGravityBodies: physicsMocks.syncGravityBodies,
}));

vi.mock('@/_pages/home/ui/market-bubble', () => ({
  MarketBubble: ({
    node,
    objectRef,
  }: {
    node: TMarketBubbleNode;
    objectRef: (object: unknown) => void;
  }) => {
    const object = bubbleMocks.objects.get(node.id) ?? {
      position: { set: vi.fn() },
    };
    bubbleMocks.objects.set(node.id, object);
    objectRef(object);
    return <group name={`market-bubble-${node.id}`} />;
  },
}));

const nodes: TMarketBubbleNode[] = [
  {
    id: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    radius: 1,
    mass: 1,
    seedPosition: [-2, 0, 0],
    seedVelocity: [0, 0, 0],
    activity: 0.8,
    haloColor: '#C7FF2F',
    haloIntensity: 0.7,
  },
  {
    id: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    radius: 0.8,
    mass: 0.8 ** 3,
    seedPosition: [2, 0, 0],
    seedVelocity: [0, 0, 0],
    activity: 0.6,
    haloColor: '#FF3B5C',
    haloIntensity: 0.5,
  },
];

describe('[MarketGravityWorld]', () => {
  beforeEach(() => {
    r3fMocks.domElement = document.createElement('canvas');
    r3fMocks.frameCallbacks = [];
    bubbleMocks.objects.clear();
    physicsMocks.advanceGravitySimulation
      .mockReset()
      .mockImplementation(
        (simulation: {
          bodies: Array<{ position: [number, number, number] }>;
        }) => {
          for (const body of simulation.bodies) body.position[0] += 0.1;
        },
      );
    physicsMocks.createGravitySimulation
      .mockReset()
      .mockImplementation((inputNodes: TMarketBubbleNode[]) => ({
        accumulator: 0,
        bodies: inputNodes.map((node) => ({
          id: node.id,
          radius: node.radius,
          mass: node.mass,
          activity: node.activity,
          position: [...node.seedPosition],
          velocity: [...node.seedVelocity],
        })),
      }));
    physicsMocks.syncGravityBodies.mockReset();
  });

  it('should preserve one body graph and write finite frame positions', () => {
    const { container, rerender } = render(
      <MarketGravityWorld
        activeMarketId="bitcoin"
        animate
        compactViewport={false}
        nodes={nodes}
        onActiveMarketChange={vi.fn()}
      />,
    );

    expect(
      container.querySelectorAll('group[name^="market-bubble-"]'),
    ).toHaveLength(nodes.length);
    expect(physicsMocks.createGravitySimulation).toHaveBeenCalledOnce();
    expect(
      bubbleMocks.objects.get('bitcoin')?.position.set,
    ).toHaveBeenCalledWith(-2, 0, 0);

    act(() => {
      r3fMocks.frameCallbacks[0]?.({ pointer: { x: 0, y: 0 } }, 1 / 60);
    });
    expect(
      bubbleMocks.objects.get('bitcoin')?.position.set,
    ).toHaveBeenLastCalledWith(-1.9, 0, 0);

    rerender(
      <MarketGravityWorld
        activeMarketId="ethereum"
        animate
        compactViewport={false}
        nodes={nodes}
        onActiveMarketChange={vi.fn()}
      />,
    );
    expect(physicsMocks.createGravitySimulation).toHaveBeenCalledOnce();
  });

  it('should activate pointer repulsion only while the canvas pointer is present', () => {
    render(
      <MarketGravityWorld
        activeMarketId="bitcoin"
        animate
        compactViewport={false}
        nodes={nodes}
        onActiveMarketChange={vi.fn()}
      />,
    );

    act(() => {
      r3fMocks.frameCallbacks[0]?.({ pointer: { x: 0.2, y: -0.1 } }, 1 / 60);
    });
    expect(physicsMocks.advanceGravitySimulation).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        pointer: expect.objectContaining({ active: false }),
      }),
    );

    fireEvent.pointerMove(r3fMocks.domElement as HTMLCanvasElement);
    act(() => {
      r3fMocks.frameCallbacks[0]?.({ pointer: { x: 0.2, y: -0.1 } }, 1 / 60);
    });
    expect(physicsMocks.advanceGravitySimulation).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        pointer: expect.objectContaining({ active: true }),
      }),
    );

    fireEvent.pointerLeave(r3fMocks.domElement as HTMLCanvasElement);
    act(() => {
      r3fMocks.frameCallbacks[0]?.({ pointer: { x: 0, y: 0 } }, 1 / 60);
    });
    expect(physicsMocks.advanceGravitySimulation).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        pointer: expect.objectContaining({ active: false }),
      }),
    );
  });

  it('should keep seeded positions static when animation is disabled', () => {
    const { container } = render(
      <MarketGravityWorld
        activeMarketId="bitcoin"
        animate={false}
        compactViewport
        nodes={nodes}
        onActiveMarketChange={vi.fn()}
      />,
    );

    act(() => {
      r3fMocks.frameCallbacks[0]?.({ pointer: { x: 0, y: 0 } }, 1 / 60);
    });
    expect(physicsMocks.advanceGravitySimulation).not.toHaveBeenCalled();
    expect(
      container
        .querySelector('group[name="market-gravity-world"]')
        ?.getAttribute('scale'),
    ).toBe('0.74');
  });
});
