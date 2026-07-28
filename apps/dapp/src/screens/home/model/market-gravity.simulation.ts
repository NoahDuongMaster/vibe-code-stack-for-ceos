import type { TMarket } from '@/screens/home/model/market.schema';
import type {
  TMarketBubbleNode,
  TVector3Tuple,
} from '@/screens/home/model/market-scene.mapper';

type TMutableVector3 = [number, number, number];

export type TGravityBody = {
  id: TMarket['id'];
  radius: number;
  mass: number;
  activity: number;
  position: TMutableVector3;
  velocity: TMutableVector3;
};

export type TGravitySimulation = {
  accumulator: number;
  bodies: TGravityBody[];
};

export type TGravityStepInput = {
  activeMarketId?: TMarket['id'];
  frameDelta: number;
  bounds: TVector3Tuple;
  pointer: { active: boolean; position: TVector3Tuple };
};

const FIXED_STEP = 1 / 60;
const MAX_SUBSTEPS = 3;
const MAX_FRAME_DELTA = 1 / 20;
const RESTITUTION = 0.72;
const DAMPING = 0.985;
const POINTER_RADIUS = 1.8;
const POINTER_STRENGTH = 3.8;

const bodyFromNode = (node: TMarketBubbleNode): TGravityBody => ({
  id: node.id,
  radius: node.radius,
  mass: node.mass,
  activity: node.activity,
  position: [node.seedPosition[0], node.seedPosition[1], node.seedPosition[2]],
  velocity: [node.seedVelocity[0], node.seedVelocity[1], node.seedVelocity[2]],
});

export const createGravitySimulation = (
  nodes: TMarketBubbleNode[],
): TGravitySimulation => ({
  accumulator: 0,
  bodies: nodes.map(bodyFromNode),
});

export const syncGravityBodies = (
  simulation: TGravitySimulation,
  nodes: TMarketBubbleNode[],
): void => {
  const previous = new Map(simulation.bodies.map((body) => [body.id, body]));
  simulation.bodies = nodes.map((node) => {
    const body = previous.get(node.id);
    if (!body) return bodyFromNode(node);
    body.radius = node.radius;
    body.mass = node.mass;
    body.activity = node.activity;
    return body;
  });
};

const resolveBounds = (body: TGravityBody, bounds: TVector3Tuple): void => {
  for (const axis of [0, 1, 2] as const) {
    const limit = Math.max(0, bounds[axis] - body.radius);
    if (body.position[axis] > limit) {
      body.position[axis] = limit;
      body.velocity[axis] = -Math.abs(body.velocity[axis]) * RESTITUTION;
    } else if (body.position[axis] < -limit) {
      body.position[axis] = -limit;
      body.velocity[axis] = Math.abs(body.velocity[axis]) * RESTITUTION;
    }
  }
};

const step = (
  bodies: TGravityBody[],
  input: TGravityStepInput,
  delta: number,
): void => {
  const damping = DAMPING ** (delta / FIXED_STEP);

  for (const body of bodies) {
    const isActive = body.id === input.activeMarketId;
    const target: TVector3Tuple = isActive ? [0, 0, 0.45] : [0, 0, 0];
    const attraction = isActive ? 0.9 : 0.11;

    for (const axis of [0, 1, 2] as const) {
      body.velocity[axis] +=
        (target[axis] - body.position[axis]) * attraction * delta;
    }

    if (input.pointer.active) {
      const offset: TMutableVector3 = [
        body.position[0] - input.pointer.position[0],
        body.position[1] - input.pointer.position[1],
        body.position[2] - input.pointer.position[2],
      ];
      const distance = Math.hypot(...offset);
      if (distance < POINTER_RADIUS) {
        const normal: TVector3Tuple =
          distance > Number.EPSILON
            ? [offset[0] / distance, offset[1] / distance, offset[2] / distance]
            : [1, 0, 0];
        const strength =
          (1 - distance / POINTER_RADIUS) *
          POINTER_STRENGTH *
          (1 + body.activity * 0.35);
        for (const axis of [0, 1, 2] as const) {
          body.velocity[axis] += normal[axis] * strength * delta;
        }
      }
    }

    for (const axis of [0, 1, 2] as const) {
      body.velocity[axis] *= damping;
      body.position[axis] += body.velocity[axis] * delta;
    }
  }

  for (let leftIndex = 0; leftIndex < bodies.length; leftIndex += 1) {
    const left = bodies[leftIndex];
    if (!left) continue;
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < bodies.length;
      rightIndex += 1
    ) {
      const right = bodies[rightIndex];
      if (!right) continue;
      const offset: TMutableVector3 = [
        right.position[0] - left.position[0],
        right.position[1] - left.position[1],
        right.position[2] - left.position[2],
      ];
      const distance = Math.hypot(...offset);
      const minimumDistance = left.radius + right.radius;
      if (distance >= minimumDistance) continue;

      const normal: TVector3Tuple =
        distance > Number.EPSILON
          ? [offset[0] / distance, offset[1] / distance, offset[2] / distance]
          : [1, 0, 0];
      const inverseLeftMass = 1 / Math.max(left.mass, Number.EPSILON);
      const inverseRightMass = 1 / Math.max(right.mass, Number.EPSILON);
      const inverseMassSum = inverseLeftMass + inverseRightMass;
      const overlap = minimumDistance - distance;

      for (const axis of [0, 1, 2] as const) {
        left.position[axis] -=
          normal[axis] * overlap * (inverseLeftMass / inverseMassSum);
        right.position[axis] +=
          normal[axis] * overlap * (inverseRightMass / inverseMassSum);
      }

      const relativeNormalVelocity =
        (right.velocity[0] - left.velocity[0]) * normal[0] +
        (right.velocity[1] - left.velocity[1]) * normal[1] +
        (right.velocity[2] - left.velocity[2]) * normal[2];
      if (relativeNormalVelocity < 0) {
        const impulse =
          (-(1 + RESTITUTION) * relativeNormalVelocity) / inverseMassSum;
        for (const axis of [0, 1, 2] as const) {
          left.velocity[axis] -= impulse * inverseLeftMass * normal[axis];
          right.velocity[axis] += impulse * inverseRightMass * normal[axis];
        }
      }
    }
  }

  for (const body of bodies) resolveBounds(body, input.bounds);
};

export const advanceGravitySimulation = (
  simulation: TGravitySimulation,
  input: TGravityStepInput,
): void => {
  if (!Number.isFinite(input.frameDelta) || input.frameDelta <= 0) return;
  simulation.accumulator += Math.min(input.frameDelta, MAX_FRAME_DELTA);

  let substeps = 0;
  while (simulation.accumulator >= FIXED_STEP && substeps < MAX_SUBSTEPS) {
    step(simulation.bodies, input, FIXED_STEP);
    simulation.accumulator -= FIXED_STEP;
    substeps += 1;
  }

  if (substeps === MAX_SUBSTEPS) {
    simulation.accumulator = Math.min(simulation.accumulator, FIXED_STEP);
  }
};
