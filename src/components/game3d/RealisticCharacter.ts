import * as THREE from 'three';

interface CharacterOptions {
  skinTone?: number;
  hairColor?: number;
  shirtColor?: number;
  pantsColor?: number;
  name?: string;
  isPlayer?: boolean;
  characterPreset?: string;
}

// GTA/OneState style proportional human character
export function createRealisticCharacter(options: CharacterOptions = {}): THREE.Group {
  const {
    skinTone = 0xc68642,
    hairColor = 0x1a1a1a,
    shirtColor = 0x1a1a2e,
    pantsColor = 0x16213e,
    name = '',
    isPlayer = true
  } = options;

  const group = new THREE.Group();

  // PBR Materials with better quality
  const skinMat = new THREE.MeshStandardMaterial({
    color: skinTone, roughness: 0.5, metalness: 0.02,
    envMapIntensity: 1.0,
  });

  const clothMat = new THREE.MeshStandardMaterial({
    color: shirtColor, roughness: 0.6, metalness: 0.0,
  });

  const pantsMat = new THREE.MeshStandardMaterial({
    color: pantsColor, roughness: 0.7, metalness: 0.0,
  });

  const hairMat = new THREE.MeshStandardMaterial({
    color: hairColor, roughness: 0.8, metalness: 0.05,
  });

  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0x111111, roughness: 0.35, metalness: 0.2,
  });

  // === HEAD - smooth, proportional ===
  const headGroup = new THREE.Group();
  headGroup.name = 'head';

  // Skull - smooth sphere, human proportions
  const skull = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 32, 32),
    skinMat
  );
  skull.scale.set(0.95, 1.08, 0.98);
  skull.castShadow = true;
  headGroup.add(skull);

  // Jaw
  const jaw = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
    skinMat.clone()
  );
  jaw.position.set(0, -0.1, 0.02);
  jaw.scale.set(0.9, 0.5, 0.85);
  headGroup.add(jaw);

  // Eyes
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8f8f0, roughness: 0.15 });
  const irisMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.25 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x050505 });

  [-1, 1].forEach(side => {
    const eyeGroup = new THREE.Group();
    eyeGroup.name = side < 0 ? 'leftEye' : 'rightEye';

    const white = new THREE.Mesh(new THREE.SphereGeometry(0.038, 16, 16), eyeWhiteMat);
    white.scale.set(1.15, 0.9, 0.65);
    eyeGroup.add(white);

    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 12), irisMat);
    iris.position.z = 0.028;
    eyeGroup.add(iris);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 10), pupilMat);
    pupil.position.z = 0.033;
    eyeGroup.add(pupil);

    const highlight = new THREE.Mesh(
      new THREE.SphereGeometry(0.004, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    highlight.position.set(0.006, 0.006, 0.036);
    eyeGroup.add(highlight);

    eyeGroup.position.set(side * 0.078, 0.04, 0.19);
    headGroup.add(eyeGroup);
  });

  // Eyebrows - thicker, more natural
  [-1, 1].forEach(side => {
    const brow = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.008, 0.06, 4, 8),
      hairMat
    );
    brow.position.set(side * 0.078, 0.088, 0.21);
    brow.rotation.z = Math.PI / 2 + side * 0.1;
    headGroup.add(brow);
  });

  // Nose - smoother
  const noseBridge = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.014, 0.06, 4, 8),
    skinMat.clone()
  );
  noseBridge.position.set(0, 0, 0.23);
  headGroup.add(noseBridge);

  const noseTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.024, 12, 12),
    skinMat.clone()
  );
  noseTip.position.set(0, -0.038, 0.245);
  noseTip.scale.set(1.1, 0.65, 0.85);
  headGroup.add(noseTip);

  // Mouth
  const lipMat = skinMat.clone();
  lipMat.color.offsetHSL(0, 0.06, -0.1);
  const lips = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.006, 0.05, 4, 8),
    lipMat
  );
  lips.position.set(0, -0.1, 0.215);
  lips.rotation.z = Math.PI / 2;
  headGroup.add(lips);

  // Ears
  [-1, 1].forEach(side => {
    const ear = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 10, 10),
      skinMat.clone()
    );
    ear.position.set(side * 0.235, 0.01, -0.02);
    ear.scale.set(0.25, 0.7, 0.5);
    headGroup.add(ear);
  });

  // Hair - short textured
  const hairMain = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5),
    hairMat
  );
  hairMain.position.y = 0.05;
  hairMain.scale.set(0.98, 0.8, 0.98);
  headGroup.add(hairMain);

  headGroup.position.y = 1.58;
  group.add(headGroup);

  // === NECK ===
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.09, 0.12, 14),
    skinMat.clone()
  );
  neck.position.y = 1.38;
  neck.castShadow = true;
  group.add(neck);

  // === TORSO - athletic build ===
  // Upper chest
  const chest = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.22, 0.48, 16),
    clothMat
  );
  chest.position.y = 1.06;
  chest.castShadow = true;
  group.add(chest);

  // Shoulders
  [-1, 1].forEach(side => {
    const shoulder = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 12),
      clothMat.clone()
    );
    shoulder.position.set(side * 0.26, 1.25, 0);
    shoulder.scale.set(1.1, 0.65, 0.85);
    shoulder.castShadow = true;
    group.add(shoulder);
  });

  // Abdomen
  const abdomen = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.2, 0.26, 14),
    clothMat.clone()
  );
  abdomen.position.y = 0.73;
  abdomen.castShadow = true;
  group.add(abdomen);

  // Belt
  const beltMat = new THREE.MeshStandardMaterial({ color: 0x2a2218, roughness: 0.4, metalness: 0.3 });
  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.21, 0.21, 0.04, 14),
    beltMat
  );
  belt.position.y = 0.6;
  group.add(belt);

  // Belt buckle
  const buckleMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, roughness: 0.2, metalness: 0.9 });
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.02), buckleMat);
  buckle.position.set(0, 0.6, 0.21);
  group.add(buckle);

  // === ARMS ===
  [-1, 1].forEach(side => {
    // Upper arm
    const upperArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.058, 0.05, 0.3, 12),
      clothMat.clone()
    );
    upperArm.position.set(side * 0.32, 1.1, 0);
    upperArm.rotation.z = side * -0.1;
    upperArm.name = side < 0 ? 'leftUpperArm' : 'rightUpperArm';
    upperArm.castShadow = true;
    group.add(upperArm);

    // Forearm
    const forearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.035, 0.26, 12),
      skinMat.clone()
    );
    forearm.position.set(side * 0.35, 0.84, 0);
    forearm.name = side < 0 ? 'leftArm' : 'rightArm';
    forearm.castShadow = true;
    group.add(forearm);

    // Hand
    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 10, 10),
      skinMat.clone()
    );
    hand.position.set(side * 0.35, 0.68, 0);
    hand.scale.set(0.85, 1.15, 0.55);
    hand.name = side < 0 ? 'leftHand' : 'rightHand';
    group.add(hand);
  });

  // === HIPS ===
  const hips = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.18, 0.12, 14),
    pantsMat
  );
  hips.position.y = 0.53;
  hips.castShadow = true;
  group.add(hips);

  // === LEGS ===
  [-1, 1].forEach(side => {
    // Thigh
    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.082, 0.068, 0.36, 12),
      pantsMat.clone()
    );
    thigh.position.set(side * 0.09, 0.3, 0);
    thigh.name = side < 0 ? 'leftThigh' : 'rightThigh';
    thigh.castShadow = true;
    group.add(thigh);

    // Calf
    const calf = new THREE.Mesh(
      new THREE.CylinderGeometry(0.062, 0.048, 0.32, 12),
      pantsMat.clone()
    );
    calf.position.set(side * 0.09, -0.02, 0);
    calf.name = side < 0 ? 'leftLeg' : 'rightLeg';
    calf.castShadow = true;
    group.add(calf);

    // Shoe - sleeker
    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.055, 0.16),
      shoeMat.clone()
    );
    shoe.position.set(side * 0.09, -0.2, 0.02);
    shoe.castShadow = true;
    group.add(shoe);

    // Shoe sole
    const sole = new THREE.Mesh(
      new THREE.BoxGeometry(0.092, 0.015, 0.17),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 })
    );
    sole.position.set(side * 0.09, -0.23, 0.02);
    group.add(sole);
  });

  // === NAME TAG ===
  if (name && !isPlayer) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 48;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.beginPath();
    ctx.roundRect(4, 4, 248, 40, 8);
    ctx.fill();

    ctx.fillStyle = '#00d4ff';
    ctx.font = 'Bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 128, 24);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.y = 2.0;
    sprite.scale.set(1.6, 0.3, 1);
    group.add(sprite);
  }

  // Scale for world proportions
  group.scale.setScalar(1.1);

  return group;
}

