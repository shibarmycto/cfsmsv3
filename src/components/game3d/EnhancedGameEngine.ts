import * as THREE from 'three';
import { createRealisticCharacter, animateCharacter } from './RealisticCharacter';
import { createUKWorld, GameBuilding } from './UKWorld';
import { buildBuildingBoxes, resolveXZCollision, BuildingBox } from './buildingPhysics';

export interface GameInput {
  forward: number;
  right: number;
  jump: boolean;
  sprint: boolean;
}

export interface PlayerState {
  position: THREE.Vector3;
  rotation: number;
  velocity: THREE.Vector3;
  isGrounded: boolean;
  isMoving: boolean;
  isSprinting: boolean;
}

export interface CameraSettings {
  mode: 'first' | 'third';
  distance: number;
  height: number;
  smoothing: number;
}

export class EnhancedGameEngine {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  player: THREE.Group | null = null;
  buildings: GameBuilding[] = [];
  private buildingBoxes: BuildingBox[] = [];
  
  playerState: PlayerState = {
    position: new THREE.Vector3(0, 0, 0),
    rotation: 0,
    velocity: new THREE.Vector3(0, 0, 0),
    isGrounded: true,
    isMoving: false,
    isSprinting: false
  };

  cameraSettings: CameraSettings = {
    mode: 'third',
    distance: 8,
    height: 3,
    smoothing: 0.1
  };

  // Physics constants - tuned for stability
  readonly WALK_SPEED = 10;
  readonly RUN_SPEED = 18;
  readonly JUMP_FORCE = 10;
  readonly GRAVITY = 28;
  readonly AIR_CONTROL = 0.4;
  readonly GROUND_FRICTION = 0.88;
  readonly AIR_FRICTION = 0.98;
  readonly ROTATION_SPEED = 12;
  readonly ACCELERATION = 40;

  private targetCameraPos = new THREE.Vector3();
  private currentCameraPos = new THREE.Vector3();
  private cameraYaw = 0;
  private clock = new THREE.Clock();
  private isMobile: boolean;
  private frameCount = 0;

  constructor(container: HTMLDivElement, isMobile: boolean = false) {
    this.isMobile = isMobile;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7EC8E3);
    this.scene.fog = new THREE.Fog(0x7EC8E3, 150, 600);

    this.camera = new THREE.PerspectiveCamera(
      isMobile ? 70 : 65,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );

    this.renderer = new THREE.WebGLRenderer({ 
      antialias: !isMobile,
      powerPreference: 'high-performance',
      stencil: false
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = isMobile ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);

    this.setupLighting();
  }

  private setupLighting() {
    // Ambient
    const ambient = new THREE.AmbientLight(0xB0E0FF, 0.6);
    this.scene.add(ambient);

    // Single directional sun - ONLY shadow caster
    const sun = new THREE.DirectionalLight(0xFFFFDD, 1.0);
    sun.position.set(150, 250, 100);
    sun.castShadow = true;
    sun.shadow.mapSize.width = this.isMobile ? 1024 : 2048;
    sun.shadow.mapSize.height = this.isMobile ? 1024 : 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 600;
    sun.shadow.camera.left = -200;
    sun.shadow.camera.right = 200;
    sun.shadow.camera.top = 200;
    sun.shadow.camera.bottom = -200;
    sun.shadow.bias = -0.0001;
    this.scene.add(sun);

    // Fill light - no shadows
    const fill = new THREE.DirectionalLight(0x8080FF, 0.3);
    fill.position.set(-100, 100, -50);
    this.scene.add(fill);

    // Hemisphere for natural sky/ground
    const hemi = new THREE.HemisphereLight(0x87CEEB, 0x3D5C3D, 0.4);
    this.scene.add(hemi);
  }

