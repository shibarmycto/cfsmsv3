import * as THREE from 'three';

export interface Building {
  id: string;
  position: { x: number; z: number };
  type: 'apartment' | 'shop' | 'bank' | 'job_center' | 'hospital' | 'police';
  width: number;
  depth: number;
  height: number;
  color: number;
  name: string;
  isInteractable: boolean;
}

export class LondonWorld {
  scene: THREE.Scene;
  buildings: Building[] = [];
  roads: THREE.Mesh[] = [];
  terrain: THREE.Mesh | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.generateTerrain();
    this.generateRoads();
    this.generateBuildings();
  }

  private generateTerrain() {
    // Large terrain plane for London city
    const terrainGeometry = new THREE.PlaneGeometry(3000, 3000, 100, 100);
    const terrainTexture = this.createLondonGrassTexture();
    const terrainMaterial = new THREE.MeshStandardMaterial({
      map: terrainTexture,
      roughness: 0.8,
      metalness: 0,
    });

    this.terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
    this.terrain.rotation.x = -Math.PI / 2;
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);

    // Add parks/green areas
    this.addParkAreas();
  }

  private addParkAreas() {
    const parkPositions = [
      { x: -600, z: -600, size: 250 },
      { x: 600, z: 600, size: 200 },
    ];

    parkPositions.forEach((park) => {
      const parkGeometry = new THREE.CircleGeometry(park.size, 32);
      const parkMaterial = new THREE.MeshStandardMaterial({
        color: 0x2d5016,
        roughness: 0.7,
      });
      const parkMesh = new THREE.Mesh(parkGeometry, parkMaterial);
      parkMesh.position.set(park.x, 0.01, park.z);
      parkMesh.rotation.x = -Math.PI / 2;
      parkMesh.receiveShadow = true;
      this.scene.add(parkMesh);
    });
  }

  private generateRoads() {
    const roadWidth = 40;
    const roadColor = 0x2a2a2a;

    // Main north-south roads
    for (let x = -1200; x <= 1200; x += 300) {
      const road = this.createRoad(
        roadWidth,
        3000,
        roadColor,
        x,
        0,
        0
      );
      this.roads.push(road);
      this.scene.add(road);
    }

    // Main east-west roads
    for (let z = -1200; z <= 1200; z += 300) {
      const road = this.createRoad(
        3000,
        roadWidth,
        roadColor,
        0,
        0,
        z
      );
      this.roads.push(road);
      this.scene.add(road);
    }

    // Add road markings
    this.addRoadMarkings();
  }

  private createRoad(width: number, depth: number, color: number, x: number, y: number, z: number): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(width, depth);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.6,
      metalness: 0.1,
    });
    const road = new THREE.Mesh(geometry, material);
    road.position.set(x, y, z);
    road.rotation.x = -Math.PI / 2;
    road.receiveShadow = true;
    return road;
  }

  private addRoadMarkings() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Yellow center line
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 8;
    ctx.setLineDash([40, 40]);
    ctx.beginPath();
    ctx.moveTo(256, 0);
    ctx.lineTo(256, 512);
    ctx.stroke();

    const lineTexture = new THREE.CanvasTexture(canvas);
    lineTexture.repeat.set(1, 4);
    lineTexture.wrapT = THREE.RepeatWrapping;
  }

  private generateBuildings() {
    const buildingConfigs = [
      // Downtown area
      { pos: { x: -400, z: -400 }, type: 'apartment' as const, width: 100, depth: 120, height: 200, name: 'Downtown Apartments', color: 0x8B4513 },
      { pos: { x: -200, z: -400 }, type: 'shop' as const, width: 80, depth: 100, height: 120, name: 'Downtown Shop', color: 0x654321, isInteractable: true },
      { pos: { x: 0, z: -400 }, type: 'bank' as const, width: 120, depth: 140, height: 180, name: 'London Bank', color: 0x1a1a1a, isInteractable: true },
      { pos: { x: 200, z: -400 }, type: 'job_center' as const, width: 100, depth: 100, height: 150, name: 'Job Center', color: 0x404040, isInteractable: true },

      // Central area
      { pos: { x: -600, z: 0 }, type: 'hospital' as const, width: 150, depth: 150, height: 200, name: 'St. Mary Hospital', color: 0xFFFFFF, isInteractable: true },
      { pos: { x: 600, z: 0 }, type: 'police' as const, width: 140, depth: 120, height: 180, name: 'Police Station', color: 0x003366, isInteractable: true },
      { pos: { x: -400, z: 200 }, type: 'shop' as const, width: 90, depth: 110, height: 130, name: 'Market Street Shop', color: 0x704214, isInteractable: true },
      { pos: { x: 400, z: 200 }, type: 'apartment' as const, width: 110, depth: 130, height: 190, name: 'City Towers', color: 0x7F6B5D },

      // North area
      { pos: { x: -500, z: -800 }, type: 'apartment' as const, width: 100, depth: 100, height: 180, name: 'North District', color: 0x8B4513 },
      { pos: { x: 500, z: -800 }, type: 'shop' as const, width: 85, depth: 95, height: 140, name: 'North Mall', color: 0x696969, isInteractable: true },

      // South area
      { pos: { x: -500, z: 800 }, type: 'job_center' as const, width: 100, depth: 100, height: 160, name: 'Industrial Zone', color: 0x505050, isInteractable: true },
      { pos: { x: 500, z: 800 }, type: 'apartment' as const, width: 120, depth: 100, height: 200, name: 'South Residential', color: 0x996633 },
    ];

    buildingConfigs.forEach((config, index) => {
      const building: Building = {
        id: `building_${index}`,
        position: config.pos,
        type: config.type,
        width: config.width,
        depth: config.depth,
        height: config.height,
        color: config.color,
        name: config.name,
        isInteractable: config.isInteractable || false,
      };

      this.buildings.push(building);
      this.createBuildingMesh(building);
    });
  }

  private createBuildingMesh(building: Building) {
    // Main building body
    const bodyGeometry = new THREE.BoxGeometry(building.width, building.height, building.depth);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: building.color,
      roughness: 0.7,
      metalness: 0.1,
    });

    const buildingMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    buildingMesh.position.set(building.position.x, building.height / 2, building.position.z);
    buildingMesh.castShadow = true;
    buildingMesh.receiveShadow = true;
    buildingMesh.userData = { buildingId: building.id, type: building.type };

    this.scene.add(buildingMesh);

    // Add windows
    this.addWindows(building, building.position.x, building.height, building.position.z);

    // Add doors
    this.addDoors(building, building.position.x, building.position.z);

    // Add roof
    this.addRoof(building, building.position.x, building.height, building.position.z);

    // Add name label
    if (building.isInteractable) {
      this.addBuildingLabel(building);
    }
  }

  private addWindows(building: Building, x: number, height: number, z: number) {
    const windowWidth = 8;
    const windowHeight = 10;
    const spacing = 20;
    const windowColor = 0x1a1a2e;

    const windowGeometry = new THREE.PlaneGeometry(windowWidth, windowHeight);
    const windowMaterial = new THREE.MeshStandardMaterial({
      color: windowColor,
      metalness: 0.3,
      roughness: 0.2,
    });

    // Front face windows
    for (let winX = -building.width / 3; winX < building.width / 3; winX += spacing) {
      for (let winY = 20; winY < height - 20; winY += spacing) {
        const windowMesh = new THREE.Mesh(windowGeometry, windowMaterial);
        windowMesh.position.set(x + winX, winY, z + building.depth / 2 + 1);
        this.scene.add(windowMesh);
      }
    }

    // Back face windows
    for (let winX = -building.width / 3; winX < building.width / 3; winX += spacing) {
      for (let winY = 20; winY < height - 20; winY += spacing) {
        const windowMesh = new THREE.Mesh(windowGeometry, windowMaterial.clone());
        windowMesh.position.set(x + winX, winY, z - building.depth / 2 - 1);
        this.scene.add(windowMesh);
      }
    }
  }

  private addDoors(building: Building, x: number, z: number) {
    const doorWidth = 5;
    const doorHeight = 12;
    const doorGeometry = new THREE.PlaneGeometry(doorWidth, doorHeight);
    const doorMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B4513,
      roughness: 0.6,
    });

    // Main entrance door
    const doorMesh = new THREE.Mesh(doorGeometry, doorMaterial);
    doorMesh.position.set(x, doorHeight / 2, z + building.depth / 2 + 1);
    this.scene.add(doorMesh);
  }

  private addRoof(building: Building, x: number, height: number, z: number) {
    const roofGeometry = new THREE.BoxGeometry(building.width, 5, building.depth);
    const roofMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.8,
    });

    const roofMesh = new THREE.Mesh(roofGeometry, roofMaterial);
    roofMesh.position.set(x, height + 2.5, z);
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    this.scene.add(roofMesh);
  }

  private addBuildingLabel(building: Building) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, 256, 64);

    // Text
    ctx.fillStyle = '#00FF00';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(building.name, 128, 40);

    if (building.isInteractable) {
      ctx.fillStyle = '#FFFF00';
      ctx.font = '14px Arial';
      ctx.fillText('[E] to interact', 128, 58);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(building.position.x, building.height + 30, building.position.z);
    sprite.scale.set(60, 20, 1);
    this.scene.add(sprite);
  }

  private createLondonGrassTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Base grass color
    ctx.fillStyle = '#3a5f2f';
    ctx.fillRect(0, 0, 512, 512);

    // Add noise for texture
    for (let i = 0; i < 5000; i++) {
      const shade = Math.random() * 50 - 25;
      ctx.fillStyle = `rgb(${58 + shade}, ${95 + shade}, ${47 + shade})`;
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }

    return new THREE.CanvasTexture(canvas);
  }

  getNearestBuilding(playerPos: THREE.Vector3, maxDistance: number = 150): Building | null {
    let nearest: Building | null = null;
    let minDistance = maxDistance;

    this.buildings.forEach((building) => {
      const distance = Math.hypot(
        playerPos.x - building.position.x,
        playerPos.z - building.position.z
      );

      if (distance < minDistance && building.isInteractable) {
        minDistance = distance;
        nearest = building;
      }
    });

    return nearest;
  }

  getCollisionBoxes(): THREE.Box3[] {
    return this.buildings.map((building) => {
      const box = new THREE.Box3();
      box.setFromCenterAndSize(
        new THREE.Vector3(building.position.x, building.height / 2, building.position.z),
        new THREE.Vector3(building.width, building.height, building.depth)
      );
      return box;
    });
  }
}
