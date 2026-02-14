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
  for (let i = 0; i < 4000; i++) {
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
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  for (let row = 0; row <= 256 / bh; row++) {
    ctx.beginPath(); ctx.moveTo(0, row * bh); ctx.lineTo(256, row * bh); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function concreteTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#b8b0a8';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6000; i++) {
    const v = Math.random() * 20 - 10;
    ctx.fillStyle = `rgb(${184+v},${176+v},${168+v})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  // Cracks
  for (let i = 0; i < 5; i++) {
    ctx.strokeStyle = `rgba(80,70,60,${0.2 + Math.random() * 0.15})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    let x = Math.random() * 256, y = Math.random() * 256;
    ctx.moveTo(x, y);
    for (let j = 0; j < 8; j++) {
      x += (Math.random() - 0.5) * 40;
      y += Math.random() * 30;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
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
  createProperties(scene, buildings);
  return buildings;
}

// ─── Ground ───
function createGround(scene: THREE.Scene) {
  const grassTex = noiseTexture('#2d5a1e', 25, 512);
  grassTex.repeat.set(80, 80);
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.92, color: 0x3a6b2a })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.receiveShadow = true;
  scene.add(grass);

  // Sidewalks
  const paveTex = concreteTexture();
  paveTex.repeat.set(100, 100);
  const pave = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshStandardMaterial({ map: paveTex, roughness: 0.8, color: 0xaaaaaa })
  );
  pave.rotation.x = -Math.PI / 2;
  pave.position.y = 0.005;
  pave.receiveShadow = true;
  scene.add(pave);

  // Curb edges along main roads
  const curbMat = mat('curb', { color: 0x999999, roughness: 0.7, metalness: 0.1 });
  [0, 200, -200].forEach(roadX => {
    [-1, 1].forEach(side => {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 1200), curbMat);
      curb.position.set(roadX + side * 7.5, 0.075, 0);
      scene.add(curb);
    });
  });
  [0, 200, -200].forEach(roadZ => {
    [-1, 1].forEach(side => {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(1200, 0.15, 0.3), curbMat);
      curb.position.set(0, 0.075, roadZ + side * 7.5);
      scene.add(curb);
    });
  });
}

// ─── Road network ───
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
  const whiteMat = mat('white', { color: 0xffffff });
  const yellowMat = mat('yellow', { color: 0xffd700 });

  for (let i = -500; i < 500; i += 30) {
    const d1 = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 15), whiteMat);
    d1.rotation.x = -Math.PI / 2; d1.position.set(0, 0.02, i); scene.add(d1);
    const d2 = new THREE.Mesh(new THREE.PlaneGeometry(15, 0.15), whiteMat);
    d2.rotation.x = -Math.PI / 2; d2.position.set(i, 0.02, 0); scene.add(d2);
  }

  const yw = rw / 2 - 0.6;
  [0, 200, -200].forEach(roadX => {
    for (let s = -1; s <= 1; s += 2) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 1200), yellowMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(roadX + s * yw, 0.02, 0);
      scene.add(line);
    }
  });

  createZebraCrossing(scene, 0, 40);
  createZebraCrossing(scene, 0, -40);
  createZebraCrossing(scene, 200, 40);
  createZebraCrossing(scene, -200, -40);
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

// ─── Street Furniture ───
function createStreetFurniture(scene: THREE.Scene) {
  createPhoneBox(scene, -18, 35);
  createPhoneBox(scene, 18, -135);
  createPillarBox(scene, 16, -35);
  createPillarBox(scene, -16, 135);
  createBusStop(scene, -22, -70);
  createBusStop(scene, 22, 70);

  for (let z = -300; z <= 300; z += 40) {
    createStreetLamp(scene, -9, z);
    createStreetLamp(scene, 9, z);
  }

  createBench(scene, -14, 10);
  createBench(scene, 14, -10);
  createBench(scene, -14, 100);
  createBench(scene, 14, -100);

  for (let z = -60; z <= 60; z += 12) {
    createBollard(scene, -7.5, z);
    createBollard(scene, 7.5, z);
  }

  // Dumpsters
  createDumpster(scene, -30, -150);
  createDumpster(scene, 45, 160);

  // Fire hydrants
  createFireHydrant(scene, 10, 25);
  createFireHydrant(scene, -10, -80);
}

