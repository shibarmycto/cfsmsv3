import * as THREE from 'three';

export interface GameBuilding {
  id: string;
  name: string;
  type: string;
  position: THREE.Vector3;
  size: THREE.Vector3;
}

// ─── Shared material cache ───
const matCache: Record<string, THREE.Material> = {};
function mat(key: string, props: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  if (!matCache[key]) matCache[key] = new THREE.MeshStandardMaterial(props);
  return matCache[key] as THREE.MeshStandardMaterial;
}

// ─── Texture helpers ───
function noiseTexture(base: string, variance: number, size = 256): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 3000; i++) {
    const v = Math.random() * variance - variance / 2;
    const r = parseInt(base.slice(1, 3), 16) + v;
    const g = parseInt(base.slice(3, 5), 16) + v;
    const b = parseInt(base.slice(5, 7), 16) + v;
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function brickTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d')!;
  const bw = 32, bh = 16;
  for (let row = 0; row < 256 / bh; row++) {
    const offset = row % 2 === 0 ? 0 : bw / 2;
    for (let col = -1; col < 256 / bw + 1; col++) {
      const shade = 120 + Math.random() * 40;
      ctx.fillStyle = `rgb(${shade + 30}, ${shade - 20}, ${shade - 30})`;
      ctx.fillRect(col * bw + offset, row * bh, bw - 1, bh - 1);
    }
  }
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 1;
  for (let row = 0; row <= 256 / bh; row++) {
    ctx.beginPath(); ctx.moveTo(0, row * bh); ctx.lineTo(256, row * bh); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ─── Main entry ───
export function createUKWorld(scene: THREE.Scene): GameBuilding[] {
  const buildings: GameBuilding[] = [];
  createGround(scene);
  createRoadNetwork(scene);
  createStreetFurniture(scene);
  buildings.push(...createCityBuildings(scene));
  createVegetation(scene);
  createParkedCars(scene);
  createAtmosphere(scene);
  return buildings;
}

// ─── Ground ───
function createGround(scene: THREE.Scene) {
  const grassTex = noiseTexture('#3a6b2a', 30);
  grassTex.repeat.set(60, 60);
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.receiveShadow = true;
  scene.add(grass);

  // Concrete pavement near roads
  const paveTex = noiseTexture('#888888', 12);
  paveTex.repeat.set(60, 60);
  const pave = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshStandardMaterial({ map: paveTex, roughness: 0.85 })
  );
  pave.rotation.x = -Math.PI / 2;
  pave.position.y = 0.005;
  scene.add(pave);
}

// ─── Road network - BATCHED for performance ───
function createRoadNetwork(scene: THREE.Scene) {
  const asphaltTex = noiseTexture('#2a2a2a', 10);
  asphaltTex.repeat.set(1, 40);
  const roadMat = new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.8 });
  const rw = 14;

  const roads = [
    { w: rw, d: 1200, x: 0, z: 0 },
    { w: 1200, d: rw, x: 0, z: 0 },
    { w: rw, d: 1200, x: 200, z: 0 },
    { w: rw, d: 1200, x: -200, z: 0 },
    { w: 1200, d: rw, x: 0, z: 200 },
    { w: 1200, d: rw, x: 0, z: -200 },
  ];

  roads.forEach(r => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.d), roadMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(r.x, 0.01, r.z);
    mesh.receiveShadow = true;
    scene.add(mesh);
  });

  addRoadMarkings(scene, rw);
}

function addRoadMarkings(scene: THREE.Scene, rw: number) {
  // Batch road markings into single geometries for performance
  const whiteMat = mat('white', { color: 0xffffff });
  const yellowMat = mat('yellow', { color: 0xffd700 });

  // Center lines - use fewer, longer segments
  for (let i = -500; i < 500; i += 30) {
    const d1 = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 15), whiteMat);
    d1.rotation.x = -Math.PI / 2; d1.position.set(0, 0.02, i); scene.add(d1);
    const d2 = new THREE.Mesh(new THREE.PlaneGeometry(15, 0.15), whiteMat);
    d2.rotation.x = -Math.PI / 2; d2.position.set(i, 0.02, 0); scene.add(d2);
  }

  // Double yellow lines - fewer segments
  const yw = rw / 2 - 0.6;
  [0, 200, -200].forEach(roadX => {
    for (let s = -1; s <= 1; s += 2) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 1200), yellowMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(roadX + s * yw, 0.02, 0);
      scene.add(line);
    }
  });

  // Zebra crossings (reduced)
  createZebraCrossing(scene, 0, 40);
  createZebraCrossing(scene, 0, -40);
}