// Create a weapon mesh to attach to character hand
export function createWeaponMesh(weaponType: string): THREE.Group {
  const g = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.3, metalness: 0.8 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.6 });

  if (weaponType === 'pistol') {
    // Pistol
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.3), metalMat);
    barrel.position.z = 0.15;
    g.add(barrel);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.06), darkMat);
    grip.position.set(0, -0.08, -0.02);
    grip.rotation.x = -0.2;
    g.add(grip);
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, 0.25), metalMat);
    slide.position.set(0, 0.01, 0.12);
    g.add(slide);
  } else if (weaponType === 'rifle') {
    // Assault rifle
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 8), metalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.35;
    g.add(barrel);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.35), darkMat);
    body.position.z = 0.05;
    g.add(body);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.2), darkMat);
    stock.position.set(0, -0.01, -0.2);
    g.add(stock);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.04), metalMat);
    mag.position.set(0, -0.09, 0.02);
    g.add(mag);
    const grip2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.03), darkMat);
    grip2.position.set(0, -0.07, -0.08);
    grip2.rotation.x = -0.15;
    g.add(grip2);
  } else if (weaponType === 'knife') {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.015, 0.18), metalMat);
    blade.position.z = 0.12;
    g.add(blade);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.1), darkMat);
    handle.position.z = -0.02;
    g.add(handle);
  } else if (weaponType === 'bat') {
    const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.035, 0.6, 8), 
      new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.7 }));
    bat.rotation.x = Math.PI / 2;
    bat.position.z = 0.25;
    g.add(bat);
  }

  return g;
}

