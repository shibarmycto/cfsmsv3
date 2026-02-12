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
function createTiledTexture(color1: string, color2: string, tileSize = 64, repeats = 40): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < 512; y += tileSize) {
    for (let x = 0; x < 512; x += tileSize) {
      ctx.fillStyle = ((x + y) / tileSize) % 2 === 0 ? color1 : color2;
      ctx.fillRect(x, y, tileSize, tileSize);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeats, repeats);
  return t;
}

function noiseTexture(base: string, variance: number, size = 512): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 8000; i++) {
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
  // mortar
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
  // Grass
  const grassTex = noiseTexture('#3a6b2a', 30);
  grassTex.repeat.set(60, 60);
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(3000, 3000),
    new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.receiveShadow = true;
  scene.add(grass);

  // Pavement (concrete sidewalks)
  const paveTex = noiseTexture('#999999', 15);
  paveTex.repeat.set(80, 80);
  const pave = new THREE.Mesh(
    new THREE.PlaneGeometry(3000, 3000),
    new THREE.MeshStandardMaterial({ map: paveTex, roughness: 0.85 })
  );
  pave.rotation.x = -Math.PI / 2;
  pave.position.y = 0.005;
  scene.add(pave);
}

// ─── Road network ───
function createRoadNetwork(scene: THREE.Scene) {
  const asphaltTex = noiseTexture('#2a2a2a', 10);
  asphaltTex.repeat.set(1, 60);
  const roadMat = new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.8 });
  const rw = 14;

  // Main roads
  const roads = [
    { w: rw, d: 2000, x: 0, z: 0 },           // N-S main
    { w: 2000, d: rw, x: 0, z: 0 },           // E-W main
    { w: rw, d: 2000, x: 200, z: 0 },          // N-S secondary
    { w: rw, d: 2000, x: -200, z: 0 },         // N-S secondary
    { w: 2000, d: rw, x: 0, z: 200 },          // E-W secondary
    { w: 2000, d: rw, x: 0, z: -200 },         // E-W secondary
  ];

  roads.forEach(r => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.d), roadMat.clone());
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(r.x, 0.01, r.z);
    mesh.receiveShadow = true;
    scene.add(mesh);
  });

  addRoadMarkings(scene, rw);
}

function addRoadMarkings(scene: THREE.Scene, rw: number) {
  const whiteMat = mat('white', { color: 0xffffff });
  const yellowMat = mat('yellow', { color: 0xffd700 });
  const redMat = mat('red-line', { color: 0xcc0000 });

  // Center dashed lines on main roads
  for (let i = -990; i < 1000; i += 15) {
    const d1 = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 8), whiteMat);
    d1.rotation.x = -Math.PI / 2; d1.position.set(0, 0.02, i); scene.add(d1);
    const d2 = new THREE.Mesh(new THREE.PlaneGeometry(8, 0.15), whiteMat);
    d2.rotation.x = -Math.PI / 2; d2.position.set(i, 0.02, 0); scene.add(d2);
  }

  // Double yellow no-parking lines
  const yw = rw / 2 - 0.6;
  [0, 200, -200].forEach(roadX => {
    for (let s = -1; s <= 1; s += 2) {
      for (let d = 0; d < 2; d++) {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 2000), yellowMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(roadX + s * (yw + d * 0.2), 0.02, 0);
        scene.add(line);
      }
    }
  });

  // Red route lines (London-style)
  [0].forEach(roadX => {
    for (let s = -1; s <= 1; s += 2) {
      const rl = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 2000), redMat);
      rl.rotation.x = -Math.PI / 2;
      rl.position.set(roadX + s * (yw + 0.5), 0.025, 0);
      scene.add(rl);
    }
  });

  // Zebra crossings
  createZebraCrossing(scene, 0, 40);
  createZebraCrossing(scene, 0, -40);
  createZebraCrossing(scene, 40, 0);
  createZebraCrossing(scene, -40, 0);

  // Road text
  createRoadText(scene, 'SLOW', 0, -60);
  createRoadText(scene, 'A204', 0, -90);
  createRoadText(scene, 'STOP', 0, 60);
  createRoadText(scene, 'KEEP LEFT', -3, -120);
}