  initWorld(characterName: string, startPos?: { x: number; z: number }) {
    this.buildings = createUKWorld(this.scene);
    
    // Build collision boxes for buildings
    this.buildingBoxes = buildBuildingBoxes(this.buildings, 0.8);

    // Create player
    this.player = createRealisticCharacter({ name: characterName, isPlayer: true });
    
    // Find a safe spawn point not inside any building
    const spawn = startPos || { x: 0, z: 0 };
    const safeSpawn = this.findSafeSpawn(spawn.x, spawn.z);
    
    this.playerState.position.set(safeSpawn.x, 0, safeSpawn.z);
    this.playerState.velocity.set(0, 0, 0);
    this.playerState.isGrounded = true;
    
    this.player.position.copy(this.playerState.position);
    this.scene.add(this.player);

    this.updateCameraPosition(true);
  }

  private findSafeSpawn(x: number, z: number): { x: number; z: number } {
    const point = new THREE.Vector3(x, 0, z);
    const isBlocked = this.buildingBoxes.some(b => b.box.containsPoint(point));
    if (!isBlocked) return { x, z };
    
    // Spiral outward to find a clear spot
    for (let r = 2; r < 50; r += 2) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        const tx = x + Math.cos(a) * r;
        const tz = z + Math.sin(a) * r;
        point.set(tx, 0, tz);
        if (!this.buildingBoxes.some(b => b.box.containsPoint(point))) {
          return { x: tx, z: tz };
        }
      }
    }
    return { x: 5, z: 5 }; // Fallback
  }

  update(input: GameInput): { position: { x: number; y: number; z: number }; nearbyBuilding: GameBuilding | null } {
    const delta = Math.min(this.clock.getDelta(), 0.033); // Cap at ~30fps worth of physics
    this.frameCount++;

    this.updatePlayerMovement(input, delta);
    this.updatePlayerAnimation(delta);
    this.updateCameraPosition(false);
    
    this.renderer.render(this.scene, this.camera);

    // Check nearby buildings every 3 frames for performance
    const nearbyBuilding = this.frameCount % 3 === 0 ? this.checkNearbyBuildings() : null;

    return {
      position: {
        x: this.playerState.position.x,
        y: this.playerState.position.y,
        z: this.playerState.position.z
      },
      nearbyBuilding
    };
  }

  private updatePlayerMovement(input: GameInput, delta: number) {
    const { forward, right, jump, sprint } = input;

    const targetSpeed = sprint ? this.RUN_SPEED : this.WALK_SPEED;
    const friction = this.playerState.isGrounded ? this.GROUND_FRICTION : this.AIR_FRICTION;
    const control = this.playerState.isGrounded ? 1 : this.AIR_CONTROL;

    const hasInput = Math.abs(forward) > 0.1 || Math.abs(right) > 0.1;
    this.playerState.isMoving = hasInput;
    this.playerState.isSprinting = sprint && hasInput;

    if (hasInput) {
      const inputMagnitude = Math.min(Math.sqrt(forward * forward + right * right), 1);

      const cosYaw = Math.cos(this.cameraYaw);
      const sinYaw = Math.sin(this.cameraYaw);
      const worldForward = forward * cosYaw + right * sinYaw;
      const worldRight = -forward * sinYaw + right * cosYaw;

      const targetAngle = Math.atan2(worldRight, worldForward);
      
      let angleDiff = targetAngle - this.playerState.rotation;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      this.playerState.rotation += angleDiff * Math.min(1, this.ROTATION_SPEED * delta);

      const targetVelX = Math.sin(targetAngle) * targetSpeed * inputMagnitude;
      const targetVelZ = Math.cos(targetAngle) * targetSpeed * inputMagnitude;

      this.playerState.velocity.x += (targetVelX - this.playerState.velocity.x) * this.ACCELERATION * delta * control;
      this.playerState.velocity.z += (targetVelZ - this.playerState.velocity.z) * this.ACCELERATION * delta * control;
    } else {
      this.playerState.velocity.x *= friction;
      this.playerState.velocity.z *= friction;
      // Zero out tiny velocities to prevent drift
      if (Math.abs(this.playerState.velocity.x) < 0.01) this.playerState.velocity.x = 0;
      if (Math.abs(this.playerState.velocity.z) < 0.01) this.playerState.velocity.z = 0;
    }

    // Jump - only when solidly grounded
    if (jump && this.playerState.isGrounded && this.playerState.velocity.y === 0) {
      this.playerState.velocity.y = this.JUMP_FORCE;
      this.playerState.isGrounded = false;
    }

    // Gravity - only when NOT grounded
    if (!this.playerState.isGrounded) {
      this.playerState.velocity.y -= this.GRAVITY * delta;
      // Terminal velocity
      this.playerState.velocity.y = Math.max(this.playerState.velocity.y, -30);
    }

    // Calculate next position
    const nextX = this.playerState.position.x + this.playerState.velocity.x * delta;
    const nextZ = this.playerState.position.z + this.playerState.velocity.z * delta;

    // Building collision - slide along walls
    const resolved = resolveXZCollision(
      { x: this.playerState.position.x, z: this.playerState.position.z },
      { x: nextX, z: nextZ },
      this.buildingBoxes
    );

    // If collision blocked movement, zero out that velocity component
    if (resolved.x === this.playerState.position.x) this.playerState.velocity.x = 0;
    if (resolved.z === this.playerState.position.z) this.playerState.velocity.z = 0;

    this.playerState.position.x = resolved.x;
    this.playerState.position.z = resolved.z;

    // Vertical movement
    this.playerState.position.y += this.playerState.velocity.y * delta;

    // Ground collision - HARD clamp
    if (this.playerState.position.y <= 0) {
      this.playerState.position.y = 0;
      this.playerState.velocity.y = 0;
      this.playerState.isGrounded = true;
    }

    // World bounds
    const WORLD_LIMIT = 800;
    this.playerState.position.x = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, this.playerState.position.x));
    this.playerState.position.z = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, this.playerState.position.z));

    // Update player mesh
    if (this.player) {
      this.player.position.copy(this.playerState.position);
      this.player.rotation.y = this.playerState.rotation;
    }
  }

  private updatePlayerAnimation(delta: number) {
    if (this.player) {
      animateCharacter(
        this.player, 
        this.playerState.isMoving, 
        this.playerState.isSprinting, 
        delta
      );
    }
  }

  private updateCameraPosition(instant: boolean) {
    const { mode, distance, height, smoothing } = this.cameraSettings;
    const pos = this.playerState.position;
    const rot = this.playerState.rotation;

    if (mode === 'third') {
      this.targetCameraPos.set(
        pos.x - Math.sin(rot) * distance,
        pos.y + height,
        pos.z - Math.cos(rot) * distance
      );

      if (instant) {
        this.currentCameraPos.copy(this.targetCameraPos);
      } else {
        this.currentCameraPos.lerp(this.targetCameraPos, smoothing);
      }

      this.camera.position.copy(this.currentCameraPos);
      this.camera.lookAt(pos.x, pos.y + 1.5, pos.z);

      this.cameraYaw = Math.atan2(
        pos.x - this.currentCameraPos.x,
        pos.z - this.currentCameraPos.z
      );
    } else {
      this.camera.position.set(pos.x, pos.y + 1.7, pos.z);
      this.camera.lookAt(
        pos.x + Math.sin(rot) * 10,
        pos.y + 1.5,
        pos.z + Math.cos(rot) * 10
      );
      this.cameraYaw = rot;
    }
  }

  setCameraMode(mode: 'first' | 'third') {
    this.cameraSettings.mode = mode;
    if (mode === 'first') {
      this.cameraSettings.distance = 0;
      this.cameraSettings.height = 1.7;
    } else {
      this.cameraSettings.distance = 8;
      this.cameraSettings.height = 3;
    }
  }

  private checkNearbyBuildings(): GameBuilding | null {
    const px = this.playerState.position.x;
    const pz = this.playerState.position.z;
    let closest: GameBuilding | null = null;
    let closestDist = 25;

    for (const building of this.buildings) {
      const dx = px - building.position.x;
      const dz = pz - building.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < closestDist) {
        closestDist = dist;
        closest = building;
      }
    }

    return closest;
  }

  handleResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  dispose() {
    this.renderer.dispose();
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else if (obj.material) {
          obj.material.dispose();
        }
      }
    });
    this.scene.clear();
  }
}