function createPhoneBox(scene: THREE.Scene, x: number, z: number) {
  const g = new THREE.Group();
  const red = mat('phone-red', { color: 0xcc0000, roughness: 0.3 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.8, 1.2), red);
  box.position.y = 1.4; box.castShadow = true;
  g.add(box);
  const crown = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.15, 1.3), red);
  crown.position.y = 2.85; g.add(crown);
  // Glass panels
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x88aacc, transparent: true, opacity: 0.4, metalness: 0.3 });
  [0, Math.PI/2, Math.PI, Math.PI*1.5].forEach((rot, i) => {
    if (i === 0) return; // door side
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.0), glassMat);
    glass.position.y = 1.4;
    glass.position.x = Math.sin(rot) * 0.61;
    glass.position.z = Math.cos(rot) * 0.61;
    glass.rotation.y = rot;
    g.add(glass);
  });
  g.position.set(x, 0, z);
  scene.add(g);
}

function createPillarBox(scene: THREE.Scene, x: number, z: number) {
  const g = new THREE.Group();
  const red = mat('pillar-red', { color: 0xcc0000, roughness: 0.4 });
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 1.4, 16), red);
  pillar.position.y = 0.7; pillar.castShadow = true; g.add(pillar);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), red);
  dome.position.y = 1.4; g.add(dome);
  // Slot
  const slotMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.08), slotMat);
  slot.position.set(0, 1.1, 0.35);
  g.add(slot);
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
  // Glass back panel
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x99bbcc, transparent: true, opacity: 0.3 });
  const backPanel = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 2.2), glassMat);
  backPanel.position.set(0, 1.5, -0.7);
  g.add(backPanel);
  g.position.set(x, 0, z);
  scene.add(g);
}

function createStreetLamp(scene: THREE.Scene, x: number, z: number) {
  const g = new THREE.Group();
  const poleMat = mat('lamp-pole', { color: 0x2a2a2a });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 5.5, 8), poleMat);
  pole.position.y = 2.75; g.add(pole);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), poleMat);
  arm.position.set(0.5, 5.4, 0);
  arm.rotation.z = -Math.PI / 4;
  g.add(arm);
  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.15, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xffff99, emissive: 0xffff44, emissiveIntensity: 0.5 })
  );
  housing.position.set(0.9, 5.35, 0); g.add(housing);
  g.position.set(x, 0, z);
  scene.add(g);
}

function createBench(scene: THREE.Scene, x: number, z: number) {
  const g = new THREE.Group();
  const wood = mat('bench-wood', { color: 0x8b4513, roughness: 0.8 });
  const metal = mat('bench-metal', { color: 0x333333, metalness: 0.8 });
  // Seat slats
  for (let i = 0; i < 4; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.03, 0.1), wood);
    slat.position.set(0, 0.5, -0.15 + i * 0.1);
    g.add(slat);
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.04), wood);
  back.position.set(0, 0.78, -0.2); back.rotation.x = 0.1; g.add(back);
  for (let s = -1; s <= 1; s += 2) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.45), metal);
    leg.position.set(s * 0.75, 0.25, 0); g.add(leg);
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
  scene.add(b);
}

function createDumpster(scene: THREE.Scene, x: number, z: number) {
  const g = new THREE.Group();
  const dumpMat = new THREE.MeshStandardMaterial({ color: 0x2a5a2a, roughness: 0.7, metalness: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 1.5), dumpMat);
  body.position.y = 0.6; body.castShadow = true;
  g.add(body);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.06, 1.55), dumpMat);
  lid.position.y = 1.23; g.add(lid);
  g.position.set(x, 0, z);
  scene.add(g);
}

