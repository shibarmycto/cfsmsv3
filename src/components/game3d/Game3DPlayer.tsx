import * as THREE from 'three';

export default class Game3DPlayer {
  mesh: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  speed: number = 50;
  isMoving: boolean = false;
  animationTime: number = 0;
  
  // Body parts for animation
  private leftArm: THREE.Mesh;
  private rightArm: THREE.Mesh;
  private leftLeg: THREE.Mesh;
  private rightLeg: THREE.Mesh;

  constructor(scene: THREE.Scene, playerId: string, playerName: string) {
    this.mesh = new THREE.Group();
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);

    // Create realistic GTA-style character
    this.createBody();
    this.createHead(playerName);
    this.createNameLabel(playerName);

    this.mesh.position.copy(this.position);
    scene.add(this.mesh);
  }

  private createBody() {
    // Torso - muscular build
    const torsoGeometry = new THREE.CylinderGeometry(1.8, 1.5, 3.5, 16);
    const torsoMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x2c3e50, // Dark shirt
      roughness: 0.7,
      metalness: 0.1
    });
    const torso = new THREE.Mesh(torsoGeometry, torsoMaterial);
    torso.position.y = 3.5;
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.mesh.add(torso);

    // Jacket/outer layer detail
    const jacketGeometry = new THREE.CylinderGeometry(1.9, 1.6, 3.2, 16, 1, true);
    const jacketMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x1a252f,
      roughness: 0.8,
      side: THREE.DoubleSide
    });
    const jacket = new THREE.Mesh(jacketGeometry, jacketMaterial);
    jacket.position.y = 3.6;
    this.mesh.add(jacket);

    // Arms with skin tone
    const armGeometry = new THREE.CylinderGeometry(0.4, 0.35, 2.5, 12);
    const skinMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xc68642, // Skin tone
      roughness: 0.6,
      metalness: 0
    });

    // Left arm
    this.leftArm = new THREE.Mesh(armGeometry, skinMaterial);
    this.leftArm.position.set(-2.2, 3.5, 0);
    this.leftArm.castShadow = true;
    this.mesh.add(this.leftArm);

    // Right arm  
    this.rightArm = new THREE.Mesh(armGeometry, skinMaterial.clone());
    this.rightArm.position.set(2.2, 3.5, 0);
    this.rightArm.castShadow = true;
    this.mesh.add(this.rightArm);

    // Hands
    const handGeometry = new THREE.SphereGeometry(0.35, 12, 12);
    const leftHand = new THREE.Mesh(handGeometry, skinMaterial);
    leftHand.position.set(-2.2, 2, 0);
    this.mesh.add(leftHand);
    
    const rightHand = new THREE.Mesh(handGeometry, skinMaterial.clone());
    rightHand.position.set(2.2, 2, 0);
    this.mesh.add(rightHand);

    // Legs with jeans
    const legGeometry = new THREE.CylinderGeometry(0.6, 0.5, 3, 12);
    const jeansMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x1a3a5c, // Dark blue jeans
      roughness: 0.8
    });

    this.leftLeg = new THREE.Mesh(legGeometry, jeansMaterial);
    this.leftLeg.position.set(-0.8, 1.5, 0);
    this.leftLeg.castShadow = true;
    this.mesh.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeometry, jeansMaterial.clone());
    this.rightLeg.position.set(0.8, 1.5, 0);
    this.rightLeg.castShadow = true;
    this.mesh.add(this.rightLeg);

    // Shoes
    const shoeGeometry = new THREE.BoxGeometry(0.7, 0.4, 1.2);
    const shoeMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x1a1a1a,
      roughness: 0.7
    });
    
    const leftShoe = new THREE.Mesh(shoeGeometry, shoeMaterial);
    leftShoe.position.set(-0.8, 0.2, 0.1);
    this.mesh.add(leftShoe);
    
    const rightShoe = new THREE.Mesh(shoeGeometry, shoeMaterial.clone());
    rightShoe.position.set(0.8, 0.2, 0.1);
    this.mesh.add(rightShoe);
  }

  private createHead(playerName: string) {
    const headGroup = new THREE.Group();
    
    // Head base - more detailed shape
    const headGeometry = new THREE.SphereGeometry(1.2, 24, 24);
    const skinMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xc68642,
      roughness: 0.5,
      metalness: 0
    });
    const head = new THREE.Mesh(headGeometry, skinMaterial);
    head.scale.set(1, 1.1, 0.95); // Slightly elongated
    head.castShadow = true;
    headGroup.add(head);

    // Face features
    // Eyes
    const eyeGeometry = new THREE.SphereGeometry(0.15, 12, 12);
    const eyeWhiteMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const pupilGeometry = new THREE.SphereGeometry(0.08, 12, 12);
    const pupilMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });

    // Left eye
    const leftEyeWhite = new THREE.Mesh(eyeGeometry, eyeWhiteMaterial);
    leftEyeWhite.position.set(-0.35, 0.2, 1);
    headGroup.add(leftEyeWhite);
    
    const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    leftPupil.position.set(-0.35, 0.2, 1.12);
    headGroup.add(leftPupil);

    // Right eye
    const rightEyeWhite = new THREE.Mesh(eyeGeometry, eyeWhiteMaterial.clone());
    rightEyeWhite.position.set(0.35, 0.2, 1);
    headGroup.add(rightEyeWhite);
    
    const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial.clone());
    rightPupil.position.set(0.35, 0.2, 1.12);
    headGroup.add(rightPupil);

    // Eyebrows
    const eyebrowGeometry = new THREE.BoxGeometry(0.3, 0.08, 0.1);
    const eyebrowMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    
    const leftEyebrow = new THREE.Mesh(eyebrowGeometry, eyebrowMaterial);
    leftEyebrow.position.set(-0.35, 0.45, 1.05);
    leftEyebrow.rotation.z = 0.1;
    headGroup.add(leftEyebrow);
    
    const rightEyebrow = new THREE.Mesh(eyebrowGeometry, eyebrowMaterial.clone());
    rightEyebrow.position.set(0.35, 0.45, 1.05);
    rightEyebrow.rotation.z = -0.1;
    headGroup.add(rightEyebrow);

    // Nose
    const noseGeometry = new THREE.ConeGeometry(0.15, 0.4, 8);
    const noseMaterial = new THREE.MeshStandardMaterial({ color: 0xb5733c });
    const nose = new THREE.Mesh(noseGeometry, noseMaterial);
    nose.position.set(0, 0, 1.15);
    nose.rotation.x = Math.PI / 2;
    headGroup.add(nose);

    // Mouth
    const mouthGeometry = new THREE.BoxGeometry(0.4, 0.08, 0.05);
    const mouthMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
    const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
    mouth.position.set(0, -0.35, 1.1);
    headGroup.add(mouth);

    // Ears
    const earGeometry = new THREE.SphereGeometry(0.2, 12, 12);
    const leftEar = new THREE.Mesh(earGeometry, skinMaterial.clone());
    leftEar.position.set(-1.15, 0.1, 0);
    leftEar.scale.set(0.4, 1, 0.6);
    headGroup.add(leftEar);
    
    const rightEar = new THREE.Mesh(earGeometry, skinMaterial.clone());
    rightEar.position.set(1.15, 0.1, 0);
    rightEar.scale.set(0.4, 1, 0.6);
    headGroup.add(rightEar);

    // Hair (short fade style)
    const hairGeometry = new THREE.SphereGeometry(1.25, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2);
    const hairMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x1a1a1a,
      roughness: 0.9
    });
    const hair = new THREE.Mesh(hairGeometry, hairMaterial);
    hair.position.y = 0.1;
    headGroup.add(hair);

    headGroup.position.y = 6;
    this.mesh.add(headGroup);
  }

  private createNameLabel(playerName: string) {
    // Name label above head
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.roundRect(8, 8, 240, 48, 12);
      ctx.fill();
      
      ctx.fillStyle = '#00d4ff';
      ctx.font = 'Bold 28px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(playerName, 128, 32);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ 
      map: texture,
      transparent: true
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(8, 2, 1);
    sprite.position.y = 9;
    this.mesh.add(sprite);
  }

  move(x: number, z: number, deltaTime: number) {
    const moveVector = new THREE.Vector3(x, 0, z).normalize();

    if (x !== 0 || z !== 0) {
      this.isMoving = true;
      this.position.add(moveVector.multiplyScalar(this.speed * deltaTime));
      
      // Rotate character to face movement direction
      const targetRotation = Math.atan2(x, z);
      this.mesh.rotation.y = targetRotation;
    } else {
      this.isMoving = false;
    }

    this.mesh.position.copy(this.position);
  }

  update(deltaTime: number) {
    this.animationTime += deltaTime;

    if (this.isMoving) {
      // Walking animation
      const walkSpeed = 8;
      const swingAmount = 0.4;
      const cycle = Math.sin(this.animationTime * walkSpeed);
      
      // Arm swing
      this.leftArm.rotation.x = cycle * swingAmount;
      this.rightArm.rotation.x = -cycle * swingAmount;
      
      // Leg swing
      this.leftLeg.rotation.x = -cycle * swingAmount * 0.8;
      this.rightLeg.rotation.x = cycle * swingAmount * 0.8;
    } else {
      // Return to idle - smooth interpolation
      this.leftArm.rotation.x *= 0.9;
      this.rightArm.rotation.x *= 0.9;
      this.leftLeg.rotation.x *= 0.9;
      this.rightLeg.rotation.x *= 0.9;
    }
  }
}