function createZebraCrossing(scene: THREE.Scene, x: number, z: number) {
  const stripeMat = mat('stripe', { color: 0xffffff });
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(12, 0.6), stripeMat);
    s.rotation.x = -Math.PI / 2;
    s.position.set(x, 0.025, z + (i - 7) * 1.2);
    scene.add(s);
  }
  createBelishaBeacon(scene, x - 8, z);
  createBelishaBeacon(scene, x + 8, z);
}

function createBelishaBeacon(scene: THREE.Scene, x: number, z: number) {
  const g = new THREE.Group();
  for (let i = 0; i < 10; i++) {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.35, 8),
      mat(i % 2 === 0 ? 'b-black' : 'b-white', { color: i % 2 === 0 ? 0x1a1a1a : 0xffffff })
    );
    seg.position.y = 0.175 + i * 0.35;
    g.add(seg);
  }
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xff8c00, emissive: 0xff4400, emissiveIntensity: 0.5, transparent: true, opacity: 0.9 })
  );
  globe.position.y = 3.7;
  g.add(globe);
  g.position.set(x, 0, z);
  scene.add(g);
}

function createRoadText(scene: THREE.Scene, text: string, x: number, z: number) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'white';
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 64);
  const tex = new THREE.CanvasTexture(c);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.5), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.03, z);
  scene.add(mesh);
}

// ─── Street Furniture ───
function createStreetFurniture(scene: THREE.Scene) {
  // Phone boxes
  createPhoneBox(scene, -18, 35);
  createPhoneBox(scene, 18, -135);

  // Pillar boxes
  createPillarBox(scene, 16, -35);
  createPillarBox(scene, -16, 135);

  // Bus stops
  createBusStop(scene, -22, -70);
  createBusStop(scene, 22, 70);

  // Street lamps along all roads
  for (let z = -400; z <= 400; z += 30) {
    createStreetLamp(scene, -9, z);
    createStreetLamp(scene, 9, z);
  }
  for (let x = -400; x <= 400; x += 30) {
    createStreetLamp(scene, x, -9);
    createStreetLamp(scene, x, 9);
  }

  // Benches
  createBench(scene, -14, 10);
  createBench(scene, 14, -10);
  createBench(scene, -14, 110);
  createBench(scene, 14, -110);

  // Bollards along pavements
  for (let z = -100; z <= 100; z += 8) {
    createBollard(scene, -7.5, z);
    createBollard(scene, 7.5, z);
  }

  // Bins
  createBin(scene, -10, 20);
  createBin(scene, 10, -20);
  createBin(scene, -10, 80);
}

function createPhoneBox(scene: THREE.Scene, x: number, z: number) {
  const g = new THREE.Group();
  const red = mat('phone-red', { color: 0xcc0000, roughness: 0.3 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.8, 1.2), red);
  box.position.y = 1.4; box.castShadow = true;
  g.add(box);
  const winMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.6, metalness: 0.5 });
  for (let i = 0; i < 4; i++) {
    if (i === 2) continue;
    const a = (i / 4) * Math.PI * 2;
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.8), winMat);
    w.position.set(Math.sin(a) * 0.61, 1.5, Math.cos(a) * 0.61);
    w.rotation.y = a;
    g.add(w);
  }
  const crown = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.15, 1.3), red.clone());
  crown.position.y = 2.85; g.add(crown);
  g.position.set(x, 0, z);
  scene.add(g);
}

function createPillarBox(scene: THREE.Scene, x: number, z: number) {
  const g = new THREE.Group();
  const red = mat('pillar-red', { color: 0xcc0000, roughness: 0.4 });
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 1.4, 16), red);
  pillar.position.y = 0.7; pillar.castShadow = true; g.add(pillar);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), red.clone());
  dome.position.y = 1.4; g.add(dome);
  g.position.set(x, 0, z);
  scene.add(g);
}