function createZebraCrossing(scene: THREE.Scene, x: number, z: number) {
  const stripeMat = mat('stripe', { color: 0xffffff });
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(12, 0.6), stripeMat);
    s.rotation.x = -Math.PI / 2;
    s.position.set(x, 0.025, z + (i - 5) * 1.2);
    scene.add(s);
  }
}

// ─── Street Furniture - NO shadow-casting point lights ───
function createStreetFurniture(scene: THREE.Scene) {
  createPhoneBox(scene, -18, 35);
  createPhoneBox(scene, 18, -135);

  createPillarBox(scene, 16, -35);
  createPillarBox(scene, -16, 135);

  createBusStop(scene, -22, -70);
  createBusStop(scene, 22, 70);

  // Street lamps - decorative only, NO PointLights (sun handles lighting)
  for (let z = -300; z <= 300; z += 40) {
    createStreetLamp(scene, -9, z);
    createStreetLamp(scene, 9, z);
  }

  // Benches & bollards
  createBench(scene, -14, 10);
  createBench(scene, 14, -10);
  
  for (let z = -60; z <= 60; z += 12) {
    createBollard(scene, -7.5, z);
    createBollard(scene, 7.5, z);
  }
}

function createPhoneBox(scene: THREE.Scene, x: number, z: number) {
  const g = new THREE.Group();
  const red = mat('phone-red', { color: 0xcc0000, roughness: 0.3 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.8, 1.2), red);
  box.position.y = 1.4; box.castShadow = true;
  g.add(box);
  const crown = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.15, 1.3), red);
  crown.position.y = 2.85; g.add(crown);
  g.position.set(x, 0, z);
  scene.add(g);
}

function createPillarBox(scene: THREE.Scene, x: number, z: number) {
  const g = new THREE.Group();
  const red = mat('pillar-red', { color: 0xcc0000, roughness: 0.4 });
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 1.4, 12), red);
  pillar.position.y = 0.7; pillar.castShadow = true; g.add(pillar);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), red);
  dome.position.y = 1.4; g.add(dome);
  g.position.set(x, 0, z);
  scene.add(g);
}

function createBusStop(scene: THREE.Scene, x: number, z: number) {
  const g = new THREE.Group();
  const shelterMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.3 });
  for (let i = -1; i <= 1; i += 2) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.8, 8), shelterMat);
    pole.position.set(i * 1.5, 1.4, 0); g.add(pole);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.08, 1.5), shelterMat);
  roof.position.y = 2.8; g.add(roof);
  g.position.set(x, 0, z);
  scene.add(g);
}

function createStreetLamp(scene: THREE.Scene, x: number, z: number) {
  const g = new THREE.Group();
  const poleMat = mat('lamp-pole', { color: 0x2a2a2a });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 5.5, 6), poleMat);
  pole.position.y = 2.75; g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.04), poleMat);
  arm.position.set(0.4, 5.5, 0); g.add(arm);
  // Emissive lamp head - NO PointLight to save GPU
  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.15, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xffff99, emissive: 0xffff44, emissiveIntensity: 0.6 })
  );
  housing.position.set(0.8, 5.45, 0); g.add(housing);
  g.position.set(x, 0, z);
  scene.add(g);
}

