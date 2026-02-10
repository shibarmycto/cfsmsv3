import * as THREE from 'three';
import { supabase } from '@/integrations/supabase/client';

export interface PlayerData {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotation: number;
  health: number;
  state: 'idle' | 'walking' | 'running' | 'attacking';
  equippedWeapon: string;
  lastUpdate: number;
}

export interface CombatEvent {
  attackerId: string;
  attackerName: string;
  targetId: string;
  damage: number;
  weaponType: string;
  isKill: boolean;
}

export class RealtimeMultiplayer {
  private playerId: string;
  private playerName: string;
  private scene: THREE.Scene;
  private channel: any = null;
  private presenceChannel: any = null;
  private remotePlayers: Map<string, PlayerData> = new Map();
  private playerMeshes: Map<string, THREE.Group> = new Map();
  private lastBroadcast = 0;
  private broadcastInterval = 50; // 20 updates per second
  private onCombatEvent: ((event: CombatEvent) => void) | null = null;
  private onPlayerCountChange: ((count: number) => void) | null = null;

  constructor(playerId: string, playerName: string, scene: THREE.Scene) {
    this.playerId = playerId;
    this.playerName = playerName;
    this.scene = scene;
  }

  async initialize(): Promise<void> {
    // Main broadcast channel for position sync
    this.channel = supabase.channel('cf-roleplay-multiplayer', {
      config: { broadcast: { self: false } }
    });

    this.channel.on('broadcast', { event: 'player-update' }, ({ payload }: { payload: PlayerData }) => {
      if (payload.id !== this.playerId) {
        this.handlePlayerUpdate(payload);
      }
    });

    this.channel.on('broadcast', { event: 'player-leave' }, ({ payload }: { payload: { id: string } }) => {
      this.removeRemotePlayer(payload.id);
      this.onPlayerCountChange?.(this.remotePlayers.size + 1);
    });

    this.channel.on('broadcast', { event: 'combat' }, ({ payload }: { payload: CombatEvent }) => {
      this.onCombatEvent?.(payload);
    });

    await this.channel.subscribe();

    // Presence channel — tracks who's actually online
    this.presenceChannel = supabase.channel('cf-roleplay-presence');
    
    this.presenceChannel.on('presence', { event: 'sync' }, () => {
      const state = this.presenceChannel.presenceState();
      const allKeys = Object.keys(state);
      this.onPlayerCountChange?.(allKeys.length);
      
      // Remove players who left presence but didn't send leave event
      const presentIds = new Set<string>();
      allKeys.forEach(key => {
        const presences = state[key] as any[];
        presences.forEach(p => presentIds.add(p.id));
      });
      
      this.remotePlayers.forEach((_, id) => {
        if (!presentIds.has(id)) {
          this.removeRemotePlayer(id);
        }
      });
    });

    this.presenceChannel.on('presence', { event: 'join' }, ({ newPresences }: any) => {
      console.log('Players joined:', newPresences.map((p: any) => p.name));
    });

    this.presenceChannel.on('presence', { event: 'leave' }, ({ leftPresences }: any) => {
      leftPresences.forEach((p: any) => {
        if (p.id !== this.playerId) {
          this.removeRemotePlayer(p.id);
        }
      });
    });

    await this.presenceChannel.subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        await this.presenceChannel.track({
          id: this.playerId,
          name: this.playerName,
          online_at: new Date().toISOString()
        });
      }
    });
  }

  setCombatEventHandler(handler: (event: CombatEvent) => void): void {
    this.onCombatEvent = handler;
  }

  setPlayerCountHandler(handler: (count: number) => void): void {
    this.onPlayerCountChange = handler;
  }

  broadcastPosition(position: THREE.Vector3, rotation: number, state: 'idle' | 'walking' | 'running' | 'attacking', health: number, weapon: string): void {
    const now = Date.now();
    if (now - this.lastBroadcast < this.broadcastInterval) return;
    this.lastBroadcast = now;

    if (!this.channel) return;

    this.channel.send({
      type: 'broadcast',
      event: 'player-update',
      payload: {
        id: this.playerId,
        name: this.playerName,
        position: { x: position.x, y: position.y, z: position.z },
        rotation,
        health,
        state,
        equippedWeapon: weapon,
        lastUpdate: now
      } as PlayerData
    });
  }

  broadcastCombat(targetId: string, damage: number, weaponType: string, isKill: boolean): void {
    if (!this.channel) return;

    this.channel.send({
      type: 'broadcast',
      event: 'combat',
      payload: {
        attackerId: this.playerId,
        attackerName: this.playerName,
        targetId,
        damage,
        weaponType,
        isKill
      } as CombatEvent
    });
  }

  private handlePlayerUpdate(data: PlayerData): void {
    const existing = this.remotePlayers.get(data.id);
    
    if (existing) {
      // Update existing player data
      Object.assign(existing, data);
    } else {
      // New player - create mesh
      this.remotePlayers.set(data.id, data);
      this.createPlayerMesh(data);
      this.onPlayerCountChange?.(this.remotePlayers.size + 1);
    }
  }

  private createPlayerMesh(player: PlayerData): void {
    const group = new THREE.Group();

    // Body - capsule shape
    const bodyGeometry = new THREE.CapsuleGeometry(0.4, 0.8, 8, 16);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: this.getRandomPlayerColor(player.id),
      roughness: 0.5,
      metalness: 0.1
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.8;
    body.castShadow = true;
    group.add(body);

    // Head
    const headGeometry = new THREE.SphereGeometry(0.25, 16, 16);
    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0xffdbac,
      roughness: 0.6
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.55;
    head.castShadow = true;
    group.add(head);

    // Arms
    const armGeometry = new THREE.CapsuleGeometry(0.1, 0.5, 4, 8);
    const armMaterial = bodyMaterial.clone();
    
    const leftArm = new THREE.Mesh(armGeometry, armMaterial);
    leftArm.position.set(-0.55, 0.95, 0);
    leftArm.rotation.z = 0.1;
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeometry, armMaterial);
    rightArm.position.set(0.55, 0.95, 0);
    rightArm.rotation.z = -0.1;
    group.add(rightArm);

    // Legs
    const legGeometry = new THREE.CapsuleGeometry(0.12, 0.5, 4, 8);
    const legMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      roughness: 0.7
    });

    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-0.2, 0.35, 0);
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(0.2, 0.35, 0);
    group.add(rightLeg);

    // Nameplate with health bar
    const nameSprite = this.createNameplate(player.name, player.health);
    nameSprite.position.set(0, 2.2, 0);
    group.add(nameSprite);

    // Store references for animation
    group.userData = {
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      nameSprite,
      animTime: 0
    };

    group.position.set(player.position.x, player.position.y, player.position.z);
    group.rotation.y = player.rotation;

    this.scene.add(group);
    this.playerMeshes.set(player.id, group);
  }

  private createNameplate(name: string, health: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 80;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.roundRect(8, 8, 240, 64, 8);
    ctx.fill();

    // Name
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(name.substring(0, 15), 128, 32);

    // Health bar background
    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.fillRect(24, 42, 208, 16);

    // Health bar fill
    const healthWidth = (health / 100) * 208;
    const gradient = ctx.createLinearGradient(24, 0, 232, 0);
    gradient.addColorStop(0, '#22c55e');
    gradient.addColorStop(0.5, '#84cc16');
    gradient.addColorStop(1, '#ef4444');
    ctx.fillStyle = health > 50 ? '#22c55e' : health > 25 ? '#eab308' : '#ef4444';
    ctx.fillRect(24, 42, healthWidth, 16);

    // Health text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px Arial';
    ctx.fillText(`${health}/100`, 128, 55);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(4, 1.25, 1);
    return sprite;
  }

  private getRandomPlayerColor(id: string): number {
    // Generate consistent color from player ID
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = hash % 360;
    return new THREE.Color(`hsl(${h}, 70%, 50%)`).getHex();
  }

  private updateNameplate(mesh: THREE.Group, health: number, name: string): void {
    const sprite = mesh.userData.nameSprite as THREE.Sprite;
    if (!sprite) return;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 80;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.roundRect(8, 8, 240, 64, 8);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(name.substring(0, 15), 128, 32);

    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.fillRect(24, 42, 208, 16);

    const healthWidth = (health / 100) * 208;
    ctx.fillStyle = health > 50 ? '#22c55e' : health > 25 ? '#eab308' : '#ef4444';
    ctx.fillRect(24, 42, healthWidth, 16);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px Arial';
    ctx.fillText(`${health}/100`, 128, 55);

    const texture = new THREE.CanvasTexture(canvas);
    (sprite.material as THREE.SpriteMaterial).map = texture;
    (sprite.material as THREE.SpriteMaterial).needsUpdate = true;
  }

  update(delta: number): void {
    const now = Date.now();

    this.remotePlayers.forEach((player, id) => {
      const mesh = this.playerMeshes.get(id);
      if (!mesh) return;

      // Remove inactive players (no update in 5 seconds)
      if (now - player.lastUpdate > 5000) {
        this.removeRemotePlayer(id);
        return;
      }

      // Smooth position interpolation
      const targetPos = new THREE.Vector3(player.position.x, player.position.y, player.position.z);
      mesh.position.lerp(targetPos, 0.15);

      // Smooth rotation interpolation
      let targetRot = player.rotation;
      let currentRot = mesh.rotation.y;
      let diff = targetRot - currentRot;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      mesh.rotation.y += diff * 0.15;

      // Animate character based on state
      this.animateRemotePlayer(mesh, player.state, delta);

      // Update nameplate if health changed
      const storedHealth = mesh.userData.lastHealth || 100;
      if (Math.abs(storedHealth - player.health) > 1) {
        this.updateNameplate(mesh, player.health, player.name);
        mesh.userData.lastHealth = player.health;
      }
    });
  }

  private animateRemotePlayer(mesh: THREE.Group, state: string, delta: number): void {
    const { leftArm, rightArm, leftLeg, rightLeg, animTime } = mesh.userData;
    if (!leftArm || !rightArm || !leftLeg || !rightLeg) return;

    mesh.userData.animTime = (animTime || 0) + delta;
    const t = mesh.userData.animTime;

    if (state === 'walking' || state === 'running') {
      const speed = state === 'running' ? 12 : 8;
      const amplitude = state === 'running' ? 0.8 : 0.5;

      leftArm.rotation.x = Math.sin(t * speed) * amplitude;
      rightArm.rotation.x = -Math.sin(t * speed) * amplitude;
      leftLeg.rotation.x = -Math.sin(t * speed) * amplitude * 0.8;
      rightLeg.rotation.x = Math.sin(t * speed) * amplitude * 0.8;
    } else if (state === 'attacking') {
      // Attack animation - punch forward
      rightArm.rotation.x = -Math.sin(t * 20) * 1.5;
    } else {
      // Idle - slight breathing motion
      leftArm.rotation.x = Math.sin(t * 2) * 0.05;
      rightArm.rotation.x = Math.sin(t * 2) * 0.05;
      leftLeg.rotation.x = 0;
      rightLeg.rotation.x = 0;
    }
  }

  removeRemotePlayer(id: string): void {
    const mesh = this.playerMeshes.get(id);
    if (mesh) {
      this.scene.remove(mesh);
      // Dispose geometries and materials
      mesh.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (obj.material instanceof THREE.Material) {
            obj.material.dispose();
          }
        }
      });
      this.playerMeshes.delete(id);
    }
    this.remotePlayers.delete(id);
  }

  getRemotePlayers(): PlayerData[] {
    return Array.from(this.remotePlayers.values());
  }

  getNearbyPlayers(position: THREE.Vector3, range: number): PlayerData[] {
    return this.getRemotePlayers().filter(player => {
      const dist = Math.sqrt(
        Math.pow(player.position.x - position.x, 2) +
        Math.pow(player.position.z - position.z, 2)
      );
      return dist <= range;
    });
  }

  dispose(): void {
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'player-leave',
        payload: { id: this.playerId }
      });
      supabase.removeChannel(this.channel);
    }

    if (this.presenceChannel) {
      this.presenceChannel.untrack();
      supabase.removeChannel(this.presenceChannel);
    }

    // Clean up all meshes
    this.playerMeshes.forEach((mesh, id) => {
      this.removeRemotePlayer(id);
    });
  }
}