function createFireHydrant(scene: THREE.Scene, x: number, z: number) {
  const g = new THREE.Group();
  const hydMat = new THREE.MeshStandardMaterial({ color: 0xcc0000, roughness: 0.5, metalness: 0.3 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.6, 10), hydMat);
  body.position.y = 0.3; g.add(body);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8, 0, Math.PI*2, 0, Math.PI/2), hydMat);
  cap.position.y = 0.6; g.add(cap);
  [-1, 1].forEach(side => {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 6), hydMat);
    nozzle.position.set(side * 0.15, 0.4, 0);
    nozzle.rotation.z = Math.PI / 2;
    g.add(nozzle);
  });
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
    { id: 'shop2', name: 'Primark', type: 'shop', position: new THREE.Vector3(-55, 0, 250), size: new THREE.Vector3(40, 18, 25) },
    { id: 'shop3', name: 'JD Sports', type: 'shop', position: new THREE.Vector3(55, 0, 250), size: new THREE.Vector3(30, 15, 22) },
    { id: 'apt2', name: 'No.1 Croydon', type: 'apartment', position: new THREE.Vector3(220, 0, -80), size: new THREE.Vector3(25, 82, 25) },
    { id: 'apt3', name: 'Altitude 25', type: 'apartment', position: new THREE.Vector3(-220, 0, -80), size: new THREE.Vector3(22, 55, 22) },
    { id: 'shop4', name: "Sainsbury's Local", type: 'shop', position: new THREE.Vector3(220, 0, 80), size: new THREE.Vector3(30, 14, 25) },
    { id: 'shop5', name: 'William Hill', type: 'shop', position: new THREE.Vector3(-220, 0, 80), size: new THREE.Vector3(18, 12, 15) },
    { id: 'apt4', name: 'College Green', type: 'apartment', position: new THREE.Vector3(0, 0, -300), size: new THREE.Vector3(35, 45, 30) },
    { id: 'shop6', name: 'Greggs', type: 'shop', position: new THREE.Vector3(-55, 0, -300), size: new THREE.Vector3(15, 10, 12) },
    { id: 'pub2', name: 'The George', type: 'pub', position: new THREE.Vector3(55, 0, -300), size: new THREE.Vector3(20, 12, 18) },
    // Armory
    { id: 'armory', name: 'Underground Armory', type: 'armory', position: new THREE.Vector3(-160, 0, -160), size: new THREE.Vector3(20, 10, 18) },
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
    armory:     { color: 0x333333, accent: 0x1a1a1a, signBg: '#111111', signFg: '#ff3333' },
    property:   { color: 0x8b7355, accent: 0x6b5335, signBg: '#3a2a15', signFg: '#ffdd88' },
  };

  buildings.forEach(b => {
    const group = new THREE.Group();
    const style = typeStyles[b.type] || typeStyles.shop;

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

    // Windows
    const winMat = new THREE.MeshStandardMaterial({ color: 0x88bbdd, metalness: 0.6, roughness: 0.15 });
    const darkWinMat = new THREE.MeshStandardMaterial({ color: 0x334455, metalness: 0.5, roughness: 0.2 });
    const winsPerFloor = Math.max(1, Math.floor(b.size.x / 8));
    const floors = Math.max(1, Math.floor((b.size.y - accentH) / 8));
    for (let f = 0; f < Math.min(floors, 8); f++) {
      for (let w = 0; w < Math.min(winsPerFloor, 5); w++) {
        const useWinMat = Math.random() > 0.3 ? winMat : darkWinMat;
        const win = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 3.8), useWinMat);
        win.position.set(-b.size.x / 2 + 3.5 + w * (b.size.x / winsPerFloor), accentH + 3 + f * 8, b.size.z / 2 + 0.06);
        group.add(win);
        // Window frame
        const frameMat = mat('win-frame', { color: 0x444444, metalness: 0.4 });
        const frameTop = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 0.05), frameMat);
        frameTop.position.set(win.position.x, win.position.y + 1.95, win.position.z + 0.01);
        group.add(frameTop);
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

    // Door frame
    const doorFrame = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, doorH + 0.3, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.4 })
    );
    doorFrame.position.set(0, (doorH + 0.3) / 2, b.size.z / 2 + 0.32);
    group.add(doorFrame);

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

    // AC units on roof for taller buildings
    if (b.size.y > 20) {
      const acMat = mat('ac-unit', { color: 0x888888, roughness: 0.5, metalness: 0.4 });
      for (let i = 0; i < 2; i++) {
        const ac = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 2), acMat);
        ac.position.set(-b.size.x / 4 + i * b.size.x / 2, b.size.y + 1, 0);
        group.add(ac);
      }
    }

    group.position.copy(b.position);
    scene.add(group);
  });

  return buildings;
}