function createBench(scene: THREE.Scene, x: number, z: number) {
  const g = new THREE.Group();
  const wood = mat('bench-wood', { color: 0x8b4513, roughness: 0.8 });
  const metal = mat('bench-metal', { color: 0x333333, metalness: 0.8 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.45), wood);
  seat.position.y = 0.5; g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.06), wood);
  back.position.set(0, 0.78, -0.18); g.add(back);
  for (let s = -1; s <= 1; s += 2) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.45), metal);
    leg.position.set(s * 0.7, 0.25, 0); g.add(leg);
  }
  g.position.set(x, 0, z);
  scene.add(g);
}

function createBollard(scene: THREE.Scene, x: number, z: number) {
  const b = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 0.8, 6),
    mat('bollard', { color: 0x444444, metalness: 0.6 })
  );
  b.position.set(x, 0.4, z);
  scene.add(b);
}

// ─── City Buildings ───
function createCityBuildings(scene: THREE.Scene): GameBuilding[] {
  const buildings: GameBuilding[] = [
    { id: 'bank', name: 'Barclays Bank', type: 'bank', position: new THREE.Vector3(-55, 0, -110), size: new THREE.Vector3(32, 28, 22) },
    { id: 'shop1', name: 'Tesco Express', type: 'shop', position: new THREE.Vector3(55, 0, -110), size: new THREE.Vector3(28, 16, 20) },
    { id: 'police', name: 'Croydon Police Station', type: 'police', position: new THREE.Vector3(-85, 0, 55), size: new THREE.Vector3(45, 22, 32) },
    { id: 'hospital', name: "Croydon University Hospital", type: 'hospital', position: new THREE.Vector3(85, 0, 55), size: new THREE.Vector3(55, 40, 45) },
    { id: 'jobcenter', name: 'Job Centre Plus', type: 'job', position: new THREE.Vector3(0, 0, 160), size: new THREE.Vector3(38, 20, 28) },
    { id: 'apartments', name: 'Saffron Tower', type: 'apartment', position: new THREE.Vector3(-110, 0, -220), size: new THREE.Vector3(28, 65, 28) },
    { id: 'pub', name: 'The Crown & Thistle', type: 'pub', position: new THREE.Vector3(110, 0, -220), size: new THREE.Vector3(22, 13, 20) },
    { id: 'garage', name: 'Halfords Autocentre', type: 'garage', position: new THREE.Vector3(-130, 0, 110), size: new THREE.Vector3(38, 12, 32) },
    { id: 'dealership', name: 'CF Motors', type: 'dealership', position: new THREE.Vector3(130, 0, 110), size: new THREE.Vector3(48, 14, 38) },
    { id: 'shop2', name: 'Primark', type: 'shop', position: new THREE.Vector3(-55, 0, 250), size: new THREE.Vector3(40, 18, 25) },
    { id: 'shop3', name: 'JD Sports', type: 'shop', position: new THREE.Vector3(55, 0, 250), size: new THREE.Vector3(30, 15, 22) },
    { id: 'apt2', name: 'No.1 Croydon', type: 'apartment', position: new THREE.Vector3(220, 0, -80), size: new THREE.Vector3(25, 82, 25) },
    { id: 'apt3', name: 'Altitude 25', type: 'apartment', position: new THREE.Vector3(-220, 0, -80), size: new THREE.Vector3(22, 55, 22) },
    { id: 'shop4', name: "Sainsbury's Local", type: 'shop', position: new THREE.Vector3(220, 0, 80), size: new THREE.Vector3(30, 14, 25) },
    { id: 'shop5', name: 'William Hill', type: 'shop', position: new THREE.Vector3(-220, 0, 80), size: new THREE.Vector3(18, 12, 15) },
    { id: 'apt4', name: 'College Green', type: 'apartment', position: new THREE.Vector3(0, 0, -300), size: new THREE.Vector3(35, 45, 30) },
    { id: 'shop6', name: 'Greggs', type: 'shop', position: new THREE.Vector3(-55, 0, -300), size: new THREE.Vector3(15, 10, 12) },
    { id: 'pub2', name: 'The George', type: 'pub', position: new THREE.Vector3(55, 0, -300), size: new THREE.Vector3(20, 12, 18) },
  ];

  const brickTex = brickTexture();

  const typeStyles: Record<string, { color: number; accent: number; signBg: string; signFg: string }> = {
    bank:       { color: 0x1a5c3a, accent: 0x0d3d25, signBg: '#0d3d25', signFg: '#00ff88' },
    shop:       { color: 0xccccbb, accent: 0x2d5a8c, signBg: '#2d5a8c', signFg: '#ffffff' },
    police:     { color: 0x1a3a5c, accent: 0x0a1f33, signBg: '#001133', signFg: '#4488ff' },
    hospital:   { color: 0xeeeeee, accent: 0x006600, signBg: '#006600', signFg: '#ffffff' },
    job:        { color: 0x666666, accent: 0x444444, signBg: '#333333', signFg: '#ffcc00' },
    apartment:  { color: 0x887766, accent: 0x554433, signBg: '#333333', signFg: '#ffffff' },
    pub:        { color: 0x654321, accent: 0x3a2510, signBg: '#1a0d00', signFg: '#ffcc33' },
    garage:     { color: 0x555555, accent: 0x333333, signBg: '#222222', signFg: '#ff6600' },
    dealership: { color: 0x3a5a7a, accent: 0x1a3050, signBg: '#0a1520', signFg: '#00ccff' },
  };

  buildings.forEach(b => {
    const group = new THREE.Group();
    const style = typeStyles[b.type] || typeStyles.shop;

    // Main structure with brick texture
    const brickTexClone = brickTex.clone();
    brickTexClone.repeat.set(b.size.x / 8, b.size.y / 8);
    const bodyMat = new THREE.MeshStandardMaterial({
      map: brickTexClone,
      color: style.color,
      roughness: 0.75,
      metalness: 0.05,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(b.size.x, b.size.y, b.size.z), bodyMat);
    body.position.y = b.size.y / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Ground floor accent
    const accentH = Math.min(5, b.size.y * 0.2);
    const accent = new THREE.Mesh(
      new THREE.BoxGeometry(b.size.x + 0.1, accentH, b.size.z + 0.1),
      new THREE.MeshStandardMaterial({ color: style.accent, roughness: 0.5, metalness: 0.2 })
    );
    accent.position.y = accentH / 2;
    group.add(accent);

    // Windows - reduced count for performance
    const winMat = new THREE.MeshStandardMaterial({ color: 0x88bbdd, metalness: 0.6, roughness: 0.15 });
    const winsPerFloor = Math.max(1, Math.floor(b.size.x / 8));
    const floors = Math.max(1, Math.floor((b.size.y - accentH) / 8));
    for (let f = 0; f < Math.min(floors, 6); f++) {
      for (let w = 0; w < Math.min(winsPerFloor, 4); w++) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 3.8), winMat);
        win.position.set(-b.size.x / 2 + 3.5 + w * (b.size.x / winsPerFloor), accentH + 3 + f * 8, b.size.z / 2 + 0.06);
        group.add(win);
      }
    }

    // Door
    const doorH = Math.min(4.5, accentH * 0.85);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(3, doorH, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.5 })
    );
    door.position.set(0, doorH / 2, b.size.z / 2 + 0.15);
    group.add(door);

    // Building sign
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 512; signCanvas.height = 96;
    const ctx = signCanvas.getContext('2d')!;
    ctx.fillStyle = style.signBg;
    ctx.fillRect(0, 0, 512, 96);
    ctx.strokeStyle = style.signFg;
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, 504, 88);
    ctx.fillStyle = style.signFg;
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(b.name, 256, 58);
    const signTex = new THREE.CanvasTexture(signCanvas);
    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(b.size.x * 0.8, 3), new THREE.MeshBasicMaterial({ map: signTex }));
    signMesh.position.set(0, accentH + 0.5, b.size.z / 2 + 0.08);
    group.add(signMesh);

    // Roof
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(b.size.x + 0.5, 0.5, b.size.z + 0.5),
      mat('roof', { color: 0x333333, roughness: 0.6 })
    );
    roof.position.y = b.size.y + 0.25;
    group.add(roof);

    group.position.copy(b.position);
    scene.add(group);
  });

  return buildings;
}

