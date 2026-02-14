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

// Preset-to-clothing mapping for distinct visual styles
const PRESET_STYLES: Record<string, { 
  clothingType: 'hoodie' | 'jacket' | 'suit' | 'tactical' | 'streetwear';
  hasChain?: boolean;
  hasTattoos?: boolean;
  hasSunglasses?: boolean;
  hasBeard?: boolean;
  hairStyle?: 'short' | 'bald' | 'slicked' | 'long' | 'mohawk';
  buildType?: 'muscular' | 'lean' | 'athletic' | 'slim';
}> = {
  boss: { clothingType: 'hoodie', hasChain: true, hairStyle: 'short', buildType: 'muscular' },
  enforcer: { clothingType: 'jacket', hasTattoos: true, hairStyle: 'long', buildType: 'slim' },
  hitman: { clothingType: 'tactical', hasSunglasses: true, hairStyle: 'bald', buildType: 'muscular' },
  executive: { clothingType: 'suit', hasBeard: true, hairStyle: 'slicked', buildType: 'lean' },
  soldier: { clothingType: 'tactical', hairStyle: 'short', buildType: 'muscular' },
  rebel: { clothingType: 'streetwear', hairStyle: 'mohawk', buildType: 'athletic' },
  agent: { clothingType: 'jacket', hairStyle: 'long', buildType: 'slim' },
  hunter: { clothingType: 'tactical', hairStyle: 'short', buildType: 'athletic' },
};

