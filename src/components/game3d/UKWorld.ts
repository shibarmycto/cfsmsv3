import * as THREE from 'three';

export interface GameBuilding {
  id: string;
  name: string;
  type: string;
  position: THREE.Vector3;
  size: THREE.Vector3;
}

export function createUKWorld(scene: THREE.Scene): GameBuilding[] {
  const buildings: GameBuilding[] = [];
  
  // Create ground with grass texture
  createGround(scene);
  
  // Create UK-style roads with proper markings
  createRoads(scene);
  
  // Create street furniture (UK-specific)
  createStreetFurniture(scene);
  
  // Create buildings and return their data
  buildings.push(...createBuildings(scene));
  
  // Add trees and vegetation
  createVegetation(scene);
  
  return buildings;
}

function createGround(scene: THREE.Scene) {
  // Main grass ground
  const groundGeo = new THREE.PlaneGeometry(2000, 2000, 50, 50);
  const groundMat = new THREE.MeshStandardMaterial({ 
    color: 0x4a7c4a,
    roughness: 0.9,
    metalness: 0
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Pavement/sidewalk areas
  const pavementGeo = new THREE.PlaneGeometry(2000, 2000);
  const pavementMat = new THREE.MeshStandardMaterial({ 
    color: 0x888888,
    roughness: 0.8
  });
  const pavement = new THREE.Mesh(pavementGeo, pavementMat);
  pavement.rotation.x = -Math.PI / 2;
  pavement.position.y = 0.005;
  scene.add(pavement);
}

function createRoads(scene: THREE.Scene) {
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8 });
  const roadWidth = 12;

  // Main road (North-South)
  const mainRoad = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth, 1000), roadMat);
  mainRoad.rotation.x = -Math.PI / 2;
  mainRoad.position.y = 0.01;
  scene.add(mainRoad);

  // Cross road (East-West)
  const crossRoad = new THREE.Mesh(new THREE.PlaneGeometry(1000, roadWidth), roadMat.clone());
  crossRoad.rotation.x = -Math.PI / 2;
  crossRoad.position.y = 0.01;
  scene.add(crossRoad);

  // UK Road Markings
  createUKRoadMarkings(scene, roadWidth);
}

function createUKRoadMarkings(scene: THREE.Scene, roadWidth: number) {
  // White center line (dashed)
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  for (let z = -490; z < 500; z += 15) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 8), whiteMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.02, z);
    scene.add(dash);
  }

  // Double yellow lines (no parking - UK style)
  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xffd700 });
  const yellowOffset = roadWidth / 2 - 0.6;
  
  // Left side double yellow
  for (let i = 0; i < 2; i++) {
    const leftLine = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 1000), yellowMat);
    leftLine.rotation.x = -Math.PI / 2;
    leftLine.position.set(-yellowOffset - i * 0.2, 0.02, 0);
    scene.add(leftLine);
    
    const rightLine = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 1000), yellowMat.clone());
    rightLine.rotation.x = -Math.PI / 2;
    rightLine.position.set(yellowOffset + i * 0.2, 0.02, 0);
    scene.add(rightLine);
  }

  // Red route markings (London-style - no stopping)
  const redMat = new THREE.MeshStandardMaterial({ color: 0xcc0000 });
  const redLine1 = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 1000), redMat);
  redLine1.rotation.x = -Math.PI / 2;
  redLine1.position.set(-yellowOffset - 0.5, 0.025, 0);
  scene.add(redLine1);

  const redLine2 = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 1000), redMat.clone());
  redLine2.rotation.x = -Math.PI / 2;
  redLine2.position.set(yellowOffset + 0.5, 0.025, 0);
  scene.add(redLine2);

  // Zebra crossing
  createZebraCrossing(scene, 0, 0);

  // Road text markings
  createRoadText(scene, 'SLOW', 0, -50);
  createRoadText(scene, 'A204', 0, -80);
  createRoadText(scene, 'STOP', 0, 50);
}

function createZebraCrossing(scene: THREE.Scene, x: number, z: number) {
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const stripeWidth = 0.6;
  const crossingWidth = 10;
  const numStripes = 12;
  
  for (let i = 0; i < numStripes; i++) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(crossingWidth, stripeWidth), stripeMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(x, 0.025, z + (i - numStripes/2) * stripeWidth * 2);
    scene.add(stripe);
  }

  // Belisha beacons
  createBelishaBeacon(scene, x - 7, z);
  createBelishaBeacon(scene, x + 7, z);
}

function createBelishaBeacon(scene: THREE.Scene, x: number, z: number) {
  const group = new THREE.Group();
  
  // Black and white striped pole
  const poleSegments = 8;
  for (let i = 0; i < poleSegments; i++) {
    const color = i % 2 === 0 ? 0x1a1a1a : 0xffffff;
    const segment = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.35),
      new THREE.MeshStandardMaterial({ color })
    );
    segment.position.y = 0.175 + i * 0.35;
    group.add(segment);
  }
  
  // Orange globe
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 16, 16),
    new THREE.MeshStandardMaterial({ 
      color: 0xff8c00, 
      emissive: 0xff4400,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.9
    })
  );
  globe.position.y = 3;
  group.add(globe);
  
  group.position.set(x, 0, z);
  scene.add(group);
}