export function animateCharacter(
  character: THREE.Group,
  isMoving: boolean,
  isSprinting: boolean,
  deltaTime: number
) {
  const speed = isSprinting ? 14 : 8;
  const swing = isSprinting ? 0.55 : 0.35;
  const time = Date.now() * 0.001 * speed;

  const leftArm = character.getObjectByName('leftArm') as THREE.Mesh;
  const rightArm = character.getObjectByName('rightArm') as THREE.Mesh;
  const leftUpperArm = character.getObjectByName('leftUpperArm') as THREE.Mesh;
  const rightUpperArm = character.getObjectByName('rightUpperArm') as THREE.Mesh;
  const leftLeg = character.getObjectByName('leftLeg') as THREE.Mesh;
  const rightLeg = character.getObjectByName('rightLeg') as THREE.Mesh;
  const leftThigh = character.getObjectByName('leftThigh') as THREE.Mesh;
  const rightThigh = character.getObjectByName('rightThigh') as THREE.Mesh;
  const head = character.getObjectByName('head') as THREE.Group;

  if (isMoving) {
    const cycle = Math.sin(time);
    const halfCycle = Math.sin(time * 0.5);

    if (leftArm) leftArm.rotation.x = cycle * swing;
    if (rightArm) rightArm.rotation.x = -cycle * swing;
    if (leftUpperArm) leftUpperArm.rotation.x = cycle * swing * 0.7;
    if (rightUpperArm) rightUpperArm.rotation.x = -cycle * swing * 0.7;

    if (leftThigh) leftThigh.rotation.x = -cycle * swing * 0.6;
    if (rightThigh) rightThigh.rotation.x = cycle * swing * 0.6;
    if (leftLeg) leftLeg.rotation.x = -cycle * swing * 0.5;
    if (rightLeg) rightLeg.rotation.x = cycle * swing * 0.5;

    if (head) {
      head.rotation.z = halfCycle * 0.02;
      head.position.y = 1.58 + Math.abs(cycle) * 0.012;
    }
  } else {
    // Idle breathing
    const breathe = Math.sin(Date.now() * 0.002) * 0.008;
    const lerp = 0.12;

    if (leftArm) leftArm.rotation.x *= (1 - lerp);
    if (rightArm) rightArm.rotation.x *= (1 - lerp);
    if (leftUpperArm) leftUpperArm.rotation.x *= (1 - lerp);
    if (rightUpperArm) rightUpperArm.rotation.x *= (1 - lerp);
    if (leftThigh) leftThigh.rotation.x *= (1 - lerp);
    if (rightThigh) rightThigh.rotation.x *= (1 - lerp);
    if (leftLeg) leftLeg.rotation.x *= (1 - lerp);
    if (rightLeg) rightLeg.rotation.x *= (1 - lerp);

    if (head) {
      head.rotation.z *= (1 - lerp);
      head.position.y = 1.58 + breathe;
    }
  }
}