// ─── Properties (buyable houses) ───
function createProperties(scene: THREE.Scene, buildings: GameBuilding[]) {
  const properties = [
    { id: 'house1', name: 'Suburban House', x: -300, z: 150, w: 14, h: 8, d: 12, color: 0xd4c5a9 },
    { id: 'house2', name: 'Modern Villa', x: -340, z: 150, w: 16, h: 10, d: 14, color: 0xeeeeee },
    { id: 'house3', name: 'Penthouse Suite', x: 300, z: -150, w: 18, h: 12, d: 16, color: 0xccccdd },
    { id: 'house4', name: 'Mansion Estate', x: 340, z: -150, w: 24, h: 14, d: 20, color: 0xddccaa },
    { id: 'house5', name: 'City Flat', x: -300, z: -150, w: 12, h: 8, d: 10, color: 0xbbbbbb },
  ];

  const propStyle = { signBg: '#3a2a15', signFg: '#ffdd88' };

  properties.forEach(p => {
    const g = new THREE.Group();
    
    // House body
    const bodyMat = new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.7, metalness: 0.05 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), bodyMat);
    body.position.y = p.h / 2;
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);

    // Pitched roof
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x6b3a2a, roughness: 0.8 });
    const roofGeo = new THREE.ConeGeometry(Math.max(p.w, p.d) * 0.7, p.h * 0.4, 4);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = p.h + p.h * 0.2;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    g.add(roof);

    // Door
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(2, 3.5, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.5 })
    );
    door.position.set(0, 1.75, p.d / 2 + 0.08);
    g.add(door);

    // Windows
    const winMat = new THREE.MeshStandardMaterial({ color: 0x88bbdd, metalness: 0.5, roughness: 0.2 });
    [-1, 1].forEach(side => {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.5), winMat);
      win.position.set(side * (p.w / 3), p.h * 0.5, p.d / 2 + 0.06);
      g.add(win);
    });

    // Name sign
    const signC = document.createElement('canvas');
    signC.width = 256; signC.height = 48;
    const ctx = signC.getContext('2d')!;
    ctx.fillStyle = propStyle.signBg;
    ctx.fillRect(0, 0, 256, 48);
    ctx.fillStyle = propStyle.signFg;
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, 128, 32);
    const signTex = new THREE.CanvasTexture(signC);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(p.w * 0.6, 1.5), new THREE.MeshBasicMaterial({ map: signTex }));
    sign.position.set(0, 4, p.d / 2 + 0.1);
    g.add(sign);

    // Garden fence
    const fenceMat = mat('fence', { color: 0xffffff, roughness: 0.6 });
    for (let i = -p.w / 2 - 3; i <= p.w / 2 + 3; i += 1.5) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1, 0.08), fenceMat);
      post.position.set(i, 0.5, p.d / 2 + 4);
      g.add(post);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(p.w + 6, 0.06, 0.06), fenceMat);
    rail.position.set(0, 0.8, p.d / 2 + 4);
    g.add(rail);

    g.position.set(p.x, 0, p.z);
    scene.add(g);

    buildings.push({
      id: p.id,
      name: p.name,
      type: 'property',
      position: new THREE.Vector3(p.x, 0, p.z),
      size: new THREE.Vector3(p.w, p.h, p.d),
    });
  });
}

// ─── Vegetation ───
function createVegetation(scene: THREE.Scene) {
  const positions = [
    [-35, 35], [35, 35], [-35, -35], [35, -35],
    [-65, 85], [65, 85], [-65, -85], [65, -85],
    [-105, 5], [105, 5], [5, 105], [5, -105],
    [-30, 180], [30, 180], [-250, 0], [250, 0],
    [-150, 200], [150, 200], [-150, -200], [150, -200],
    [-280, 100], [280, -100], [-320, 170], [320, -170],
  ];
  positions.forEach(([x, z]) => createTree(scene, x, z));

  // Bushes
  const bushPositions = [
    [-20, 20], [20, -20], [-50, 90], [50, -90],
    [-100, 30], [100, -30], [-200, 50], [200, -50],
  ];
  bushPositions.forEach(([x, z]) => createBush(scene, x, z));
}

function createTree(scene: THREE.Scene, x: number, z: number) {
  const g = new THREE.Group();
  const trunkH = 2.0 + Math.random() * 2.0;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.22, trunkH, 8),
    mat('trunk', { color: 0x4a3528, roughness: 0.9 })
  );
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  g.add(trunk);

  // Fuller canopy
  const leafMat = mat('leaf', { color: 0x2d5a2d, roughness: 0.8 });
  const darkLeafMat = mat('dark-leaf', { color: 0x1e4a1e, roughness: 0.85 });
  for (let i = 0; i < 4; i++) {
    const s = (1.4 + Math.random() * 0.8) * (1 - i * 0.18);
    const useMat = Math.random() > 0.4 ? leafMat : darkLeafMat;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 10), useMat);
    leaf.position.set((Math.random() - 0.5) * 0.5, trunkH + i * 0.55 + 0.4, (Math.random() - 0.5) * 0.5);
    leaf.castShadow = true;
    g.add(leaf);
  }

  g.position.set(x, 0, z);
  scene.add(g);
}

