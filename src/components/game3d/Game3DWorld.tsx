import * as THREE from 'three';

export default class Game3DWorld {
  scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.generateTerrain();
    this.generateBuildings();
    this.generateRoads();
  }

  generateTerrain() {
    // Create ground plane
    const groundGeometry = new THREE.PlaneGeometry(2000, 2000);
    
    // Create canvas texture for grass
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Grass pattern
      ctx.fillStyle = '#2d5a27';
      ctx.fillRect(0, 0, 512, 512);
      
      // Add some grass texture variation
      for (let i = 0; i < 1000; i++) {
        ctx.fillStyle = Math.random() > 0.7 ? '#3d6a37' : '#2d5a27';
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 10, 10);
      }
    }
    
    const grassTexture = new THREE.CanvasTexture(canvas);
    grassTexture.repeat.set(4, 4);
    grassTexture.wrapS = THREE.RepeatWrapping;
    grassTexture.wrapT = THREE.RepeatWrapping;

    const groundMaterial = new THREE.MeshStandardMaterial({ 
      map: grassTexture,
      roughness: 0.8,
      metalness: 0
    });
    
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Add height variation using displacement (optional)
    const hills = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const hillGeometry = new THREE.SphereGeometry(80, 32, 32);
      const hillMaterial = new THREE.MeshStandardMaterial({
        color: 0x2d5a27,
        roughness: 0.9
      });
      const hill = new THREE.Mesh(hillGeometry, hillMaterial);
      hill.position.set(
        (Math.random() - 0.5) * 1000,
        40,
        (Math.random() - 0.5) * 1000
      );
      hill.castShadow = true;
      hill.receiveShadow = true;
      hills.add(hill);
    }
    this.scene.add(hills);
  }

  generateBuildings() {
    const buildings = new THREE.Group();

    // Create a few buildings scattered around
    const buildingPositions = [
      { x: -200, z: -200, width: 60, depth: 80, height: 100, color: 0xaa6644 },
      { x: 200, z: -200, width: 100, depth: 60, height: 80, color: 0x8B4513 },
      { x: -200, z: 200, width: 80, depth: 80, height: 120, color: 0x996633 },
      { x: 200, z: 200, width: 70, depth: 90, height: 90, color: 0xbb7744 },
      { x: 0, z: 0, width: 150, depth: 100, height: 60, color: 0x996633 },
    ];

    buildingPositions.forEach((pos) => {
      const buildingGroup = new THREE.Group();

      // Main building body
      const buildingGeometry = new THREE.BoxGeometry(pos.width, pos.height, pos.depth);
      const buildingMaterial = new THREE.MeshStandardMaterial({
        color: pos.color,
        roughness: 0.7,
        metalness: 0.1
      });
      const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
      building.position.y = pos.height / 2;
      building.castShadow = true;
      building.receiveShadow = true;
      buildingGroup.add(building);

      // Add windows
      this.addWindowsToBuilding(building, pos.width, pos.height, pos.depth);

      // Roof
      const roofGeometry = new THREE.ConeGeometry(Math.max(pos.width, pos.depth) / 1.5, 30, 4);
      const roofMaterial = new THREE.MeshStandardMaterial({
        color: 0x8B4513,
        roughness: 0.8
      });
      const roof = new THREE.Mesh(roofGeometry, roofMaterial);
      roof.position.y = pos.height + 15;
      roof.castShadow = true;
      roof.receiveShadow = true;
      buildingGroup.add(roof);

      buildingGroup.position.set(pos.x, 0, pos.z);
      buildings.add(buildingGroup);
    });

    this.scene.add(buildings);
  }

  addWindowsToBuilding(building: THREE.Mesh, width: number, height: number, depth: number) {
    const windowSize = 6;
    const windowSpacing = 20;
    const windowMaterial = new THREE.MeshStandardMaterial({
      color: 0x87ceeb,
      metalness: 0.8,
      roughness: 0.2
    });

    // Front windows
    for (let x = -width / 3; x < width / 3; x += windowSpacing) {
      for (let y = 10; y < height - 10; y += windowSpacing) {
        const windowGeometry = new THREE.PlaneGeometry(windowSize, windowSize);
        const windowMesh = new THREE.Mesh(windowGeometry, windowMaterial);
        windowMesh.position.set(x, y, depth / 2 + 0.1);
        building.add(windowMesh);
      }
    }
  }

  generateRoads() {
    const roads = new THREE.Group();

    // Horizontal road
    const roadHGeometry = new THREE.PlaneGeometry(2000, 60);
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a3a3a,
      roughness: 0.6
    });
    const roadH = new THREE.Mesh(roadHGeometry, roadMaterial);
    roadH.rotation.x = -Math.PI / 2;
    roadH.position.y = 0.01;
    roadH.receiveShadow = true;
    roads.add(roadH);

    // Vertical road
    const roadVGeometry = new THREE.PlaneGeometry(60, 2000);
    const roadV = new THREE.Mesh(roadVGeometry, roadMaterial);
    roadV.rotation.x = -Math.PI / 2;
    roadV.position.y = 0.01;
    roadV.receiveShadow = true;
    roads.add(roadV);

    // Add lane markings (using line material)
    const lineGeometry = new THREE.BufferGeometry();
    const points = [];
    
    // Horizontal line markings
    for (let x = -1000; x < 1000; x += 40) {
      points.push(new THREE.Vector3(x, 0.02, 0));
      points.push(new THREE.Vector3(x + 20, 0.02, 0));
    }

    lineGeometry.setFromPoints(points);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffff00 });
    const roadLines = new THREE.LineSegments(lineGeometry, lineMaterial);
    roads.add(roadLines);

    this.scene.add(roads);
  }
}
