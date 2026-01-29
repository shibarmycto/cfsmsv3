import * as THREE from "three";
import type { GameBuilding } from "./UKWorld";

export type BuildingBox = {
  building: GameBuilding;
  box: THREE.Box3;
};

export function buildBuildingBoxes(buildings: GameBuilding[], padding = 0.6): BuildingBox[] {
  return buildings.map((b) => {
    const half = b.size.clone().multiplyScalar(0.5);
    half.x += padding;
    half.z += padding;

    const min = new THREE.Vector3(b.position.x - half.x, -10, b.position.z - half.z);
    const max = new THREE.Vector3(b.position.x + half.x, 10, b.position.z + half.z);

    return { building: b, box: new THREE.Box3(min, max) };
  });
}

export function resolveXZCollision(
  current: { x: number; z: number },
  next: { x: number; z: number },
  boxes: BuildingBox[]
): { x: number; z: number } {
  const point = new THREE.Vector3(0, 0, 0);

  // If no collision, accept.
  point.set(next.x, 0, next.z);
  const hit = boxes.find((b) => b.box.containsPoint(point));
  if (!hit) return next;

  // Try slide on X
  point.set(next.x, 0, current.z);
  const hitX = boxes.find((b) => b.box.containsPoint(point));
  if (!hitX) return { x: next.x, z: current.z };

  // Try slide on Z
  point.set(current.x, 0, next.z);
  const hitZ = boxes.find((b) => b.box.containsPoint(point));
  if (!hitZ) return { x: current.x, z: next.z };

  // Block movement
  return current;
}

export function findNearestBuilding(
  buildings: GameBuilding[],
  playerPos: { x: number; z: number },
  maxDistance = 10
): GameBuilding | null {
  let nearest: GameBuilding | null = null;
  let min = maxDistance;
  for (const b of buildings) {
    const dx = playerPos.x - b.position.x;
    const dz = playerPos.z - b.position.z;
    const d = Math.hypot(dx, dz);
    if (d < min) {
      min = d;
      nearest = b;
    }
  }
  return nearest;
}