function createBush(scene: THREE.Scene, x: number, z: number) {
  const g = new THREE.Group();
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x2a5a2a, roughness: 0.85 });
  for (let i = 0; i < 3; i++) {
    const s = 0.4 + Math.random() * 0.3;
    const b = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 8), bushMat);
    b.position.set((Math.random() - 0.5) * 0.6, s * 0.6, (Math.random() - 0.5) * 0.6);
    b.castShadow = true;
    g.add(b);
  }
  g.position.set(x, 0, z);
  scene.add(g);
}

// ─── Parked Cars - GTA-style muscle cars ───
function createParkedCars(scene: THREE.Scene) {
  const cars = [
    { x: -5, z: -30, rot: 0, color: 0x1a1a1a },
    { x: -5, z: -50, rot: 0, color: 0x1a3a8a },
    { x: 5, z: 30, rot: Math.PI, color: 0xdddddd },
    { x: 5, z: 50, rot: Math.PI, color: 0x3a5a2a },
    { x: 5, z: 70, rot: Math.PI, color: 0x8b0000 },
    { x: -5, z: -80, rot: 0, color: 0xcccccc },
    { x: -5, z: -110, rot: 0, color: 0x2a2a6a },
    { x: 5, z: 100, rot: Math.PI, color: 0xe8e8e8 },
    { x: 195, z: 5, rot: Math.PI / 2, color: 0x8b0000 },
    { x: -195, z: -5, rot: -Math.PI / 2, color: 0x1a1a1a },
    { x: 195, z: -20, rot: Math.PI / 2, color: 0x3a5a2a },
    { x: -195, z: 25, rot: -Math.PI / 2, color: 0x1a3a8a },
    { x: -40, z: -200, rot: Math.PI * 0.3, color: 0xdddddd },
    { x: 60, z: 180, rot: Math.PI * 1.2, color: 0x8b0000 },
    { x: -120, z: 50, rot: Math.PI * 0.7, color: 0x1a1a1a },
    { x: 150, z: -80, rot: Math.PI * 1.5, color: 0xcccccc },
  ];
  cars.forEach(cp => createMuscleCar(scene, cp.x, cp.z, cp.rot, cp.color));
}

