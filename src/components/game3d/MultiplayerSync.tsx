import * as THREE from 'three';
import { supabase } from '@/integrations/supabase/client';

export interface RemotePlayer {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotation: number;
  health: number;
  state: 'idle' | 'walking' | 'running';
  lastUpdate: number;
}

export class MultiplayerSync {
  private playerId: string;
  private localScene: THREE.Scene;
  private remotePlayers: Map<string, RemotePlayer> = new Map();
  private playerMeshes: Map<string, THREE.Group> = new Map();
  private subscription: any = null;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(playerId: string, scene: THREE.Scene) {
    this.playerId = playerId;
    this.localScene = scene;
  }

  async initialize(): Promise<void> {
    // Subscribe to realtime updates
    this.subscription = supabase
      .channel(`game:players`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_characters',
          filter: `id=neq.${this.playerId}`,
        },
        (payload) => {
          this.handlePlayerUpdate(payload);
        }
      )
      .subscribe();
  }

  async publishPosition(position: { x: number; y: number; z: number }, rotation: number, characterName: string): Promise<void> {
    try {
      // In production, this would update a player_positions table
      // For now, we'll simulate with periodic updates
      const now = Date.now();
      const cacheKey = `player_pos_${this.playerId}`;
      const lastUpdate = parseInt(localStorage.getItem(cacheKey) || '0');

      // Only update if 100ms has passed (reduce network calls)
      if (now - lastUpdate > 100) {
        localStorage.setItem(cacheKey, now.toString());
        // TODO: Send to Supabase realtime
      }
    } catch (error) {
      console.error('Failed to publish position:', error);
    }
  }

  private handlePlayerUpdate(payload: any): void {
    const characterId = payload.new?.id;
    if (!characterId || characterId === this.playerId) return;

    const playerData = {
      id: characterId,
      name: payload.new?.name || 'Unknown',
      position: {
        x: payload.new?.position_x || 0,
        y: 0,
        z: payload.new?.position_y || 0,
      },
      rotation: 0,
      health: payload.new?.health || 100,
      state: 'idle' as const,
      lastUpdate: Date.now(),
    };

    this.updateRemotePlayer(playerData);
  }

  updateRemotePlayer(playerData: RemotePlayer): void {
    if (this.remotePlayers.has(playerData.id)) {
      // Update existing player
      const existing = this.remotePlayers.get(playerData.id)!;
      existing.position = playerData.position;
      existing.rotation = playerData.rotation;
      existing.health = playerData.health;
      existing.state = playerData.state;
    } else {
      // Create new remote player
      this.remotePlayers.set(playerData.id, playerData);
      this.createRemotePlayerMesh(playerData);
    }
  }

  private createRemotePlayerMesh(player: RemotePlayer): void {
    const group = new THREE.Group();

    // Body
    const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.45, 1.2, 16);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a5f2f, // Green tint to distinguish from player
      roughness: 0.6,
      metalness: 0,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.7;
    body.castShadow = true;
    group.add(body);

    // Head
    const headGeometry = new THREE.SphereGeometry(0.35, 32, 32);
    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0xb89968,
      roughness: 0.5,
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.95;
    head.castShadow = true;
    group.add(head);

    // Name label
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#00FF00';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(player.name, 128, 40);
    ctx.fillStyle = `hsl(${(player.health / 100) * 120}, 100%, 50%)`;
    ctx.fillRect(10, 50, (player.health / 100) * 236, 8);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(0, 2.5, 0);
    sprite.scale.set(50, 15, 1);
    group.add(sprite);

    group.position.set(player.position.x, player.position.y, player.position.z);
    group.rotation.y = player.rotation;

    this.localScene.add(group);
    this.playerMeshes.set(player.id, group);
  }

  updateRemotePlayerMesh(playerId: string): void {
    const player = this.remotePlayers.get(playerId);
    const mesh = this.playerMeshes.get(playerId);

    if (!player || !mesh) return;

    // Smooth interpolation
    const targetPos = new THREE.Vector3(player.position.x, player.position.y, player.position.z);
    mesh.position.lerp(targetPos, 0.1);
    mesh.rotation.y = player.rotation;
  }

  removeRemotePlayer(playerId: string): void {
    const mesh = this.playerMeshes.get(playerId);
    if (mesh) {
      this.localScene.remove(mesh);
      this.playerMeshes.delete(playerId);
    }
    this.remotePlayers.delete(playerId);
  }

  getRemotePlayers(): RemotePlayer[] {
    return Array.from(this.remotePlayers.values());
  }

  getRemotePlayerById(id: string): RemotePlayer | undefined {
    return this.remotePlayers.get(id);
  }

  update(): void {
    // Update all remote player meshes
    this.playerMeshes.forEach((mesh, playerId) => {
      this.updateRemotePlayerMesh(playerId);
    });

    // Remove inactive players (not updated in 30 seconds)
    const now = Date.now();
    const toRemove: string[] = [];

    this.remotePlayers.forEach((player, id) => {
      if (now - player.lastUpdate > 30000) {
        toRemove.push(id);
      }
    });

    toRemove.forEach((id) => this.removeRemotePlayer(id));
  }

  dispose(): void {
    if (this.subscription) {
      supabase.removeChannel(this.subscription);
    }
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    // Remove all remote player meshes
    this.playerMeshes.forEach((mesh) => {
      this.localScene.remove(mesh);
    });
    this.playerMeshes.clear();
    this.remotePlayers.clear();
  }
}
