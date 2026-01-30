import * as THREE from 'three';
import { createRealisticCharacter, animateCharacter } from './RealisticCharacter';
import { createUKWorld, GameBuilding } from './UKWorld';

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

  // Enhanced physics constants
  readonly WALK_SPEED = 12; // Increased from 6
  readonly RUN_SPEED = 22; // Increased from 12
  readonly JUMP_FORCE = 12; // Increased for better jumps
  readonly GRAVITY = 32; // Slightly higher for snappier falls
  readonly AIR_CONTROL = 0.4; // Control while in air
  readonly GROUND_FRICTION = 0.92;
  readonly AIR_FRICTION = 0.98;
  readonly ROTATION_SPEED = 12;
  readonly ACCELERATION = 50; // How quickly player reaches max speed

  private targetCameraPos = new THREE.Vector3();
  private currentCameraPos = new THREE.Vector3();
  private clock = new THREE.Clock();
  private isMobile: boolean;

  constructor(container: HTMLDivElement, isMobile: boolean = false) {
    this.isMobile = isMobile;

    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7EC8E3); // Brighter sky
    this.scene.fog = new THREE.Fog(0x7EC8E3, 150, 600);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      isMobile ? 70 : 65,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );

    // Renderer with optimizations
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: !isMobile,
      powerPreference: 'high-performance',
      stencil: false
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);

    this.setupLighting();
  }

  private setupLighting() {
    // Ambient - slightly blue tint for sky bounce
    const ambient = new THREE.AmbientLight(0xB0E0FF, 0.5);
    this.scene.add(ambient);

    // Main sun light
    const sun = new THREE.DirectionalLight(0xFFFFDD, 1.0);
    sun.position.set(150, 250, 100);
    sun.castShadow = true;
    
    // High quality shadows
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 600;
    sun.shadow.camera.left = -200;
    sun.shadow.camera.right = 200;
    sun.shadow.camera.top = 200;
    sun.shadow.camera.bottom = -200;
    sun.shadow.bias = -0.0001;
    this.scene.add(sun);

    // Fill light from opposite side
    const fill = new THREE.DirectionalLight(0x8080FF, 0.3);
    fill.position.set(-100, 100, -50);
    this.scene.add(fill);

    // Hemisphere light for natural sky/ground color
    const hemi = new THREE.HemisphereLight(0x87CEEB, 0x3D5C3D, 0.4);
    this.scene.add(hemi);
  }

  initWorld(characterName: string, startPos?: { x: number; z: number }) {
    // Create world
    this.buildings = createUKWorld(this.scene);

    // Create player
    this.player = createRealisticCharacter({ name: characterName, isPlayer: true });
    
    if (startPos) {
      this.playerState.position.set(startPos.x, 0, startPos.z);
    }
    this.player.position.copy(this.playerState.position);
    this.scene.add(this.player);

    // Initialize camera position
    this.updateCameraPosition(true);
  }

  update(input: GameInput): { position: { x: number; y: number; z: number }; nearbyBuilding: GameBuilding | null } {
    const delta = Math.min(this.clock.getDelta(), 0.05);

    this.updatePlayerMovement(input, delta);
    this.updatePlayerAnimation(delta);
    this.updateCameraPosition(false);
    
    this.renderer.render(this.scene, this.camera);

    const nearbyBuilding = this.checkNearbyBuildings();

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

    // Determine speed
    const targetSpeed = sprint ? this.RUN_SPEED : this.WALK_SPEED;
    const friction = this.playerState.isGrounded ? this.GROUND_FRICTION : this.AIR_FRICTION;
    const control = this.playerState.isGrounded ? 1 : this.AIR_CONTROL;

    // Calculate movement direction
    const hasInput = Math.abs(forward) > 0.1 || Math.abs(right) > 0.1;
    this.playerState.isMoving = hasInput;
    this.playerState.isSprinting = sprint && hasInput;

    if (hasInput) {
      // Calculate target velocity based on input
      const inputMagnitude = Math.min(Math.sqrt(forward * forward + right * right), 1);
      const targetAngle = Math.atan2(right, -forward);
      
      // Smooth rotation
      let angleDiff = targetAngle - this.playerState.rotation;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      this.playerState.rotation += angleDiff * Math.min(1, this.ROTATION_SPEED * delta);

      // Apply acceleration towards target velocity
      const targetVelX = Math.sin(targetAngle) * targetSpeed * inputMagnitude;
      const targetVelZ = Math.cos(targetAngle) * targetSpeed * inputMagnitude;

      this.playerState.velocity.x += (targetVelX - this.playerState.velocity.x) * this.ACCELERATION * delta * control;
      this.playerState.velocity.z += (targetVelZ - this.playerState.velocity.z) * this.ACCELERATION * delta * control;
    } else {
      // Apply friction when no input
      this.playerState.velocity.x *= friction;
      this.playerState.velocity.z *= friction;
    }

    // Jump
    if (jump && this.playerState.isGrounded) {
      this.playerState.velocity.y = this.JUMP_FORCE;
      this.playerState.isGrounded = false;
    }

    // Gravity
    if (!this.playerState.isGrounded) {
      this.playerState.velocity.y -= this.GRAVITY * delta;
    }

    // Apply velocity
    this.playerState.position.x += this.playerState.velocity.x * delta;
    this.playerState.position.z += this.playerState.velocity.z * delta;
    this.playerState.position.y += this.playerState.velocity.y * delta;

    // Ground collision
    if (this.playerState.position.y <= 0) {
      this.playerState.position.y = 0;
      this.playerState.velocity.y = 0;
      this.playerState.isGrounded = true;
    }

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
      // Third person camera - behind and above player
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
    } else {
      // First person camera - at eye level
      this.camera.position.set(
        pos.x,
        pos.y + 1.7, // Eye height
        pos.z
      );
      
      // Look in the direction player is facing
      this.camera.lookAt(
        pos.x + Math.sin(rot) * 10,
        pos.y + 1.5,
        pos.z + Math.cos(rot) * 10
      );
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
    const playerPos = new THREE.Vector2(this.playerState.position.x, this.playerState.position.z);
    let closest: GameBuilding | null = null;
    let closestDist = 25; // Interaction range

    for (const building of this.buildings) {
      const buildingPos = new THREE.Vector2(building.position.x, building.position.z);
      const dist = playerPos.distanceTo(buildingPos);
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
    this.scene.clear();
  }
}