// ─── Vegetation (reduced) ───
function createVegetation(scene: THREE.Scene) {
  const positions = [
    [-35, 35], [35, 35], [-35, -35], [35, -35],
    [-65, 85], [65, 85], [-65, -85], [65, -85],
    [-105, 5], [105, 5], [5, 105], [5, -105],
    [-30, 180], [30, 180], [-250, 0], [250, 0],
  ];
  positions.forEach(([x, z]) => createTree(scene, x, z));
}

function createTree(scene: THREE.Scene, x: number, z: number) {
  const g = new THREE.Group();
  const trunkH = 1.5 + Math.random() * 1.5;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.25, trunkH, 6),
    mat('trunk', { color: 0x4a3528, roughness: 0.9 })
  );
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  g.add(trunk);

  const leafMat = mat('leaf', { color: 0x2d5a2d, roughness: 0.8 });
  for (let i = 0; i < 3; i++) {
    const s = (1.2 + Math.random() * 0.6) * (1 - i * 0.2);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 8), leafMat);
    leaf.position.set(0, trunkH + i * 0.6 + 0.5, 0);
    leaf.castShadow = true;
    g.add(leaf);
  }

  g.position.set(x, 0, z);
  scene.add(g);
}

// ─── Parked Cars ───
function createParkedCars(scene: THREE.Scene) {
  const cars = [
    { x: -5, z: -30, rot: 0, color: 0xcc0000 },
    { x: -5, z: -50, rot: 0, color: 0x2244aa },
    { x: 5, z: 30, rot: Math.PI, color: 0x444444 },
    { x: 5, z: 50, rot: Math.PI, color: 0xffffff },
    { x: 5, z: 70, rot: Math.PI, color: 0x228822 },
    { x: -5, z: -80, rot: 0, color: 0xffcc00 },
    { x: 195, z: 5, rot: Math.PI / 2, color: 0x882222 },
    { x: -195, z: -5, rot: -Math.PI / 2, color: 0x3366cc },
  ];
  cars.forEach(cp => createParkedCar(scene, cp.x, cp.z, cp.rot, cp.color));
}