function createBusStop(scene: THREE.Scene, x: number, z: number) {
  const g = new THREE.Group();
  // Shelter
  const shelterMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.3 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xaaddff, transparent: true, opacity: 0.3, metalness: 0.5 });
  // Poles
  for (let i = -1; i <= 1; i += 2) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.8, 8), shelterMat);
    pole.position.set(i * 1.5, 1.4, 0); g.add(pole);
  }
  // Roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.08, 1.5), shelterMat);
  roof.position.y = 2.8; g.add(roof);
  // Glass panels
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.5), glassMat);
  panel.position.set(0, 1.3, -0.7); g.add(panel);
  // Sign
  const signMat = mat('bus-sign', { color: 0xff0000 });
  const sign = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16), signMat);
  sign.position.set(1.5, 3.2, 0); sign.rotation.x = Math.PI / 2; g.add(sign);
  g.position.set(x, 0, z);
  scene.add(g);
}

function createStreetLamp(scene: THREE.Scene, x: number, z: number) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 5.5, 8), mat('lamp-pole', { color: 0x2a2a2a }));
  pole.position.y = 2.75; g.add(pole);
  // Curved arm
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.04), mat('lamp-pole', { color: 0x2a2a2a }));
  arm.position.set(0.4, 5.5, 0); g.add(arm);
  // Light housing
  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.15, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xffff99, emissive: 0xffff44, emissiveIntensity: 0.4 })
  );
  housing.position.set(0.8, 5.45, 0); g.add(housing);
  // Actual light
  const light = new THREE.PointLight(0xffee88, 0.6, 20);
  light.position.set(0.8, 5.4, 0); g.add(light);
  g.position.set(x, 0, z);
  scene.add(g);
}

function createBench(scene: THREE.Scene, x: number, z: number) {
  const g = new THREE.Group();
  const wood = mat('bench-wood', { color: 0x8b4513, roughness: 0.8 });
  const metal = mat('bench-metal', { color: 0x333333, metalness: 0.8 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.45), wood);
  seat.position.y = 0.5; seat.castShadow = true; g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.06), wood.clone());
  back.position.set(0, 0.78, -0.18); back.rotation.x = -0.12; g.add(back);
  for (let s = -1; s <= 1; s += 2) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.45), metal);
    leg.position.set(s * 0.7, 0.25, 0); g.add(leg);
  }
  g.position.set(x, 0, z);
  scene.add(g);
}

function createBollard(scene: THREE.Scene, x: number, z: number) {
  const b = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 0.8, 8),
    mat('bollard', { color: 0x444444, metalness: 0.6 })
  );
  b.position.set(x, 0.4, z);
  b.castShadow = true;
  scene.add(b);
}

