import * as THREE from 'three';

export class PlayerController {
  group: THREE.Group;
  velocity: THREE.Vector3 = new THREE.Vector3();
  position: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  rotation: number = 0;
  isGrounded: boolean = true;
  health: number = 100;
  speed: number = 0.2;
  runSpeed: number = 0.4;
  jumpPower: number = 15;
  mass: number = 1;
  friction: number = 0.08;
  state: 'idle' | 'walking' | 'running' | 'jumping' = 'idle';

  // Animation
  animationTime: number = 0;
  walkCycleSpeed: number = 0.1;

  // Body parts
  head: THREE.Mesh;
  body: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;

  constructor(scene: THREE.Scene, startPos?: { x: number; y: number; z: number }) {
    this.group = new THREE.Group();
    
    if (startPos) {
      this.position.set(startPos.x, startPos.y, startPos.z);
      this.group.position.copy(this.position);
    }

    // Create player body
    this.createBody();

    scene.add(this.group);
  }

  private createBody() {
    // Realistic skin tone
    const skinMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4a574,
      roughness: 0.5,
      metalness: 0,
    });

    // Head
    const headGeometry = new THREE.SphereGeometry(0.35, 32, 32);
    this.head = new THREE.Mesh(headGeometry, skinMaterial.clone());
    this.head.position.y = 1.95;
    this.head.castShadow = true;
    this.head.receiveShadow = true;
    this.group.add(this.head);

    // Body (torso)
    const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.45, 1.2, 16);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c3e50,
      roughness: 0.6,
      metalness: 0,
    });
    this.body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    this.body.position.y = 0.7;
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.group.add(this.body);

    // Arms
    const armGeometry = new THREE.CylinderGeometry(0.2, 0.15, 0.9, 16);
    const armMaterial = skinMaterial.clone();

    this.leftArm = new THREE.Mesh(armGeometry, armMaterial);
    this.leftArm.position.set(-0.65, 1.2, 0);
    this.leftArm.castShadow = true;
    this.leftArm.receiveShadow = true;
    this.group.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeometry, armMaterial.clone());
    this.rightArm.position.set(0.65, 1.2, 0);
    this.rightArm.castShadow = true;
    this.rightArm.receiveShadow = true;
    this.group.add(this.rightArm);

    // Legs
    const legGeometry = new THREE.CylinderGeometry(0.25, 0.2, 1, 16);
    const legMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.6,
    });

    this.leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    this.leftLeg.position.set(-0.3, 0.4, 0);
    this.leftLeg.castShadow = true;
    this.leftLeg.receiveShadow = true;
    this.group.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeometry, legMaterial.clone());
    this.rightLeg.position.set(0.3, 0.4, 0);
    this.rightLeg.castShadow = true;
    this.rightLeg.receiveShadow = true;
    this.group.add(this.rightLeg);

    // Shoes
    const shoeGeometry = new THREE.BoxGeometry(0.35, 0.3, 0.5);
    const shoeMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.7,
    });

    const leftShoe = new THREE.Mesh(shoeGeometry, shoeMaterial);
    leftShoe.position.set(-0.3, -0.4, 0);
    this.group.add(leftShoe);

    const rightShoe = new THREE.Mesh(shoeGeometry, shoeMaterial.clone());
    rightShoe.position.set(0.3, -0.4, 0);
    this.group.add(rightShoe);
  }

  update(input: { forward: number; right: number; jump: boolean; run: boolean }, deltaTime: number) {
    // Apply gravity
    if (!this.isGrounded) {
      this.velocity.y -= 9.8 * deltaTime * this.mass;
    } else if (input.jump) {
      this.velocity.y = this.jumpPower;
      this.isGrounded = false;
    }

    // Movement
    const moveSpeed = input.run ? this.runSpeed : this.speed;
    const moveDirection = new THREE.Vector3(input.right, 0, -input.forward).normalize();

    if (moveDirection.length() > 0.1) {
      this.velocity.x = moveDirection.x * moveSpeed;
      this.velocity.z = moveDirection.z * moveSpeed;
      this.rotation = Math.atan2(moveDirection.x, moveDirection.z);
      
      if (input.run) {
        this.state = 'running';
      } else {
        this.state = 'walking';
      }
    } else {
      // Friction
      this.velocity.x *= (1 - this.friction);
      this.velocity.z *= (1 - this.friction);
      this.state = 'idle';
    }

    // Update position
    this.position.add(this.velocity.clone().multiplyScalar(deltaTime));
    this.group.position.copy(this.position);
    this.group.rotation.y = this.rotation;

    // Update animation
    this.updateAnimation(deltaTime);
  }

  private updateAnimation(deltaTime: number) {
    this.animationTime += deltaTime;

    if (this.state === 'walking' || this.state === 'running') {
      const cycle = Math.sin(this.animationTime * (this.state === 'running' ? 12 : 6)) * 0.3;
      
      this.leftArm.rotation.z = cycle;
      this.rightArm.rotation.z = -cycle;
      this.leftLeg.rotation.z = -cycle * 0.5;
      this.rightLeg.rotation.z = cycle * 0.5;
    } else {
      // Return to idle position
      this.leftArm.rotation.z *= 0.9;
      this.rightArm.rotation.z *= 0.9;
      this.leftLeg.rotation.z *= 0.9;
      this.rightLeg.rotation.z *= 0.9;
    }
  }

  setGrounded(grounded: boolean) {
    this.isGrounded = grounded;
    if (grounded) {
      this.velocity.y = 0;
    }
  }

  getCollisionBox(): THREE.Box3 {
    return new THREE.Box3().setFromObject(this.group);
  }

  takeDamage(amount: number) {
    this.health -= amount;
    if (this.health < 0) {
      this.health = 0;
    }
  }

  heal(amount: number) {
    this.health += amount;
    if (this.health > 100) {
      this.health = 100;
    }
  }
}