function createRoadText(scene: THREE.Scene, text: string, x: number, z: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'white';
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 64);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.5), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.03, z);
  scene.add(mesh);
}

function createStreetFurniture(scene: THREE.Scene) {
  // Red telephone box
  createPhoneBox(scene, -15, 30);
  
  // Red post box (pillar box)
  createPillarBox(scene, 15, -30);
  
  // Bus stop
  createBusStop(scene, -20, -60);
  
  // Street lamps
  for (let z = -200; z <= 200; z += 40) {
    createStreetLamp(scene, -8, z);
    createStreetLamp(scene, 8, z);
  }
  
  // Benches
  createBench(scene, -12, 0);
  createBench(scene, 12, 0);
}

function createPhoneBox(scene: THREE.Scene, x: number, z: number) {
  const group = new THREE.Group();
  const redMat = new THREE.MeshStandardMaterial({ color: 0xcc0000, roughness: 0.3 });
  
  // Main structure
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.8, 1.2), redMat);
  box.position.y = 1.4;
  box.castShadow = true;
  group.add(box);
  
  // Windows
  const windowMat = new THREE.MeshStandardMaterial({ 
    color: 0x88ccff, 
    transparent: true, 
    opacity: 0.7,
    metalness: 0.5 
  });
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    if (i !== 2) { // Skip door side
      const window = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.8), windowMat);
      window.position.set(
        Math.sin(angle) * 0.61,
        1.5,
        Math.cos(angle) * 0.61
      );
      window.rotation.y = angle;
      group.add(window);
    }
  }
  
  // Crown on top
  const crown = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.15, 1.3), redMat.clone());
  crown.position.y = 2.85;
  group.add(crown);
  
  group.position.set(x, 0, z);
  scene.add(group);
}

function createPillarBox(scene: THREE.Scene, x: number, z: number) {
  const group = new THREE.Group();
  const redMat = new THREE.MeshStandardMaterial({ color: 0xcc0000, roughness: 0.4 });
  
  // Main cylinder
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 1.4, 16), redMat);
  pillar.position.y = 0.7;
  pillar.castShadow = true;
  group.add(pillar);
  
  // Top dome
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), redMat.clone());
  dome.position.y = 1.4;
  group.add(dome);
  
  // Letter slot
  const slotMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.1), slotMat);
  slot.position.set(0, 1.1, 0.32);
  group.add(slot);
  
  group.position.set(x, 0, z);
  scene.add(group);
}

function createBusStop(scene: THREE.Scene, x: number, z: number) {
  const group = new THREE.Group();
  
  // Pole
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3), poleMat);
  pole.position.y = 1.5;
  group.add(pole);
  
  // Sign
  const signMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  const sign = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.05, 16), signMat);
  sign.position.y = 2.8;
  sign.rotation.x = Math.PI / 2;
  group.add(sign);
  
  // Bus symbol
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'white';
  ctx.font = 'bold 32px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BUS', 32, 32);
  
  const texture = new THREE.CanvasTexture(canvas);
  const textMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  const textMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), textMat);
  textMesh.position.set(0, 2.8, 0.03);
  group.add(textMesh);
  
  group.position.set(x, 0, z);
  scene.add(group);
}

function createStreetLamp(scene: THREE.Scene, x: number, z: number) {
  const group = new THREE.Group();
  
  // Pole
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5), poleMat);
  pole.position.y = 2.5;
  pole.castShadow = true;
  group.add(pole);
  
  // Lamp head
  const headMat = new THREE.MeshStandardMaterial({ 
    color: 0xffff99,
    emissive: 0xffff44,
    emissiveIntensity: 0.3
  });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), headMat);
  head.position.y = 5.2;
  group.add(head);
  
  // Point light
  const light = new THREE.PointLight(0xffff99, 0.5, 15);
  light.position.y = 5.2;
  group.add(light);
  
  group.position.set(x, 0, z);
  scene.add(group);
}

function createBench(scene: THREE.Scene, x: number, z: number) {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 });
  
  // Seat
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.4), woodMat);
  seat.position.y = 0.5;
  seat.castShadow = true;
  group.add(seat);
  
  // Back
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.08), woodMat.clone());
  back.position.set(0, 0.75, -0.16);
  back.rotation.x = -0.1;
  back.castShadow = true;
  group.add(back);
  
  // Legs
  for (let i = -1; i <= 1; i += 2) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.4), metalMat);
    leg.position.set(i * 0.6, 0.25, 0);
    group.add(leg);
  }
  
  group.position.set(x, 0, z);
  scene.add(group);
}