function createBin(scene: THREE.Scene, x: number, z: number) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.3, 0.8, 12),
    mat('bin', { color: 0x2a2a2a, roughness: 0.6 })
  );
  body.position.y = 0.4; body.castShadow = true; g.add(body);
  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.05, 12),
    mat('bin-lid', { color: 0x333333, metalness: 0.5 })
  );
  lid.position.y = 0.82; g.add(lid);
  g.position.set(x, 0, z);
  scene.add(g);
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
    // Additional buildings for density
    { id: 'shop2', name: 'Primark', type: 'shop', position: new THREE.Vector3(-55, 0, 250), size: new THREE.Vector3(40, 18, 25) },
    { id: 'shop3', name: 'JD Sports', type: 'shop', position: new THREE.Vector3(55, 0, 250), size: new THREE.Vector3(30, 15, 22) },
    { id: 'apt2', name: 'No.1 Croydon', type: 'apartment', position: new THREE.Vector3(220, 0, -80), size: new THREE.Vector3(25, 82, 25) },
    { id: 'apt3', name: 'Altitude 25', type: 'apartment', position: new THREE.Vector3(-220, 0, -80), size: new THREE.Vector3(22, 55, 22) },
    { id: 'shop4', name: 'Sainsbury\'s Local', type: 'shop', position: new THREE.Vector3(220, 0, 80), size: new THREE.Vector3(30, 14, 25) },
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

    // Ground floor accent (shopfront / entrance)
    const accentH = Math.min(5, b.size.y * 0.2);
    const accent = new THREE.Mesh(
      new THREE.BoxGeometry(b.size.x + 0.1, accentH, b.size.z + 0.1),
      new THREE.MeshStandardMaterial({ color: style.accent, roughness: 0.5, metalness: 0.2 })
    );
    accent.position.y = accentH / 2;
    group.add(accent);

    // Windows
    const winMat = new THREE.MeshStandardMaterial({ color: 0x88bbdd, metalness: 0.6, roughness: 0.15 });
    const winDarkMat = new THREE.MeshStandardMaterial({ color: 0x223344, metalness: 0.3, roughness: 0.3 });
    const winsPerFloor = Math.max(1, Math.floor(b.size.x / 6));
    const floors = Math.max(1, Math.floor((b.size.y - accentH) / 6));
    for (let f = 0; f < floors; f++) {
      for (let w = 0; w < winsPerFloor; w++) {
        const isLit = Math.random() > 0.4;
        const wm = isLit ? winMat : winDarkMat;
        // Front
        const win = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 3.8), wm);
        win.position.set(-b.size.x / 2 + 3.5 + w * (b.size.x / winsPerFloor), accentH + 3 + f * 6, b.size.z / 2 + 0.06);
        group.add(win);
        // Back
        const winB = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 3.8), wm);
        winB.position.set(-b.size.x / 2 + 3.5 + w * (b.size.x / winsPerFloor), accentH + 3 + f * 6, -b.size.z / 2 - 0.06);
        winB.rotation.y = Math.PI;
        group.add(winB);
      }
    }

    // Shopfront windows (ground floor)
    if (['shop', 'bank', 'pub', 'dealership'].includes(b.type)) {
      const shopWin = new THREE.Mesh(
        new THREE.PlaneGeometry(b.size.x * 0.6, accentH * 0.7),
        new THREE.MeshStandardMaterial({ color: 0xaaccee, metalness: 0.5, roughness: 0.1, transparent: true, opacity: 0.8 })
      );
      shopWin.position.set(0, accentH * 0.45, b.size.z / 2 + 0.08);
      group.add(shopWin);
    }

    // Door
    const doorH = Math.min(4.5, accentH * 0.85);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(3, doorH, 0.3),
      new THREE.MeshStandardMaterial({ color: b.type === 'police' ? 0x1a3a5c : 0x4a3728, roughness: 0.5 })
    );
    door.position.set(0, doorH / 2, b.size.z / 2 + 0.15);
    group.add(door);

    // Building sign
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 512; signCanvas.height = 96;
    const ctx = signCanvas.getContext('2d')!;
    ctx.fillStyle = style.signBg;
    ctx.fillRect(0, 0, 512, 96);
    // Sign border
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
    roof.castShadow = true;
    group.add(roof);

    // Roof details (vents, AC units)
    if (b.size.y > 15) {
      for (let i = 0; i < Math.floor(Math.random() * 3) + 1; i++) {
        const vent = new THREE.Mesh(
          new THREE.BoxGeometry(2, 1.5, 2),
          mat('vent', { color: 0x555555, metalness: 0.5 })
        );
        vent.position.set(
          (Math.random() - 0.5) * b.size.x * 0.5,
          b.size.y + 1,
          (Math.random() - 0.5) * b.size.z * 0.3
        );
        group.add(vent);
      }
    }

    group.position.copy(b.position);
    scene.add(group);
  });

  return buildings;
}

// ─── Vegetation ───
function createVegetation(scene: THREE.Scene) {
  const positions = [
    [-35, 35], [35, 35], [-35, -35], [35, -35],
    [-65, 85], [65, 85], [-65, -85], [65, -85],
    [-105, 5], [105, 5], [5, 105], [5, -105],
    [-30, 180], [30, 180], [-30, -180], [30, -180],
    [-160, 30], [160, 30], [-160, -30], [160, -30],
    // More trees for density
    [-250, 0], [250, 0], [0, 300], [0, -350],
    [-180, 180], [180, 180], [-180, -180], [180, -180],
  ];
  positions.forEach(([x, z]) => createTree(scene, x, z));

  // Hedges along some pavements
  for (let z = -100; z <= 100; z += 3) {
    createHedge(scene, -11, z);
    createHedge(scene, 11, z);
  }
}

