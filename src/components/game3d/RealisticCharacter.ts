import * as THREE from 'three';

interface CharacterOptions {
  skinTone?: number;
  hairColor?: number;
  shirtColor?: number;
  pantsColor?: number;
  name?: string;
  isPlayer?: boolean;
}

// Highly detailed human character using anatomical proportions
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

  // PBR Materials
  const skinMat = new THREE.MeshStandardMaterial({
    color: skinTone,
    roughness: 0.55,
    metalness: 0.05,
    envMapIntensity: 0.8,
  });

  const clothMat = new THREE.MeshStandardMaterial({
    color: shirtColor,
    roughness: 0.65,
    metalness: 0.0,
  });

  const pantsMat = new THREE.MeshStandardMaterial({
    color: pantsColor,
    roughness: 0.75,
    metalness: 0.0,
  });

  const hairMat = new THREE.MeshStandardMaterial({
    color: hairColor,
    roughness: 0.85,
    metalness: 0.05,
  });

  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.4,
    metalness: 0.15,
  });

  // === HEAD (anatomically proportioned) ===
  const headGroup = new THREE.Group();
  headGroup.name = 'head';

  // Skull - slightly elongated sphere
  const skull = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 24, 24),
    skinMat
  );
  skull.scale.set(0.92, 1.05, 0.95);
  skull.castShadow = true;
  headGroup.add(skull);

  // Jaw / chin
  const jaw = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6),
    skinMat.clone()
  );
  jaw.position.set(0, -0.12, 0.02);
  jaw.scale.set(0.88, 0.55, 0.85);
  headGroup.add(jaw);

  // Eyes
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8f8f0, roughness: 0.2 });
  const irisMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.3 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a });

  [-1, 1].forEach(side => {
    const eyeGroup = new THREE.Group();
    eyeGroup.name = side < 0 ? 'leftEye' : 'rightEye';

    const white = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 12), eyeWhiteMat);
    white.scale.set(1.2, 1, 0.7);
    eyeGroup.add(white);

    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 10), irisMat);
    iris.position.z = 0.032;
    eyeGroup.add(iris);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), pupilMat);
    pupil.position.z = 0.038;
    eyeGroup.add(pupil);

    // Specular highlight
    const highlight = new THREE.Mesh(
      new THREE.SphereGeometry(0.005, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    highlight.position.set(0.008, 0.008, 0.042);
    eyeGroup.add(highlight);

    eyeGroup.position.set(side * 0.085, 0.045, 0.22);
    headGroup.add(eyeGroup);
  });

  // Eyebrows
  [-1, 1].forEach(side => {
    const brow = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.015, 0.02),
      hairMat
    );
    brow.position.set(side * 0.085, 0.1, 0.24);
    brow.rotation.z = side * 0.08;
    headGroup.add(brow);
  });

  // Nose
  const noseBridge = new THREE.Mesh(
    new THREE.BoxGeometry(0.035, 0.08, 0.05),
    skinMat.clone()
  );
  noseBridge.position.set(0, -0.01, 0.26);
  headGroup.add(noseBridge);

  const noseTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 10, 10),
    skinMat.clone()
  );
  noseTip.position.set(0, -0.045, 0.28);
  noseTip.scale.set(1.1, 0.7, 0.9);
  headGroup.add(noseTip);

  // Mouth
  const lipMat = skinMat.clone();
  lipMat.color.offsetHSL(0, 0.05, -0.08);
  const upperLip = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.012, 0.025),
    lipMat
  );
  upperLip.position.set(0, -0.11, 0.24);
  headGroup.add(upperLip);

  const lowerLip = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.014, 0.025),
    lipMat.clone()
  );
  lowerLip.position.set(0, -0.13, 0.235);
  headGroup.add(lowerLip);

  // Ears
  [-1, 1].forEach(side => {
    const ear = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 10, 10),
      skinMat.clone()
    );
    ear.position.set(side * 0.27, 0.01, -0.02);
    ear.scale.set(0.3, 0.8, 0.55);
    headGroup.add(ear);
  });

  // Hair - short fade style
  const hairMain = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
    hairMat
  );
  hairMain.position.y = 0.06;
  hairMain.scale.set(0.96, 0.85, 0.96);
  headGroup.add(hairMain);

  // Fade sides
  const sideFade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.27, 0.25, 0.12, 20, 1, true),
    hairMat.clone()
  );
  sideFade.position.y = -0.02;
  headGroup.add(sideFade);

  headGroup.position.y = 1.62;
  group.add(headGroup);

  // === NECK ===
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.1, 0.14, 12),
    skinMat.clone()
  );
  neck.position.y = 1.4;
  neck.castShadow = true;
  group.add(neck);

  // === TORSO ===
  // Chest - tapered
  const chest = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.24, 0.55, 14),
    clothMat
  );
  chest.position.y = 1.08;
  chest.castShadow = true;
  group.add(chest);

  // Shoulders - give breadth
  [-1, 1].forEach(side => {
    const shoulder = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 10, 10),
      clothMat.clone()
    );
    shoulder.position.set(side * 0.28, 1.28, 0);
    shoulder.scale.set(1.1, 0.7, 0.9);
    shoulder.castShadow = true;
    group.add(shoulder);
  });

  // Abdomen
  const abdomen = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.22, 0.3, 12),
    clothMat.clone()
  );
  abdomen.position.y = 0.73;
  abdomen.castShadow = true;
  group.add(abdomen);

  // === ARMS ===
  [-1, 1].forEach(side => {
    // Upper arm
    const upperArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.055, 0.32, 10),
      clothMat.clone()
    );
    upperArm.position.set(side * 0.34, 1.12, 0);
    upperArm.rotation.z = side * -0.12;
    upperArm.name = side < 0 ? 'leftUpperArm' : 'rightUpperArm';
    upperArm.castShadow = true;
    group.add(upperArm);

    // Forearm
    const forearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.04, 0.28, 10),
      skinMat.clone()
    );
    forearm.position.set(side * 0.38, 0.85, 0);
    forearm.name = side < 0 ? 'leftArm' : 'rightArm';
    forearm.castShadow = true;
    group.add(forearm);

    // Hand
    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 8),
      skinMat.clone()
    );
    hand.position.set(side * 0.38, 0.68, 0);
    hand.scale.set(0.9, 1.2, 0.6);
    group.add(hand);
  });

  // === HIPS ===
  const hips = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.2, 0.14, 12),
    pantsMat
  );
  hips.position.y = 0.55;
  hips.castShadow = true;
  group.add(hips);

  // === LEGS ===
  [-1, 1].forEach(side => {
    // Thigh
    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.075, 0.38, 10),
      pantsMat.clone()
    );
    thigh.position.set(side * 0.1, 0.32, 0);
    thigh.name = side < 0 ? 'leftThigh' : 'rightThigh';
    thigh.castShadow = true;
    group.add(thigh);

    // Calf
    const calf = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.055, 0.34, 10),
      pantsMat.clone()
    );
    calf.position.set(side * 0.1, -0.02, 0);
    calf.name = side < 0 ? 'leftLeg' : 'rightLeg';
    calf.castShadow = true;
    group.add(calf);

    // Shoe
    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.06, 0.17),
      shoeMat.clone()
    );
    shoe.position.set(side * 0.1, -0.21, 0.02);
    shoe.castShadow = true;
    group.add(shoe);
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
    sprite.position.y = 2.1;
    sprite.scale.set(1.6, 0.3, 1);
    group.add(sprite);
  }

  // Scale overall for better world proportions
  group.scale.setScalar(1.15);

  return group;
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

    // Arms swing opposite to legs
    if (leftArm) leftArm.rotation.x = cycle * swing;
    if (rightArm) rightArm.rotation.x = -cycle * swing;
    if (leftUpperArm) leftUpperArm.rotation.x = cycle * swing * 0.7;
    if (rightUpperArm) rightUpperArm.rotation.x = -cycle * swing * 0.7;

    // Legs
    if (leftThigh) leftThigh.rotation.x = -cycle * swing * 0.6;
    if (rightThigh) rightThigh.rotation.x = cycle * swing * 0.6;
    if (leftLeg) leftLeg.rotation.x = -cycle * swing * 0.5;
    if (rightLeg) rightLeg.rotation.x = cycle * swing * 0.5;

    // Subtle head bob
    if (head) {
      head.rotation.z = halfCycle * 0.02;
      head.position.y = 1.62 + Math.abs(cycle) * 0.015;
    }
  } else {
    // Idle breathing
    const breathe = Math.sin(Date.now() * 0.002) * 0.01;
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
      head.position.y = 1.62 + breathe;
    }
  }
}
