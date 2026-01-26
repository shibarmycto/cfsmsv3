import * as THREE from 'three';
import { supabase } from '@/integrations/supabase/client';

export interface RemotePlayer {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotation: number;
  health: number;
  model: THREE.Group;
  lastUpdated: number;
}

export class MultiplayerSystem {
  private playerId: string;
  private playerName: string;
  private scene: THREE.Scene;
  private remotePlayers: Map<string, RemotePlayer> = new Map();
  private updateInterval: number | null = null;
  private subscriptionRef: any = null;

  constructor(scene: THREE.Scene, playerId: string, playerName: string) {
    this.scene = scene;
    this.playerId = playerId;
    this.playerName = playerName;
  }

  async initialize() {
    // Subscribe to real-time updates
    this.subscriptionRef = supabase
      .channel(`players:${this.playerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_characters',
          filter: `is_online=eq.true`,
        },
        (payload) => {
          if (payload.new && payload.new.id !== this.playerId) {
            this.updateRemotePlayer(payload.new);
          }
        }
      )
      .subscribe();

    // Load existing online players
    await this.loadOnlinePlayers();

    // Start position update loop
    this.startUpdateLoop();
  }

  private async loadOnlinePlayers() {
    try {
      const { data, error } = await supabase
        .from('game_characters')
        .select('id, name, position_x, position_y, position_z, health, is_online')
        .eq('is_online', true)
        .neq('id', this.playerId);

      if (error) throw error;

      data?.forEach((player: any) => {
        if (!this.remotePlayers.has(player.id)) {
          this.createRemotePlayer(player);
        }
      });
    } catch (error) {
      console.error('Failed to load online players:', error);
    }
  }

  private createRemotePlayer(data: any) {
    const group = new THREE.Group();

    // Head
    const headGeometry = new THREE.SphereGeometry(0.35, 32, 32);
    const skinMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4a574,
      roughness: 0.5,
    });
    const head = new THREE.Mesh(headGeometry, skinMaterial);
    head.position.y = 1.95;
    head.castShadow = true;
    group.add(head);

    // Body
    const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.45, 1.2, 16);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c3e50,
      roughness: 0.6,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.7;
    body.castShadow = true;
    group.add(body);

    // Add nameplate
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#00FF00';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(data.name, 128, 40);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const nameplate = new THREE.Sprite(spriteMaterial);
    nameplate.position.y = 2.5;
    nameplate.scale.set(40, 15, 1);
    group.add(nameplate);

    group.position.set(data.position_x || 0, data.position_y || 0, data.position_z || 0);
    this.scene.add(group);

    const remotePlayer: RemotePlayer = {
      id: data.id,
      name: data.name,
      position: { x: data.position_x || 0, y: data.position_y || 0, z: data.position_z || 0 },
      rotation: 0,
      health: data.health || 100,
      model: group,
      lastUpdated: Date.now(),
    };

    this.remotePlayers.set(data.id, remotePlayer);
  }

  private updateRemotePlayer(data: any) {
    let remotePlayer = this.remotePlayers.get(data.id);

    if (!remotePlayer) {
      this.createRemotePlayer(data);
      remotePlayer = this.remotePlayers.get(data.id)!;
    }

    if (remotePlayer) {
      remotePlayer.position = {
        x: data.position_x || remotePlayer.position.x,
        y: data.position_y || remotePlayer.position.y,
        z: data.position_z || remotePlayer.position.z,
      };
      remotePlayer.health = data.health || 100;
      remotePlayer.lastUpdated = Date.now();

      // Smooth movement
      remotePlayer.model.position.lerp(
        new THREE.Vector3(remotePlayer.position.x, remotePlayer.position.y, remotePlayer.position.z),
        0.1
      );
    }
  }

  async updateLocalPosition(position: THREE.Vector3, rotation: number) {
    try {
      await supabase
        .from('game_characters')
        .update({
          position_x: position.x,
          position_y: position.y,
          position_z: position.z,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', this.playerId);
    } catch (error) {
      console.error('Failed to update position:', error);
    }
  }

  private startUpdateLoop() {
    this.updateInterval = window.setInterval(() => {
      // Clean up inactive players
      const now = Date.now();
      Array.from(this.remotePlayers.entries()).forEach(([id, player]) => {
        if (now - player.lastUpdated > 30000) {
          // 30 seconds timeout
          this.scene.remove(player.model);
          this.remotePlayers.delete(id);
        }
      });
    }, 5000);
  }

  getRemotePlayer(playerId: string): RemotePlayer | undefined {
    return this.remotePlayers.get(playerId);
  }

  getAllRemotePlayers(): RemotePlayer[] {
    return Array.from(this.remotePlayers.values());
  }

  getNearbyPlayers(position: THREE.Vector3, radius: number = 200): RemotePlayer[] {
    return Array.from(this.remotePlayers.values()).filter((player) => {
      const distance = Math.hypot(
        position.x - player.position.x,
        position.z - player.position.z
      );
      return distance <= radius;
    });
  }

  async disconnect() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    if (this.subscriptionRef) {
      await this.subscriptionRef.unsubscribe();
    }

    // Remove all remote players
    this.remotePlayers.forEach((player) => {
      this.scene.remove(player.model);
    });
    this.remotePlayers.clear();
  }
}
