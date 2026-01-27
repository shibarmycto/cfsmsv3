import * as THREE from 'three';

export default class Game3DWorld {
  scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.generateTerrain();
    this.generateRoads();
    this.generateBuildings();
    this.generateStreetFurniture();
  }

  generateTerrain() {
    // Create ground plane with pavement texture
    const groundGeometry = new THREE.PlaneGeometry(2000, 2000, 50, 50);
    
    // Create pavement texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Base pavement gray
      ctx.fillStyle = '#4a4a4a';
      ctx.fillRect(0, 0, 512, 512);
      
      // Add texture variation for concrete slabs
      for (let x = 0; x < 8; x++) {
        for (let y = 0; y < 8; y++) {
          const shade = 70 + Math.random() * 20;
          ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
          ctx.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
        }
      }
      
      // Add cracks and details
      ctx.strokeStyle = '#3a3a3a';
      ctx.lineWidth = 1;
      for (let i = 0; i < 20; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * 512, Math.random() * 512);
        ctx.lineTo(Math.random() * 512, Math.random() * 512);
        ctx.stroke();
      }
    }
    
    const pavementTexture = new THREE.CanvasTexture(canvas);
    pavementTexture.repeat.set(20, 20);
    pavementTexture.wrapS = THREE.RepeatWrapping;
    pavementTexture.wrapT = THREE.RepeatWrapping;

    const groundMaterial = new THREE.MeshStandardMaterial({ 
      map: pavementTexture,
      roughness: 0.9,
      metalness: 0
    });
    
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Add grass areas on the sides
    this.createGrassAreas();
  }

  createGrassAreas() {
    const grassCanvas = document.createElement('canvas');
    grassCanvas.width = 256;
    grassCanvas.height = 256;
    const gCtx = grassCanvas.getContext('2d');
    if (gCtx) {
      gCtx.fillStyle = '#2d5a27';
      gCtx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 500; i++) {
        gCtx.fillStyle = Math.random() > 0.5 ? '#3d6a37' : '#2a5a2a';
        gCtx.fillRect(Math.random() * 256, Math.random() * 256, 4, 4);
      }
    }
    
    const grassTexture = new THREE.CanvasTexture(grassCanvas);
    grassTexture.repeat.set(10, 10);
    grassTexture.wrapS = THREE.RepeatWrapping;
    grassTexture.wrapT = THREE.RepeatWrapping;

    const grassMaterial = new THREE.MeshStandardMaterial({ 
      map: grassTexture,
      roughness: 0.95
    });

    // Left grass area
    const leftGrass = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 2000),
      grassMaterial
    );
    leftGrass.rotation.x = -Math.PI / 2;
    leftGrass.position.set(-850, 0.01, 0);
    leftGrass.receiveShadow = true;
    this.scene.add(leftGrass);

    // Right grass area
    const rightGrass = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 2000),
      grassMaterial.clone()
    );
    rightGrass.rotation.x = -Math.PI / 2;
    rightGrass.position.set(850, 0.01, 0);
    rightGrass.receiveShadow = true;
    this.scene.add(rightGrass);
  }

  generateRoads() {
    // Create UK-style road texture
    const roadCanvas = document.createElement('canvas');
    roadCanvas.width = 512;
    roadCanvas.height = 512;
    const ctx = roadCanvas.getContext('2d');
    
    if (ctx) {
      // Dark asphalt base
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0, 0, 512, 512);
      
      // Add asphalt texture variation
      for (let i = 0; i < 1000; i++) {
        const shade = 30 + Math.random() * 30;
        ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
      }
    }

    const roadTexture = new THREE.CanvasTexture(roadCanvas);
    roadTexture.repeat.set(4, 40);
    roadTexture.wrapS = THREE.RepeatWrapping;
    roadTexture.wrapT = THREE.RepeatWrapping;

    const roadMaterial = new THREE.MeshStandardMaterial({
      map: roadTexture,
      roughness: 0.7,
      metalness: 0.05
    });

    // Main road (vertical - UK A-road style)
    const mainRoadWidth = 120;
    const mainRoad = new THREE.Mesh(
      new THREE.PlaneGeometry(mainRoadWidth, 2000),
      roadMaterial
    );
    mainRoad.rotation.x = -Math.PI / 2;
    mainRoad.position.y = 0.02;
    mainRoad.receiveShadow = true;
    this.scene.add(mainRoad);

    // Add road markings
    this.addUKRoadMarkings(mainRoadWidth);

    // Cross street (horizontal)
    const crossRoad = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 80),
      roadMaterial.clone()
    );
    crossRoad.rotation.x = -Math.PI / 2;
    crossRoad.position.set(0, 0.02, 0);
    crossRoad.receiveShadow = true;
    this.scene.add(crossRoad);

    // Add curbs
    this.addCurbs();
  }

  addUKRoadMarkings(roadWidth: number) {
    const markingsGroup = new THREE.Group();

    // White center dashed line (UK style)
    const centerLineGeometry = new THREE.PlaneGeometry(0.5, 8);
    const whiteMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xffffff,
      roughness: 0.5
    });

    for (let z = -900; z < 900; z += 20) {
      const centerLine = new THREE.Mesh(centerLineGeometry, whiteMaterial);
      centerLine.rotation.x = -Math.PI / 2;
      centerLine.position.set(0, 0.03, z);
      markingsGroup.add(centerLine);
    }

    // Edge lines (solid white)
    const edgeLineGeometry = new THREE.PlaneGeometry(0.3, 2000);
    
    const leftEdge = new THREE.Mesh(edgeLineGeometry, whiteMaterial.clone());
    leftEdge.rotation.x = -Math.PI / 2;
    leftEdge.position.set(-roadWidth / 2 + 5, 0.03, 0);
    markingsGroup.add(leftEdge);

    const rightEdge = new THREE.Mesh(edgeLineGeometry, whiteMaterial.clone());
    rightEdge.rotation.x = -Math.PI / 2;
    rightEdge.position.set(roadWidth / 2 - 5, 0.03, 0);
    markingsGroup.add(rightEdge);

    // Double yellow lines (no parking - UK style)
    const yellowMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xffd700,
      roughness: 0.5
    });
    const yellowLineGeometry = new THREE.PlaneGeometry(0.2, 2000);

    const leftYellow1 = new THREE.Mesh(yellowLineGeometry, yellowMaterial);
    leftYellow1.rotation.x = -Math.PI / 2;
    leftYellow1.position.set(-roadWidth / 2 + 2, 0.031, 0);
    markingsGroup.add(leftYellow1);

    const leftYellow2 = new THREE.Mesh(yellowLineGeometry, yellowMaterial.clone());
    leftYellow2.rotation.x = -Math.PI / 2;
    leftYellow2.position.set(-roadWidth / 2 + 3, 0.031, 0);
    markingsGroup.add(leftYellow2);

    // Road text markings (A204 style)
    this.addRoadText(markingsGroup, 'A204', 0, -200);
    this.addRoadText(markingsGroup, 'SLOW', 0, 200);

    // Zebra crossing
    this.addZebraCrossing(markingsGroup, 0, 400);

    // Red route markings (double red lines - London style)
    const redMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xcc0000,
      roughness: 0.5
    });

    // Add red route section
    const redLineGeometry = new THREE.PlaneGeometry(0.3, 300);
    const redLine1 = new THREE.Mesh(redLineGeometry, redMaterial);
    redLine1.rotation.x = -Math.PI / 2;
    redLine1.position.set(roadWidth / 2 - 2, 0.031, -500);
    markingsGroup.add(redLine1);

    this.scene.add(markingsGroup);
  }

  addRoadText(group: THREE.Group, text: string, x: number, z: number) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'white';
      ctx.font = 'Bold 60px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 128, 64);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const textMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      roughness: 0.5
    });

    const textMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 10),
      textMaterial
    );
    textMesh.rotation.x = -Math.PI / 2;
    textMesh.position.set(x, 0.04, z);
    group.add(textMesh);
  }

  addZebraCrossing(group: THREE.Group, x: number, z: number) {
    const stripeWidth = 3;
    const stripeLength = 25;
    const numStripes = 12;
    
    const whiteMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xffffff,
      roughness: 0.5
    });

    for (let i = 0; i < numStripes; i++) {
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(stripeLength, stripeWidth),
        whiteMaterial
      );
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(x, 0.035, z + (i - numStripes / 2) * stripeWidth * 2);
      group.add(stripe);
    }

    // Belisha beacons (orange flashing globes on poles)
    this.addBelishaBeacon(group, x - 15, z);
    this.addBelishaBeacon(group, x + 15, z);
  }

  addBelishaBeacon(group: THREE.Group, x: number, z: number) {
    // Black and white striped pole
    const poleGeometry = new THREE.CylinderGeometry(0.3, 0.3, 8, 16);
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.set(x, 4, z);
    pole.castShadow = true;
    group.add(pole);

    // Orange globe
    const globeGeometry = new THREE.SphereGeometry(1, 16, 16);
    const globeMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xff8c00,
      emissive: 0xff6600,
      emissiveIntensity: 0.3
    });
    const globe = new THREE.Mesh(globeGeometry, globeMaterial);
    globe.position.set(x, 8.5, z);
    globe.castShadow = true;
    group.add(globe);
  }

  addCurbs() {
    const curbMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x888888,
      roughness: 0.8
    });
    const curbGeometry = new THREE.BoxGeometry(2, 0.3, 2000);

    // Main road curbs
    const leftCurb = new THREE.Mesh(curbGeometry, curbMaterial);
    leftCurb.position.set(-62, 0.15, 0);
    leftCurb.castShadow = true;
    this.scene.add(leftCurb);

    const rightCurb = new THREE.Mesh(curbGeometry, curbMaterial.clone());
    rightCurb.position.set(62, 0.15, 0);
    rightCurb.castShadow = true;
    this.scene.add(rightCurb);
  }

  generateBuildings() {
    const buildings = new THREE.Group();

    // UK-style high street buildings
    const buildingConfigs = [
      // Left side of road
      { x: -150, z: -400, w: 80, d: 60, h: 50, color: 0x8B4513, type: 'shop', name: 'Corner Shop' },
      { x: -150, z: -280, w: 60, d: 50, h: 40, color: 0x654321, type: 'shop', name: 'Newsagent' },
      { x: -150, z: -180, w: 70, d: 55, h: 45, color: 0x996633, type: 'restaurant', name: 'Nandos' },
      { x: -150, z: -80, w: 80, d: 60, h: 55, color: 0xcc0000, type: 'fast_food', name: 'KFC' },
      { x: -150, z: 50, w: 90, d: 70, h: 60, color: 0x4a4a4a, type: 'office', name: 'Offices' },
      { x: -150, z: 180, w: 75, d: 55, h: 50, color: 0x8B4513, type: 'shop', name: 'Tesco Express' },
      { x: -150, z: 300, w: 85, d: 65, h: 70, color: 0x3d3d3d, type: 'flats', name: 'Apartments' },
      
      // Right side of road  
      { x: 150, z: -350, w: 70, d: 55, h: 45, color: 0x654321, type: 'pub', name: 'The Crown' },
      { x: 150, z: -230, w: 80, d: 60, h: 50, color: 0x2e8b57, type: 'bank', name: 'Barclays' },
      { x: 150, z: -120, w: 65, d: 50, h: 40, color: 0x8B4513, type: 'shop', name: 'Pharmacy' },
      { x: 150, z: 0, w: 90, d: 70, h: 80, color: 0x4a4a4a, type: 'tower', name: 'Tower Block' },
      { x: 150, z: 150, w: 75, d: 55, h: 45, color: 0x654321, type: 'shop', name: 'Betting Shop' },
      { x: 150, z: 280, w: 80, d: 60, h: 55, color: 0x996633, type: 'restaurant', name: 'Chicken Shop' },
    ];

    buildingConfigs.forEach((config) => {
      const building = this.createUKBuilding(config);
      buildings.add(building);
    });

    this.scene.add(buildings);
  }

  createUKBuilding(config: { 
    x: number; z: number; w: number; d: number; h: number; 
    color: number; type: string; name: string 
  }) {
    const buildingGroup = new THREE.Group();

    // Main building structure (brick-like)
    const brickCanvas = document.createElement('canvas');
    brickCanvas.width = 128;
    brickCanvas.height = 128;
    const bCtx = brickCanvas.getContext('2d');
    if (bCtx) {
      bCtx.fillStyle = `#${config.color.toString(16).padStart(6, '0')}`;
      bCtx.fillRect(0, 0, 128, 128);
      // Add brick pattern
      bCtx.strokeStyle = 'rgba(0,0,0,0.2)';
      bCtx.lineWidth = 1;
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 8; x++) {
          const offsetX = y % 2 === 0 ? 0 : 8;
          bCtx.strokeRect((x * 16) + offsetX, y * 8, 16, 8);
        }
      }
    }

    const brickTexture = new THREE.CanvasTexture(brickCanvas);
    brickTexture.repeat.set(config.w / 20, config.h / 10);
    brickTexture.wrapS = THREE.RepeatWrapping;
    brickTexture.wrapT = THREE.RepeatWrapping;

    const buildingMaterial = new THREE.MeshStandardMaterial({
      map: brickTexture,
      roughness: 0.8,
      metalness: 0.1
    });

    const buildingGeometry = new THREE.BoxGeometry(config.w, config.h, config.d);
    const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
    building.position.y = config.h / 2;
    building.castShadow = true;
    building.receiveShadow = true;
    buildingGroup.add(building);

    // Add windows
    this.addModernWindows(buildingGroup, config);

    // Add shop front if applicable
    if (['shop', 'restaurant', 'fast_food', 'pub', 'bank'].includes(config.type)) {
      this.addShopFront(buildingGroup, config);
    }

    // Add signage
    this.addBuildingSign(buildingGroup, config);

    buildingGroup.position.set(config.x, 0, config.z);
    return buildingGroup;
  }

  addModernWindows(group: THREE.Group, config: { w: number; h: number; d: number }) {
    const windowMaterial = new THREE.MeshStandardMaterial({
      color: 0x87ceeb,
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.7
    });

    const windowWidth = 8;
    const windowHeight = 12;
    const spacing = 15;
    
    const startY = 20;
    const endY = config.h - 10;

    // Front and back windows
    for (let y = startY; y < endY; y += spacing) {
      for (let x = -config.w / 3; x <= config.w / 3; x += spacing) {
        // Front
        const frontWindow = new THREE.Mesh(
          new THREE.PlaneGeometry(windowWidth, windowHeight),
          windowMaterial
        );
        frontWindow.position.set(x, y, config.d / 2 + 0.1);
        group.add(frontWindow);

        // Back
        const backWindow = new THREE.Mesh(
          new THREE.PlaneGeometry(windowWidth, windowHeight),
          windowMaterial.clone()
        );
        backWindow.position.set(x, y, -config.d / 2 - 0.1);
        backWindow.rotation.y = Math.PI;
        group.add(backWindow);
      }
    }
  }

  addShopFront(group: THREE.Group, config: { w: number; d: number; color: number }) {
    // Large glass storefront
    const shopFrontMaterial = new THREE.MeshStandardMaterial({
      color: 0xaaddff,
      metalness: 0.8,
      roughness: 0.1,
      transparent: true,
      opacity: 0.6
    });

    const shopFront = new THREE.Mesh(
      new THREE.PlaneGeometry(config.w * 0.8, 15),
      shopFrontMaterial
    );
    shopFront.position.set(0, 10, config.d / 2 + 0.2);
    group.add(shopFront);

    // Door
    const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a4a });
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(8, 15, 1),
      doorMaterial
    );
    door.position.set(0, 7.5, config.d / 2 + 0.5);
    group.add(door);
  }

  addBuildingSign(group: THREE.Group, config: { w: number; d: number; h: number; name: string; color: number }) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = config.color === 0xcc0000 ? '#cc0000' : '#1a1a1a';
      ctx.fillRect(0, 0, 256, 64);
      ctx.fillStyle = 'white';
      ctx.font = 'Bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(config.name, 128, 32);
    }

    const signTexture = new THREE.CanvasTexture(canvas);
    const signMaterial = new THREE.MeshStandardMaterial({
      map: signTexture,
      roughness: 0.5
    });

    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(config.w * 0.7, 5, 1),
      signMaterial
    );
    sign.position.set(0, 22, config.d / 2 + 1);
    group.add(sign);
  }

  generateStreetFurniture() {
    // Street lights (UK style)
    for (let z = -800; z <= 800; z += 100) {
      this.addStreetLight(-70, z);
      this.addStreetLight(70, z);
    }

    // Bus stop
    this.addBusStop(-75, 100);

    // Phone box (red UK style)
    this.addPhoneBox(75, -100);

    // Bins
    this.addBin(-68, 50);
    this.addBin(68, 200);

    // Post box
    this.addPostBox(-68, -200);
  }

  addStreetLight(x: number, z: number) {
    const poleGeometry = new THREE.CylinderGeometry(0.3, 0.4, 12, 8);
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x2c2c2c });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.set(x, 6, z);
    pole.castShadow = true;
    this.scene.add(pole);

    // Arm
    const armGeometry = new THREE.CylinderGeometry(0.15, 0.15, 4, 8);
    const arm = new THREE.Mesh(armGeometry, poleMaterial);
    arm.position.set(x + (x > 0 ? -1.5 : 1.5), 11, z);
    arm.rotation.z = Math.PI / 2;
    this.scene.add(arm);

    // Light fixture
    const lightGeometry = new THREE.BoxGeometry(1.5, 0.5, 0.8);
    const lightMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xffffcc,
      emissive: 0xffff99,
      emissiveIntensity: 0.3
    });
    const light = new THREE.Mesh(lightGeometry, lightMaterial);
    light.position.set(x + (x > 0 ? -3 : 3), 11, z);
    this.scene.add(light);
  }

  addBusStop(x: number, z: number) {
    // Shelter frame
    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    
    // Posts
    const postGeometry = new THREE.CylinderGeometry(0.15, 0.15, 8, 8);
    const post1 = new THREE.Mesh(postGeometry, frameMaterial);
    post1.position.set(x, 4, z - 3);
    this.scene.add(post1);
    
    const post2 = new THREE.Mesh(postGeometry, frameMaterial);
    post2.position.set(x, 4, z + 3);
    this.scene.add(post2);

    // Roof
    const roofGeometry = new THREE.BoxGeometry(3, 0.3, 8);
    const roof = new THREE.Mesh(roofGeometry, frameMaterial);
    roof.position.set(x, 8, z);
    this.scene.add(roof);

    // Glass panel
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0xaaddff,
      transparent: true,
      opacity: 0.5
    });
    const glassPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.1, 7, 6),
      glassMaterial
    );
    glassPanel.position.set(x - 1.4, 4.5, z);
    this.scene.add(glassPanel);
  }

  addPhoneBox(x: number, z: number) {
    // Classic red phone box
    const boxGeometry = new THREE.BoxGeometry(3, 8, 3);
    const boxMaterial = new THREE.MeshStandardMaterial({ color: 0xcc0000 });
    const phoneBox = new THREE.Mesh(boxGeometry, boxMaterial);
    phoneBox.position.set(x, 4, z);
    phoneBox.castShadow = true;
    this.scene.add(phoneBox);

    // Windows
    const windowMaterial = new THREE.MeshStandardMaterial({
      color: 0xaaddff,
      transparent: true,
      opacity: 0.6
    });
    
    for (let i = 0; i < 4; i++) {
      const windowMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.8, 2),
        windowMaterial
      );
      windowMesh.position.set(x + 1.51, 5, z - 0.8 + i * 0.6);
      this.scene.add(windowMesh);
    }
  }

  addBin(x: number, z: number) {
    const binGeometry = new THREE.CylinderGeometry(0.5, 0.4, 1.5, 12);
    const binMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    const bin = new THREE.Mesh(binGeometry, binMaterial);
    bin.position.set(x, 0.75, z);
    bin.castShadow = true;
    this.scene.add(bin);
  }

  addPostBox(x: number, z: number) {
    // Classic red UK post box
    const boxGeometry = new THREE.CylinderGeometry(0.6, 0.6, 3, 12);
    const boxMaterial = new THREE.MeshStandardMaterial({ color: 0xcc0000 });
    const postBox = new THREE.Mesh(boxGeometry, boxMaterial);
    postBox.position.set(x, 1.5, z);
    postBox.castShadow = true;
    this.scene.add(postBox);

    // Top dome
    const domeGeometry = new THREE.SphereGeometry(0.6, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const dome = new THREE.Mesh(domeGeometry, boxMaterial);
    dome.position.set(x, 3, z);
    this.scene.add(dome);
  }
}