function createBuildings(scene: THREE.Scene): GameBuilding[] {
  const buildings: GameBuilding[] = [
    { id: 'bank', name: 'Barclays Bank', type: 'bank', position: new THREE.Vector3(-50, 0, -100), size: new THREE.Vector3(30, 25, 20) },
    { id: 'shop1', name: 'Tesco Express', type: 'shop', position: new THREE.Vector3(50, 0, -100), size: new THREE.Vector3(25, 15, 18) },
    { id: 'police', name: 'Police Station', type: 'police', position: new THREE.Vector3(-80, 0, 50), size: new THREE.Vector3(40, 20, 30) },
    { id: 'hospital', name: "St Mary's Hospital", type: 'hospital', position: new THREE.Vector3(80, 0, 50), size: new THREE.Vector3(50, 35, 40) },
    { id: 'jobcenter', name: 'Job Centre Plus', type: 'job', position: new THREE.Vector3(0, 0, 150), size: new THREE.Vector3(35, 18, 25) },
    { id: 'apartments', name: 'City Flats', type: 'apartment', position: new THREE.Vector3(-100, 0, -200), size: new THREE.Vector3(25, 55, 25) },
    { id: 'pub', name: 'The Crown Pub', type: 'pub', position: new THREE.Vector3(100, 0, -200), size: new THREE.Vector3(20, 12, 18) },
    { id: 'garage', name: 'Halfords Garage', type: 'garage', position: new THREE.Vector3(-120, 0, 100), size: new THREE.Vector3(35, 10, 30) },
    { id: 'dealership', name: 'Car Dealership', type: 'dealership', position: new THREE.Vector3(120, 0, 100), size: new THREE.Vector3(45, 12, 35) },
  ];

  const colorMap: Record<string, number> = {
    bank: 0x1a5c3a,
    shop: 0x2d5a8c,
    police: 0x1a3a5c,
    hospital: 0xeeeeee,
    job: 0x555555,
    apartment: 0x8b7355,
    pub: 0x654321,
    garage: 0x4a4a4a,
    dealership: 0x3a5a7a
  };

  buildings.forEach(b => {
    const group = new THREE.Group();
    
    // Main building
    const geo = new THREE.BoxGeometry(b.size.x, b.size.y, b.size.z);
    const mat = new THREE.MeshStandardMaterial({ 
      color: colorMap[b.type] || 0x666666,
      roughness: 0.7
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = b.size.y / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // Windows
    const windowMat = new THREE.MeshStandardMaterial({ 
      color: 0x88ccff,
      metalness: 0.5,
      roughness: 0.2
    });
    const windowsPerFloor = Math.floor(b.size.x / 5);
    const floors = Math.floor(b.size.y / 6);
    
    for (let f = 0; f < floors; f++) {
      for (let w = 0; w < windowsPerFloor; w++) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 3.5), windowMat);
        win.position.set(
          -b.size.x / 2 + 3 + w * 5,
          4 + f * 6,
          b.size.z / 2 + 0.05
        );
        group.add(win);
      }
    }

    // Door
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(3, 4.5, 0.3), doorMat);
    door.position.set(0, 2.25, b.size.z / 2 + 0.15);
    group.add(door);

    // Building sign
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = b.type === 'police' ? '#1a3a5c' : '#1a1a1a';
    ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = b.type === 'hospital' ? '#00aa00' : '#ffffff';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(b.name, 256, 58);

    const signTex = new THREE.CanvasTexture(canvas);
    const signMat = new THREE.MeshBasicMaterial({ map: signTex });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(15, 3), signMat);
    sign.position.set(0, b.size.y - 2, b.size.z / 2 + 0.1);
    group.add(sign);

    // Roof detail
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(b.size.x + 1, 0.5, b.size.z + 1), roofMat);
    roof.position.y = b.size.y + 0.25;
    group.add(roof);

    group.position.copy(b.position);
    scene.add(group);
  });

  return buildings;
}

function createVegetation(scene: THREE.Scene) {
  const treePositions = [
    [-30, 30], [30, 30], [-30, -30], [30, -30],
    [-60, 80], [60, 80], [-60, -80], [60, -80],
    [-100, 0], [100, 0], [0, 100], [0, -100]
  ];

  treePositions.forEach(([x, z]) => {
    createTree(scene, x, z);
  });
}

function createTree(scene: THREE.Scene, x: number, z: number) {
  const group = new THREE.Group();
  
  // Trunk
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3528, roughness: 0.9 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2), trunkMat);
  trunk.position.y = 1;
  trunk.castShadow = true;
  group.add(trunk);
  
  // Foliage layers
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d5a2d, roughness: 0.8 });
  const sizes = [1.5, 1.2, 0.8];
  sizes.forEach((size, i) => {
    const leaves = new THREE.Mesh(
      new THREE.ConeGeometry(size, 1.5, 8),
      leafMat
    );
    leaves.position.y = 2.5 + i * 1;
    leaves.castShadow = true;
    group.add(leaves);
  });
  
  group.position.set(x, 0, z);
  scene.add(group);
}
