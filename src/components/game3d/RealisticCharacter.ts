import * as THREE from 'three';

interface CharacterOptions {
  skinTone?: number;
  hairColor?: number;
  shirtColor?: number;
  pantsColor?: number;
  name?: string;
  isPlayer?: boolean;
}

export function createRealisticCharacter(options: CharacterOptions = {}): THREE.Group {
  const {
    skinTone = 0xd4a574,
    hairColor = 0x1a1a1a,
    shirtColor = 0x2c3e50,
    pantsColor = 0x1a3a5c,
    name = '',
    isPlayer = true
  } = options;

  const group = new THREE.Group();
  
  // Materials
  const skinMat = new THREE.MeshStandardMaterial({ 
    color: skinTone, 
    roughness: 0.5,
    metalness: 0.1
  });
  const clothMat = new THREE.MeshStandardMaterial({ 
    color: shirtColor, 
    roughness: 0.7 
  });
  const pantsMat = new THREE.MeshStandardMaterial({ 
    color: pantsColor, 
    roughness: 0.8 
  });
  const hairMat = new THREE.MeshStandardMaterial({ 
    color: hairColor, 
    roughness: 0.9 
  });
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const eyePupilMat = new THREE.MeshStandardMaterial({ color: 0x2d1b0e });
  const eyeIrisMat = new THREE.MeshStandardMaterial({ color: 0x4a7c59 });

  // === HEAD GROUP ===
  const headGroup = new THREE.Group();
  headGroup.name = 'head';

  // Head shape - more realistic oval
  const headGeo = new THREE.SphereGeometry(0.4, 32, 32);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.scale.set(0.9, 1.1, 0.95);
  head.castShadow = true;
  headGroup.add(head);

  // Face structure - chin and jaw
  const jawGeo = new THREE.SphereGeometry(0.35, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const jaw = new THREE.Mesh(jawGeo, skinMat.clone());
  jaw.position.y = -0.15;
  jaw.scale.set(0.85, 0.6, 0.9);
  headGroup.add(jaw);

  // Cheekbones
  const cheekGeo = new THREE.SphereGeometry(0.1, 12, 12);
  const leftCheek = new THREE.Mesh(cheekGeo, skinMat.clone());
  leftCheek.position.set(-0.25, -0.05, 0.28);
  leftCheek.scale.set(1.2, 0.8, 0.6);
  headGroup.add(leftCheek);
  
  const rightCheek = new THREE.Mesh(cheekGeo, skinMat.clone());
  rightCheek.position.set(0.25, -0.05, 0.28);
  rightCheek.scale.set(1.2, 0.8, 0.6);
  headGroup.add(rightCheek);

  // === EYES ===
  // Eye sockets (slightly darker skin)
  const socketMat = skinMat.clone();
  socketMat.color.setHex(skinTone - 0x101010);
  
  // Left eye
  const leftEyeGroup = new THREE.Group();
  leftEyeGroup.name = 'leftEye';
  
  const leftEyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 16), eyeWhiteMat);
  leftEyeWhite.scale.set(1.3, 1, 0.8);
  leftEyeGroup.add(leftEyeWhite);
  
  const leftIris = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 16), eyeIrisMat);
  leftIris.position.z = 0.045;
  leftEyeGroup.add(leftIris);
  
  const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 12), eyePupilMat);
  leftPupil.position.z = 0.06;
  leftEyeGroup.add(leftPupil);
  
  // Eye highlight
  const highlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const leftHighlight = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), highlightMat);
  leftHighlight.position.set(0.015, 0.015, 0.065);
  leftEyeGroup.add(leftHighlight);
  
  leftEyeGroup.position.set(-0.12, 0.08, 0.32);
  headGroup.add(leftEyeGroup);

  // Right eye
  const rightEyeGroup = new THREE.Group();
  rightEyeGroup.name = 'rightEye';
  
  const rightEyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 16), eyeWhiteMat.clone());
  rightEyeWhite.scale.set(1.3, 1, 0.8);
  rightEyeGroup.add(rightEyeWhite);
  
  const rightIris = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 16), eyeIrisMat.clone());
  rightIris.position.z = 0.045;
  rightEyeGroup.add(rightIris);
  
  const rightPupil = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 12), eyePupilMat.clone());
  rightPupil.position.z = 0.06;
  rightEyeGroup.add(rightPupil);
  
  const rightHighlight = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), highlightMat.clone());
  rightHighlight.position.set(0.015, 0.015, 0.065);
  rightEyeGroup.add(rightHighlight);
  
  rightEyeGroup.position.set(0.12, 0.08, 0.32);
  headGroup.add(rightEyeGroup);

  // === EYEBROWS ===
  const eyebrowGeo = new THREE.BoxGeometry(0.12, 0.025, 0.03);
  const eyebrowMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.9 });
  
  const leftBrow = new THREE.Mesh(eyebrowGeo, eyebrowMat);
  leftBrow.position.set(-0.12, 0.18, 0.35);
  leftBrow.rotation.z = 0.1;
  headGroup.add(leftBrow);
  
  const rightBrow = new THREE.Mesh(eyebrowGeo, eyebrowMat.clone());
  rightBrow.position.set(0.12, 0.18, 0.35);
  rightBrow.rotation.z = -0.1;
  headGroup.add(rightBrow);

  // === NOSE ===
  const noseGroup = new THREE.Group();
  
  // Nose bridge
  const bridgeGeo = new THREE.BoxGeometry(0.06, 0.15, 0.08);
  const bridge = new THREE.Mesh(bridgeGeo, skinMat.clone());
  bridge.position.set(0, 0, 0.35);
  noseGroup.add(bridge);
  
  // Nose tip
  const tipGeo = new THREE.SphereGeometry(0.045, 12, 12);
  const tip = new THREE.Mesh(tipGeo, skinMat.clone());
  tip.position.set(0, -0.06, 0.4);
  tip.scale.set(1.2, 0.8, 1);
  noseGroup.add(tip);
  
  // Nostrils
  const nostrilGeo = new THREE.SphereGeometry(0.02, 8, 8);
  const nostrilMat = skinMat.clone();
  nostrilMat.color.setHex(skinTone - 0x202020);
  
  const leftNostril = new THREE.Mesh(nostrilGeo, nostrilMat);
  leftNostril.position.set(-0.025, -0.08, 0.38);
  noseGroup.add(leftNostril);
  
  const rightNostril = new THREE.Mesh(nostrilGeo, nostrilMat.clone());
  rightNostril.position.set(0.025, -0.08, 0.38);
  noseGroup.add(rightNostril);
  
  headGroup.add(noseGroup);

  // === MOUTH ===
  const mouthGroup = new THREE.Group();
  
  // Lips
  const upperLipGeo = new THREE.BoxGeometry(0.14, 0.025, 0.04);
  const lipMat = new THREE.MeshStandardMaterial({ color: skinTone - 0x151010, roughness: 0.4 });
  const upperLip = new THREE.Mesh(upperLipGeo, lipMat);
  upperLip.position.set(0, -0.18, 0.35);
  mouthGroup.add(upperLip);
  
  const lowerLipGeo = new THREE.BoxGeometry(0.12, 0.03, 0.04);
  const lowerLip = new THREE.Mesh(lowerLipGeo, lipMat.clone());
  lowerLip.position.set(0, -0.21, 0.34);
  mouthGroup.add(lowerLip);
  
  headGroup.add(mouthGroup);

  // === EARS ===
  const earGeo = new THREE.SphereGeometry(0.08, 12, 12);
  
  const leftEar = new THREE.Mesh(earGeo, skinMat.clone());
  leftEar.position.set(-0.38, 0.02, 0);
  leftEar.scale.set(0.4, 1, 0.7);
  headGroup.add(leftEar);
  
  const rightEar = new THREE.Mesh(earGeo, skinMat.clone());
  rightEar.position.set(0.38, 0.02, 0);
  rightEar.scale.set(0.4, 1, 0.7);
  headGroup.add(rightEar);

  // === HAIR ===
  // Main hair
  const hairGeo = new THREE.SphereGeometry(0.42, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const hair = new THREE.Mesh(hairGeo, hairMat);
  hair.position.y = 0.1;
  hair.scale.set(0.95, 0.95, 0.95);
  headGroup.add(hair);
  
  // Hair sides (fade style)
  const sideHairGeo = new THREE.CylinderGeometry(0.38, 0.35, 0.2, 32, 1, true);
  const sideHair = new THREE.Mesh(sideHairGeo, hairMat.clone());
  sideHair.position.y = 0;
  headGroup.add(sideHair);

  headGroup.position.y = 1.85;
  group.add(headGroup);

  // === NECK ===
  const neckGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.2, 16);
  const neck = new THREE.Mesh(neckGeo, skinMat.clone());
  neck.position.y = 1.55;
  neck.castShadow = true;
  group.add(neck);

  // === TORSO ===
  const torsoGroup = new THREE.Group();
  
  // Main torso
  const torsoGeo = new THREE.CylinderGeometry(0.35, 0.32, 0.9, 16);
  const torso = new THREE.Mesh(torsoGeo, clothMat);
  torso.position.y = 1.0;
  torso.castShadow = true;
  torsoGroup.add(torso);
  
  // Shoulders
  const shoulderGeo = new THREE.SphereGeometry(0.15, 12, 12);
  
  const leftShoulder = new THREE.Mesh(shoulderGeo, clothMat.clone());
  leftShoulder.position.set(-0.35, 1.35, 0);
  leftShoulder.scale.set(1.2, 0.8, 1);
  torsoGroup.add(leftShoulder);
  
  const rightShoulder = new THREE.Mesh(shoulderGeo, clothMat.clone());
  rightShoulder.position.set(0.35, 1.35, 0);
  rightShoulder.scale.set(1.2, 0.8, 1);
  torsoGroup.add(rightShoulder);
  
  group.add(torsoGroup);

  // === ARMS ===
  // Upper arms
  const upperArmGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.4, 12);
  
  const leftUpperArm = new THREE.Mesh(upperArmGeo, clothMat.clone());
  leftUpperArm.position.set(-0.42, 1.15, 0);
  leftUpperArm.rotation.z = -0.15;
  leftUpperArm.name = 'leftUpperArm';
  leftUpperArm.castShadow = true;
  group.add(leftUpperArm);
  
  const rightUpperArm = new THREE.Mesh(upperArmGeo, clothMat.clone());
  rightUpperArm.position.set(0.42, 1.15, 0);
  rightUpperArm.rotation.z = 0.15;
  rightUpperArm.name = 'rightUpperArm';
  rightUpperArm.castShadow = true;
  group.add(rightUpperArm);

  // Lower arms (forearms - skin visible)
  const forearmGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.35, 12);
  
  const leftForearm = new THREE.Mesh(forearmGeo, skinMat.clone());
  leftForearm.position.set(-0.48, 0.78, 0);
  leftForearm.name = 'leftArm';
  leftForearm.castShadow = true;
  group.add(leftForearm);
  
  const rightForearm = new THREE.Mesh(forearmGeo, skinMat.clone());
  rightForearm.position.set(0.48, 0.78, 0);
  rightForearm.name = 'rightArm';
  rightForearm.castShadow = true;
  group.add(rightForearm);

  // Hands
  const handGeo = new THREE.SphereGeometry(0.06, 12, 12);
  
  const leftHand = new THREE.Mesh(handGeo, skinMat.clone());
  leftHand.position.set(-0.48, 0.58, 0);
  leftHand.scale.set(1, 1.2, 0.7);
  group.add(leftHand);
  
  const rightHand = new THREE.Mesh(handGeo, skinMat.clone());
  rightHand.position.set(0.48, 0.58, 0);
  rightHand.scale.set(1, 1.2, 0.7);
  group.add(rightHand);

  // === LEGS ===
  // Hips
  const hipGeo = new THREE.CylinderGeometry(0.32, 0.25, 0.2, 16);
  const hips = new THREE.Mesh(hipGeo, pantsMat);
  hips.position.y = 0.55;
  hips.castShadow = true;
  group.add(hips);

  // Upper legs (thighs)
  const thighGeo = new THREE.CylinderGeometry(0.13, 0.11, 0.45, 12);
  
  const leftThigh = new THREE.Mesh(thighGeo, pantsMat.clone());
  leftThigh.position.set(-0.12, 0.3, 0);
  leftThigh.name = 'leftThigh';
  leftThigh.castShadow = true;
  group.add(leftThigh);
  
  const rightThigh = new THREE.Mesh(thighGeo, pantsMat.clone());
  rightThigh.position.set(0.12, 0.3, 0);
  rightThigh.name = 'rightThigh';
  rightThigh.castShadow = true;
  group.add(rightThigh);

  // Lower legs (calves)
  const calfGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.4, 12);
  
  const leftCalf = new THREE.Mesh(calfGeo, pantsMat.clone());
  leftCalf.position.set(-0.12, -0.1, 0);
  leftCalf.name = 'leftLeg';
  leftCalf.castShadow = true;
  group.add(leftCalf);
  
  const rightCalf = new THREE.Mesh(calfGeo, pantsMat.clone());
  rightCalf.position.set(0.12, -0.1, 0);
  rightCalf.name = 'rightLeg';
  rightCalf.castShadow = true;
  group.add(rightCalf);

  // === SHOES ===
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
  const shoeGeo = new THREE.BoxGeometry(0.12, 0.08, 0.22);
  
  const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
  leftShoe.position.set(-0.12, -0.32, 0.03);
  group.add(leftShoe);
  
  const rightShoe = new THREE.Mesh(shoeGeo, shoeMat.clone());
  rightShoe.position.set(0.12, -0.32, 0.03);
  group.add(rightShoe);

  // === NAME TAG (for other players) ===
  if (name && !isPlayer) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.roundRect(8, 8, 240, 48, 12);
    ctx.fill();
    
    ctx.fillStyle = '#00d4ff';
    ctx.font = 'Bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 128, 32);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.y = 2.4;
    sprite.scale.set(2, 0.5, 1);
    group.add(sprite);
  }

  return group;
}