function createTree(scene: THREE.Scene, x: number, z: number) {
  const g = new THREE.Group();
  const trunkH = 1.5 + Math.random() * 1.5;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.25, trunkH, 8),
    mat('trunk', { color: 0x4a3528, roughness: 0.9 })
  );
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  g.add(trunk);

  const leafMat = mat('leaf', { color: 0x2d5a2d, roughness: 0.8 });
  const foliageSize = 1.2 + Math.random() * 0.8;
  // Multiple spheres for natural look
  for (let i = 0; i < 4; i++) {
    const s = foliageSize * (1 - i * 0.15);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 10), leafMat);
    leaf.position.set(
      (Math.random() - 0.5) * 0.4,
      trunkH + i * 0.6 + 0.5,
      (Math.random() - 0.5) * 0.4
    );
    leaf.castShadow = true;
    g.add(leaf);
  }

  g.position.set(x, 0, z);
  scene.add(g);
}

function createHedge(scene: THREE.Scene, x: number, z: number) {
  const h = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.6, 1.2),
    mat('hedge', { color: 0x2a5a1a, roughness: 0.9 })
  );
  h.position.set(x, 0.3, z);
  h.castShadow = true;
  scene.add(h);
}

// ─── Parked Cars ───
function createParkedCars(scene: THREE.Scene) {
  const carPositions = [
    { x: -5, z: -30, rot: 0, color: 0xcc0000 },
    { x: -5, z: -50, rot: 0, color: 0x2244aa },
    { x: 5, z: 30, rot: Math.PI, color: 0x444444 },
    { x: 5, z: 50, rot: Math.PI, color: 0xffffff },
    { x: 5, z: 70, rot: Math.PI, color: 0x228822 },
    { x: -5, z: -80, rot: 0, color: 0xffcc00 },
    // Secondary roads
    { x: 195, z: 5, rot: Math.PI / 2, color: 0x882222 },
    { x: 205, z: 5, rot: Math.PI / 2, color: 0x666666 },
    { x: -195, z: -5, rot: -Math.PI / 2, color: 0x3366cc },
  ];

  carPositions.forEach(cp => createParkedCar(scene, cp.x, cp.z, cp.rot, cp.color));
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
  cabin.position.y = 1.3;
  cabin.position.z = -0.2;
  g.add(cabin);

  // Wheels
  const wheelMat = mat('wheel', { color: 0x111111, roughness: 0.5 });
  const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 12);
  [[-0.9, 0.3, 1.3], [0.9, 0.3, 1.3], [-0.9, 0.3, -1.3], [0.9, 0.3, -1.3]].forEach(([wx, wy, wz]) => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx, wy, wz);
    w.rotation.z = Math.PI / 2;
    g.add(w);
  });

  // Headlights
  const hlMat = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffff88, emissiveIntensity: 0.2 });
  const hl1 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), hlMat);
  hl1.position.set(-0.6, 0.6, 2.26); g.add(hl1);
  const hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), hlMat);
  hl2.position.set(0.6, 0.6, 2.26); g.add(hl2);

  // Tail lights
  const tlMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.15 });
  const tl1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.05), tlMat);
  tl1.position.set(-0.7, 0.6, -2.26); g.add(tl1);
  const tl2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.05), tlMat);
  tl2.position.set(0.7, 0.6, -2.26); g.add(tl2);

  g.position.set(x, 0, z);
  g.rotation.y = rotation;
  scene.add(g);
}

// ─── Atmosphere ───
function createAtmosphere(scene: THREE.Scene) {
  // Distant skyline silhouettes
  const silhouetteMat = mat('skyline', { color: 0x334455, roughness: 1, metalness: 0 });
  for (let i = 0; i < 20; i++) {
    const angle = (i / 20) * Math.PI * 2;
    const dist = 800 + Math.random() * 200;
    const h = 30 + Math.random() * 80;
    const w = 15 + Math.random() * 25;
    const sil = new THREE.Mesh(new THREE.BoxGeometry(w, h, 15), silhouetteMat);
    sil.position.set(Math.sin(angle) * dist, h / 2, Math.cos(angle) * dist);
    sil.lookAt(0, h / 2, 0);
    scene.add(sil);
  }
}
