import * as THREE from 'three';

export default class Game3DPlayer {
  mesh: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  speed: number = 50;
  isMoving: boolean = false;
  animationTime: number = 0;

  constructor(scene: THREE.Scene, playerId: string, playerName: string) {
    this.mesh = new THREE.Group();
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);

    // Create player body (cylinder)
    const bodyGeometry = new THREE.CylinderGeometry(2, 2, 4, 32);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 2;
    body.castShadow = true;
    body.receiveShadow = true;
    this.mesh.add(body);

    // Create head (sphere)
    const headGeometry = new THREE.SphereGeometry(1.5, 32, 32);
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xF4A460 });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 5.5;
    head.castShadow = true;
    head.receiveShadow = true;
    this.mesh.add(head);

    // Create arms
    const armGeometry = new THREE.CylinderGeometry(0.5, 0.5, 3, 16);
    const armMaterial = new THREE.MeshStandardMaterial({ color: 0xF4A460 });

    const leftArm = new THREE.Mesh(armGeometry, armMaterial);
    leftArm.position.set(-2.5, 3, 0);
    leftArm.castShadow = true;
    leftArm.receiveShadow = true;
    this.mesh.add(leftArm);

    const rightArm = new THREE.Mesh(armGeometry, armMaterial);
    rightArm.position.set(2.5, 3, 0);
    rightArm.castShadow = true;
    rightArm.receiveShadow = true;
    this.mesh.add(rightArm);

    // Create legs
    const legGeometry = new THREE.CylinderGeometry(0.6, 0.6, 2, 16);
    const legMaterial = new THREE.MeshStandardMaterial({ color: 0x2C2C2C });

    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-1, 1, 0);
    leftLeg.castShadow = true;
    leftLeg.receiveShadow = true;
    this.mesh.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(1, 1, 0);
    rightLeg.castShadow = true;
    rightLeg.receiveShadow = true;
    this.mesh.add(rightLeg);

    // Add name label (using canvas texture)
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 40, 256, 48);
      ctx.fillStyle = 'white';
      ctx.font = 'Bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(playerName, 128, 75);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(8, 4, 1);
    sprite.position.y = 8;
    this.mesh.add(sprite);

    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
  }

  move(x: number, z: number, deltaTime: number) {
    const moveVector = new THREE.Vector3(x, 0, z).normalize();

    if (x !== 0 || z !== 0) {
      this.isMoving = true;
      this.position.add(moveVector.multiplyScalar(this.speed * deltaTime));
    } else {
      this.isMoving = false;
    }

    this.mesh.position.copy(this.position);
  }

  update(deltaTime: number) {
    this.animationTime += deltaTime;

    // Simple leg swing animation
    const arms = this.mesh.children.filter((child) => child instanceof THREE.Mesh);
    if (this.isMoving) {
      arms.forEach((arm, index) => {
        if (index === 2 || index === 3) { // Arms
          const rotation = Math.sin(this.animationTime * 5) * 0.3;
          arm.rotation.z = index === 2 ? rotation : -rotation;
        }
      });
    }
  }
}