function createMuscleCar(scene: THREE.Scene, x: number, z: number, rotation: number, color: number) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.2, metalness: 0.85 });

  // Lower body - sleek sports car shape
  const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 5.0), bodyMat);
  lowerBody.position.y = 0.45;
  lowerBody.castShadow = true;
  g.add(lowerBody);

  // Upper body - tapered
  const upperBody = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.35, 4.6), bodyMat);
  upperBody.position.y = 0.85;
  g.add(upperBody);

  // Hood scoop - aggressive
  const scoopMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.7 });
  const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.9), scoopMat);
  scoop.position.set(0, 1.1, 1.3);
  g.add(scoop);

  // Widebody fenders
  const fenderGeo = new THREE.BoxGeometry(0.18, 0.45, 1.1);
  [[-1.2, 1.3], [1.2, 1.3], [-1.2, -1.3], [1.2, -1.3]].forEach(([fx, fz]) => {
    const f = new THREE.Mesh(fenderGeo, bodyMat);
    f.position.set(fx, 0.45, fz);
    g.add(f);
  });

  // Cabin - tinted glass
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x1a1a22, transparent: true, opacity: 0.7, metalness: 0.4, roughness: 0.15 });
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 2.0), cabinMat);
  cabin.position.set(0, 1.2, -0.3);
  g.add(cabin);

  // A-pillar slopes
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
  [-1, 1].forEach(side => {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.3), pillarMat);
    pillar.position.set(side * 0.9, 1.2, 0.7);
    pillar.rotation.x = -0.3;
    g.add(pillar);
  });

  // Rear spoiler
  const spoilerMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.25, metalness: 0.75 });
  const spoilerWing = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.06, 0.35), spoilerMat);
  spoilerWing.position.set(0, 1.45, -2.2);
  g.add(spoilerWing);
  [-0.8, 0.8].forEach(sx => {
    const support = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.08), spoilerMat);
    support.position.set(sx, 1.25, -2.2);
    g.add(support);
  });

  // Side skirts
  [-1.15, 1.15].forEach(sx => {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 4.4), bodyMat);
    skirt.position.set(sx, 0.22, 0);
    g.add(skirt);
  });

  // Wheels - low profile with alloy rims
  const tireMat = mat('tire', { color: 0x1a1a1a, roughness: 0.85, metalness: 0.05 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xccbb44, roughness: 0.15, metalness: 0.95 });
  const wheelPositions: [number, number, number][] = [[-1.05, 0.35, 1.5], [1.05, 0.35, 1.5], [-1.05, 0.35, -1.5], [1.05, 0.35, -1.5]];
  wheelPositions.forEach(([wx, wy, wz]) => {
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 14), tireMat);
    tire.position.set(wx, wy, wz);
    tire.rotation.z = Math.PI / 2;
    g.add(tire);
    // Alloy rim with spokes
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.28, 8), rimMat);
    rim.position.set(wx, wy, wz);
    rim.rotation.z = Math.PI / 2;
    g.add(rim);
    // Brake disc
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 12), 
      mat('brake', { color: 0x666666, metalness: 0.8 }));
    disc.position.set(wx, wy, wz);
    disc.rotation.z = Math.PI / 2;
    g.add(disc);
  });

  // Headlights - LED style
  const hlMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffee, emissiveIntensity: 0.6 });
  [[-0.7, 0.55, 2.52], [0.7, 0.55, 2.52]].forEach(([hx, hy, hz]) => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.05), hlMat);
    hl.position.set(hx, hy, hz);
    g.add(hl);
  });

  // DRL strip
  const drlMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.3 });
  const drl = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.03, 0.03), drlMat);
  drl.position.set(0, 0.42, 2.52);
  g.add(drl);

  // Taillights - LED bar
  const tlMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.4 });
  const tailbar = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.04), tlMat);
  tailbar.position.set(0, 0.65, -2.52);
  g.add(tailbar);
  [[-0.8, 0.6, -2.52], [0.8, 0.6, -2.52]].forEach(([tx, ty, tz]) => {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.1, 0.04), tlMat);
    tl.position.set(tx, ty, tz);
    g.add(tl);
  });

  // Exhaust tips
  [-0.4, 0.4].forEach(ex => {
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.15, 8),
      new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.2 }));
    exhaust.position.set(ex, 0.22, -2.55);
    exhaust.rotation.x = Math.PI / 2;
    g.add(exhaust);
  });

  g.position.set(x, 0, z);
  g.rotation.y = rotation;
  scene.add(g);
}

// ─── Atmosphere ───
function createAtmosphere(scene: THREE.Scene) {
  const silhouetteMat = mat('skyline', { color: 0x2a3544, roughness: 1, metalness: 0 });
  const darkSilMat = mat('skyline-dark', { color: 0x1a2530, roughness: 1, metalness: 0 });

  for (let i = 0; i < 30; i++) {
    const angle = (i / 30) * Math.PI * 2 + (Math.random() - 0.5) * 0.12;
    const dist = 500 + Math.random() * 250;
    const h = 25 + Math.random() * 90;
    const w = 12 + Math.random() * 30;
    const useMat = Math.random() > 0.5 ? silhouetteMat : darkSilMat;
    const sil = new THREE.Mesh(new THREE.BoxGeometry(w, h, 8), useMat);
    sil.position.set(Math.sin(angle) * dist, h / 2, Math.cos(angle) * dist);
    sil.lookAt(0, h / 2, 0);
    scene.add(sil);

    // Some windows on distant buildings
    if (Math.random() > 0.5) {
      const winEmissive = new THREE.MeshStandardMaterial({ color: 0xffdd88, emissive: 0xffdd44, emissiveIntensity: 0.3 });
      for (let ww = 0; ww < 3; ww++) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2), winEmissive);
        win.position.set(
          Math.sin(angle) * (dist - 4.1) + (Math.random() - 0.5) * w * 0.5,
          10 + ww * 12,
          Math.cos(angle) * (dist - 4.1)
        );
        win.lookAt(0, 10 + ww * 12, 0);
        scene.add(win);
      }
    }
  }

  // Haze
  const hazeMat = new THREE.MeshBasicMaterial({
    color: 0x8bafc4, transparent: true, opacity: 0.25, side: THREE.DoubleSide,
  });
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(2000, 100), hazeMat);
  haze.position.set(0, 50, -800);
  scene.add(haze);
}