export function createRealisticCharacter(options: CharacterOptions = {}): THREE.Group {
  const {
    skinTone = 0xc68642,
    hairColor = 0x1a1a1a,
    shirtColor = 0x1a1a2e,
    pantsColor = 0x16213e,
    name = '',
    isPlayer = true,
    characterPreset = '',
  } = options;

  const style = PRESET_STYLES[characterPreset] || { clothingType: 'streetwear', hairStyle: 'short', buildType: 'athletic' };
  const group = new THREE.Group();

  // === PBR Materials ===
  const skinMat = new THREE.MeshStandardMaterial({
    color: skinTone, roughness: 0.45, metalness: 0.02, envMapIntensity: 1.2,
  });
  const clothMat = new THREE.MeshStandardMaterial({
    color: shirtColor, roughness: 0.55, metalness: 0.0,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: pantsColor, roughness: 0.65, metalness: 0.0,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: hairColor, roughness: 0.75, metalness: 0.05,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0x111111, roughness: 0.3, metalness: 0.25,
  });

  // Build-type multipliers
  const buildScale = style.buildType === 'muscular' ? 1.12 : style.buildType === 'lean' ? 0.92 : style.buildType === 'slim' ? 0.88 : 1.0;

  // =========================================
  //  HEAD (y ≈ 1.72) — realistic proportions
  // =========================================
  const headGroup = new THREE.Group();
  headGroup.name = 'head';

  // Skull — elongated sphere
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 32), skinMat);
  skull.scale.set(0.92, 1.05, 0.95);
  skull.castShadow = true;
  headGroup.add(skull);

  // Jaw line
  const jaw = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
    skinMat.clone()
  );
  jaw.position.set(0, -0.1, 0.02);
  jaw.scale.set(0.88, 0.45, 0.82);
  headGroup.add(jaw);

  // Eyes
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8f8f0, roughness: 0.15 });
  const irisMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.25 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x050505 });

  [-1, 1].forEach(side => {
    const eyeGroup = new THREE.Group();
    eyeGroup.name = side < 0 ? 'leftEye' : 'rightEye';
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.034, 16, 16), eyeWhiteMat);
    white.scale.set(1.15, 0.85, 0.6);
    eyeGroup.add(white);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 12), irisMat);
    iris.position.z = 0.025;
    eyeGroup.add(iris);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 10), pupilMat);
    pupil.position.z = 0.03;
    eyeGroup.add(pupil);
    const highlight = new THREE.Mesh(
      new THREE.SphereGeometry(0.004, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    highlight.position.set(0.005, 0.005, 0.033);
    eyeGroup.add(highlight);
    eyeGroup.position.set(side * 0.072, 0.035, 0.17);
    headGroup.add(eyeGroup);
  });

  // Sunglasses for presets that have them
  if (style.hasSunglasses) {
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.8, transparent: true, opacity: 0.85 });
    [-1, 1].forEach(side => {
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.03, 0.005), glassMat);
      lens.position.set(side * 0.07, 0.035, 0.195);
      headGroup.add(lens);
    });
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.008, 0.005), glassMat);
    bridge.position.set(0, 0.04, 0.195);
    headGroup.add(bridge);
  }

  // Eyebrows
  [-1, 1].forEach(side => {
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.055, 4, 8), hairMat);
    brow.position.set(side * 0.072, 0.082, 0.19);
    brow.rotation.z = Math.PI / 2 + side * 0.08;
    headGroup.add(brow);
  });

  // Nose
  const noseBridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.05, 4, 8), skinMat.clone());
  noseBridge.position.set(0, 0, 0.21);
  headGroup.add(noseBridge);
  const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 12), skinMat.clone());
  noseTip.position.set(0, -0.035, 0.225);
  noseTip.scale.set(1.1, 0.6, 0.85);
  headGroup.add(noseTip);

  // Mouth
  const lipMat = skinMat.clone();
  lipMat.color.offsetHSL(0, 0.06, -0.1);
  const lips = new THREE.Mesh(new THREE.CapsuleGeometry(0.005, 0.04, 4, 8), lipMat);
  lips.position.set(0, -0.09, 0.2);
  lips.rotation.z = Math.PI / 2;
  headGroup.add(lips);

  // Beard for presets that have it
  if (style.hasBeard) {
    const beardMat = hairMat.clone();
    beardMat.color.offsetHSL(0, 0, 0.05);
    const beard = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.35), beardMat);
    beard.position.set(0, -0.08, 0.05);
    beard.scale.set(1.3, 0.8, 1.1);
    headGroup.add(beard);
  }

  // Ears
  [-1, 1].forEach(side => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 10), skinMat.clone());
    ear.position.set(side * 0.215, 0.01, -0.02);
    ear.scale.set(0.22, 0.65, 0.45);
    headGroup.add(ear);
  });

  // Hair — varies by style
  if (style.hairStyle === 'bald') {
    // No hair, just scalp shine
  } else if (style.hairStyle === 'long') {
    const hairMain = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 16), hairMat);
    hairMain.position.set(0, 0.04, -0.02);
    hairMain.scale.set(1.02, 0.85, 1.05);
    headGroup.add(hairMain);
    // Long strands falling down
    const hairBack = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.25, 12), hairMat.clone());
    hairBack.position.set(0, -0.15, -0.1);
    headGroup.add(hairBack);
  } else if (style.hairStyle === 'slicked') {
    const hairMain = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5),
      hairMat
    );
    hairMain.position.y = 0.05;
    hairMain.scale.set(0.98, 0.7, 1.05);
    headGroup.add(hairMain);
  } else if (style.hairStyle === 'mohawk') {
    // Mohawk strip
    const mohawk = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.3), hairMat);
    mohawk.position.set(0, 0.18, -0.02);
    headGroup.add(mohawk);
  } else {
    // Default short hair cap
    const hairMain = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.48),
      hairMat
    );
    hairMain.position.y = 0.04;
    hairMain.scale.set(0.97, 0.75, 0.97);
    headGroup.add(hairMain);
  }

  headGroup.position.y = 1.72;
  group.add(headGroup);

  // === NECK ===
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.085, 0.14, 14),
    skinMat.clone()
  );
  neck.position.y = 1.5;
  neck.castShadow = true;
  group.add(neck);

  // Chain/necklace for Boss preset
  if (style.hasChain) {
    const chainMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.15, metalness: 0.95 });
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 8, 24), chainMat);
    chain.position.set(0, 1.35, 0.08);
    chain.rotation.x = Math.PI / 2;
    group.add(chain);
    // Pendant
    const pendant = new THREE.Mesh(new THREE.OctahedronGeometry(0.025, 0), chainMat);
    pendant.position.set(0, 1.24, 0.14);
    group.add(pendant);
  }

  // =========================================
  //  TORSO — clothing-specific geometry
  // =========================================
  const torsoWidth = 0.28 * buildScale;

  if (style.clothingType === 'hoodie') {
    // Hoodie — bulkier torso with hood nub
    const chest = new THREE.Mesh(
      new THREE.CylinderGeometry(torsoWidth + 0.03, torsoWidth - 0.02, 0.52, 16),
      clothMat
    );
    chest.position.y = 1.16;
    chest.castShadow = true;
    group.add(chest);

    // Hood (collapsed behind head)
    const hood = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6),
      clothMat.clone()
    );
    hood.position.set(0, 1.48, -0.12);
    hood.rotation.x = 0.3;
    group.add(hood);

    // Hoodie pocket
    const pocket = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.06, 0.02),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(shirtColor).offsetHSL(0, 0, -0.05), roughness: 0.6 })
    );
    pocket.position.set(0, 0.96, torsoWidth - 0.06);
    group.add(pocket);

    // Abdomen
    const abdomen = new THREE.Mesh(
      new THREE.CylinderGeometry(torsoWidth - 0.02, torsoWidth - 0.05, 0.28, 14),
      clothMat.clone()
    );
    abdomen.position.y = 0.76;
    abdomen.castShadow = true;
    group.add(abdomen);

  } else if (style.clothingType === 'jacket') {
    // Leather jacket — fitted with collar
    const chest = new THREE.Mesh(
      new THREE.CylinderGeometry(torsoWidth, torsoWidth - 0.04, 0.5, 16),
      clothMat
    );
    chest.position.y = 1.16;
    chest.castShadow = true;
    group.add(chest);

    // Collar flaps
    [-1, 1].forEach(side => {
      const collar = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.06, 0.04),
        clothMat.clone()
      );
      collar.position.set(side * 0.08, 1.42, 0.18);
      collar.rotation.x = -0.3;
      collar.rotation.z = side * -0.2;
      group.add(collar);
    });

    // Jacket bottom flare
    const jacketBottom = new THREE.Mesh(
      new THREE.CylinderGeometry(torsoWidth - 0.03, torsoWidth + 0.01, 0.16, 14),
      clothMat.clone()
    );
    jacketBottom.position.y = 0.82;
    group.add(jacketBottom);

    // Abdomen (shirt underneath)
    const innerShirt = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });
    const abdomen = new THREE.Mesh(
      new THREE.CylinderGeometry(torsoWidth - 0.05, torsoWidth - 0.06, 0.2, 14),
      innerShirt
    );
    abdomen.position.y = 0.72;
    group.add(abdomen);

  } else if (style.clothingType === 'suit') {
    // Tailored suit — clean lines
    const suitMat = new THREE.MeshStandardMaterial({
      color: shirtColor, roughness: 0.35, metalness: 0.05,
    });
    const chest = new THREE.Mesh(
      new THREE.CylinderGeometry(torsoWidth - 0.01, torsoWidth - 0.04, 0.5, 16),
      suitMat
    );
    chest.position.y = 1.16;
    chest.castShadow = true;
    group.add(chest);

    // Lapels
    [-1, 1].forEach(side => {
      const lapel = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.2, 0.015),
        suitMat.clone()
      );
      lapel.position.set(side * 0.1, 1.28, torsoWidth - 0.08);
      lapel.rotation.z = side * 0.15;
      group.add(lapel);
    });

    // Tie
    const tieMat = new THREE.MeshStandardMaterial({ color: 0xcc0000, roughness: 0.4 });
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.28, 0.01), tieMat);
    tie.position.set(0, 1.12, torsoWidth - 0.06);
    group.add(tie);

    // Shirt collar
    const collarMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.4 });
    [-1, 1].forEach(side => {
      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.025), collarMat);
      collar.position.set(side * 0.055, 1.42, 0.15);
      collar.rotation.z = side * -0.3;
      group.add(collar);
    });

    const abdomen = new THREE.Mesh(
      new THREE.CylinderGeometry(torsoWidth - 0.04, torsoWidth - 0.06, 0.28, 14),
      suitMat.clone()
    );
    abdomen.position.y = 0.76;
    abdomen.castShadow = true;
    group.add(abdomen);

  } else if (style.clothingType === 'tactical') {
    // Tactical/military vest
    const vestMat = new THREE.MeshStandardMaterial({
      color: shirtColor, roughness: 0.7, metalness: 0.05,
    });
    const chest = new THREE.Mesh(
      new THREE.CylinderGeometry(torsoWidth + 0.02, torsoWidth - 0.02, 0.5, 16),
      vestMat
    );
    chest.position.y = 1.16;
    chest.castShadow = true;
    group.add(chest);

    // Vest pouches
    [-1, 1].forEach(side => {
      const pouch = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.06, 0.04),
        new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 })
      );
      pouch.position.set(side * 0.14, 1.12, torsoWidth - 0.04);
      group.add(pouch);
    });

    // Utility belt pouches
    const pouchMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8 });
    [-1, 0, 1].forEach(pos => {
      const beltPouch = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.03), pouchMat);
      beltPouch.position.set(pos * 0.12, 0.62, 0.2);
      group.add(beltPouch);
    });

    const abdomen = new THREE.Mesh(
      new THREE.CylinderGeometry(torsoWidth - 0.02, torsoWidth - 0.05, 0.28, 14),
      vestMat.clone()
    );
    abdomen.position.y = 0.76;
    abdomen.castShadow = true;
    group.add(abdomen);

  } else {
    // Default streetwear
    const chest = new THREE.Mesh(
      new THREE.CylinderGeometry(torsoWidth, torsoWidth - 0.04, 0.5, 16),
      clothMat
    );
    chest.position.y = 1.16;
    chest.castShadow = true;
    group.add(chest);

    const abdomen = new THREE.Mesh(
      new THREE.CylinderGeometry(torsoWidth - 0.03, torsoWidth - 0.06, 0.28, 14),
      clothMat.clone()
    );
    abdomen.position.y = 0.76;
    abdomen.castShadow = true;
    group.add(abdomen);
  }

  // Shoulders (all styles)
  [-1, 1].forEach(side => {
    const shoulder = new THREE.Mesh(
      new THREE.SphereGeometry(0.085 * buildScale, 12, 12),
      clothMat.clone()
    );
    shoulder.position.set(side * (torsoWidth + 0.04), 1.36, 0);
    shoulder.scale.set(1.1, 0.6, 0.8);
    shoulder.castShadow = true;
    group.add(shoulder);
  });

  // Belt
  const beltMat = new THREE.MeshStandardMaterial({ color: 0x2a2218, roughness: 0.4, metalness: 0.3 });
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(torsoWidth - 0.04, torsoWidth - 0.04, 0.04, 14), beltMat);
  belt.position.y = 0.62;
  group.add(belt);
  const buckleMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, roughness: 0.2, metalness: 0.9 });
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.02), buckleMat);
  buckle.position.set(0, 0.62, torsoWidth - 0.06);
  group.add(buckle);

  // === ARMS ===
  const armThickness = 0.055 * buildScale;
  [-1, 1].forEach(side => {
    // Upper arm (sleeved)
    const upperArm = new THREE.Mesh(
      new THREE.CylinderGeometry(armThickness + 0.01, armThickness, 0.32, 12),
      clothMat.clone()
    );
    upperArm.position.set(side * (torsoWidth + 0.07), 1.18, 0);
    upperArm.rotation.z = side * -0.08;
    upperArm.name = side < 0 ? 'leftUpperArm' : 'rightUpperArm';
    upperArm.castShadow = true;
    group.add(upperArm);

    // Forearm (skin)
    const forearm = new THREE.Mesh(
      new THREE.CylinderGeometry(armThickness - 0.005, armThickness - 0.015, 0.28, 12),
      skinMat.clone()
    );
    forearm.position.set(side * (torsoWidth + 0.09), 0.88, 0);
    forearm.name = side < 0 ? 'leftArm' : 'rightArm';
    forearm.castShadow = true;
    group.add(forearm);

    // Tattoo marks for enforcer preset
    if (style.hasTattoos) {
      const tattooMat = new THREE.MeshStandardMaterial({ color: 0x1a3a2a, roughness: 0.5, transparent: true, opacity: 0.4 });
      const tattoo = new THREE.Mesh(new THREE.RingGeometry(0.02, 0.04, 8), tattooMat);
      tattoo.position.set(side * (torsoWidth + 0.09), 0.92, armThickness);
      tattoo.rotation.y = side * Math.PI / 2;
      group.add(tattoo);
    }

    // Hand
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 10), skinMat.clone());
    hand.position.set(side * (torsoWidth + 0.09), 0.71, 0);
    hand.scale.set(0.85, 1.1, 0.55);
    hand.name = side < 0 ? 'leftHand' : 'rightHand';
    group.add(hand);
  });

  // === HIPS ===
  const hips = new THREE.Mesh(
    new THREE.CylinderGeometry(torsoWidth - 0.04, torsoWidth - 0.06, 0.1, 14),
    pantsMat
  );
  hips.position.y = 0.56;
  hips.castShadow = true;
  group.add(hips);

  // === LEGS ===
  const legThickness = 0.075 * buildScale;
  [-1, 1].forEach(side => {
    // Thigh
    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(legThickness, legThickness - 0.012, 0.38, 12),
      pantsMat.clone()
    );
    thigh.position.set(side * 0.1, 0.32, 0);
    thigh.name = side < 0 ? 'leftThigh' : 'rightThigh';
    thigh.castShadow = true;
    group.add(thigh);

    // Calf / shin
    const calf = new THREE.Mesh(
      new THREE.CylinderGeometry(legThickness - 0.012, legThickness - 0.022, 0.34, 12),
      pantsMat.clone()
    );
    calf.position.set(side * 0.1, -0.02, 0);
    calf.name = side < 0 ? 'leftLeg' : 'rightLeg';
    calf.castShadow = true;
    group.add(calf);

    // Shoe — more detailed
    const shoeBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.06, 0.17),
      shoeMat.clone()
    );
    shoeBody.position.set(side * 0.1, -0.21, 0.02);
    shoeBody.castShadow = true;
    group.add(shoeBody);

    // Shoe sole
    const sole = new THREE.Mesh(
      new THREE.BoxGeometry(0.092, 0.018, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 })
    );
    sole.position.set(side * 0.1, -0.245, 0.02);
    group.add(sole);

    // Shoe tongue
    const tongue = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.03, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 })
    );
    tongue.position.set(side * 0.1, -0.17, 0.08);
    tongue.rotation.x = -0.3;
    group.add(tongue);
  });

  // === NAME TAG (only for other players) ===
  if (name && !isPlayer) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.beginPath();
    ctx.roundRect(8, 4, 496, 56, 12);
    ctx.fill();
    // Border
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(8, 4, 496, 56, 12);
    ctx.stroke();
    ctx.fillStyle = '#00d4ff';
    ctx.font = 'Bold 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 256, 32);
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.y = 2.15;
    sprite.scale.set(1.8, 0.22, 1);
    group.add(sprite);
  }

  // Overall scale — taller, more proportional
  group.scale.setScalar(1.25);

  return group;
}

// Create a weapon mesh to attach to character hand
export function createWeaponMesh(weaponType: string): THREE.Group {
  const g = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.3, metalness: 0.8 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.6 });

  if (weaponType === 'pistol') {
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
      head.position.y = 1.72 + Math.abs(cycle) * 0.012;
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
      head.position.y = 1.72 + breathe;
    }
  }
}