function createParkedCar(scene: THREE.Scene, x: number, z: number, rotation: number, color: number) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.7 });

  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 4.5), bodyMat);
  body.position.y = 0.6;
  body.castShadow = true;
  g.add(body);

  // Cabin
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.7, 2.5),
    new THREE.MeshStandardMaterial({ color: 0x88bbdd, transparent: true, opacity: 0.5, metalness: 0.5 })
  );
  cabin.position.set(0, 1.3, -0.2);
  g.add(cabin);

  // Wheels
  const wheelMat = mat('wheel', { color: 0x111111, roughness: 0.5 });
  const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8);
  [[-0.9, 0.3, 1.3], [0.9, 0.3, 1.3], [-0.9, 0.3, -1.3], [0.9, 0.3, -1.3]].forEach(([wx, wy, wz]) => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx, wy, wz);
    w.rotation.z = Math.PI / 2;
    g.add(w);
  });

  // Headlights (emissive only)
  const hlMat = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffff88, emissiveIntensity: 0.3 });
  const hl1 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), hlMat);
  hl1.position.set(-0.6, 0.6, 2.26); g.add(hl1);
  const hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), hlMat);
  hl2.position.set(0.6, 0.6, 2.26); g.add(hl2);

  g.position.set(x, 0, z);
  g.rotation.y = rotation;
  scene.add(g);
}

// ─── Atmosphere ───
function createAtmosphere(scene: THREE.Scene) {
  const silhouetteMat = mat('skyline', { color: 0x334455, roughness: 1, metalness: 0 });
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const dist = 600 + Math.random() * 150;
    const h = 30 + Math.random() * 60;
    const w = 15 + Math.random() * 20;
    const sil = new THREE.Mesh(new THREE.BoxGeometry(w, h, 10), silhouetteMat);
    sil.position.set(Math.sin(angle) * dist, h / 2, Math.cos(angle) * dist);
    sil.lookAt(0, h / 2, 0);
    scene.add(sil);
  }
}