export function animateCharacter(
  character: THREE.Group, 
  isMoving: boolean, 
  isSprinting: boolean,
  deltaTime: number
) {
  const speed = isSprinting ? 15 : 10;
  const swingAmount = isSprinting ? 0.6 : 0.4;
  const time = Date.now() * 0.001 * speed;

  const leftArm = character.getObjectByName('leftArm') as THREE.Mesh;
  const rightArm = character.getObjectByName('rightArm') as THREE.Mesh;
  const leftLeg = character.getObjectByName('leftLeg') as THREE.Mesh;
  const rightLeg = character.getObjectByName('rightLeg') as THREE.Mesh;
  const leftThigh = character.getObjectByName('leftThigh') as THREE.Mesh;
  const rightThigh = character.getObjectByName('rightThigh') as THREE.Mesh;

  if (isMoving) {
    // Walking/running animation
    const cycle = Math.sin(time);
    
    if (leftArm) leftArm.rotation.x = cycle * swingAmount;
    if (rightArm) rightArm.rotation.x = -cycle * swingAmount;
    if (leftLeg) leftLeg.rotation.x = -cycle * swingAmount * 0.7;
    if (rightLeg) rightLeg.rotation.x = cycle * swingAmount * 0.7;
    if (leftThigh) leftThigh.rotation.x = -cycle * swingAmount * 0.5;
    if (rightThigh) rightThigh.rotation.x = cycle * swingAmount * 0.5;
  } else {
    // Idle - smooth return to neutral
    const lerp = 0.1;
    if (leftArm) leftArm.rotation.x *= (1 - lerp);
    if (rightArm) rightArm.rotation.x *= (1 - lerp);
    if (leftLeg) leftLeg.rotation.x *= (1 - lerp);
    if (rightLeg) rightLeg.rotation.x *= (1 - lerp);
    if (leftThigh) leftThigh.rotation.x *= (1 - lerp);
    if (rightThigh) rightThigh.rotation.x *= (1 - lerp);
  }
}
