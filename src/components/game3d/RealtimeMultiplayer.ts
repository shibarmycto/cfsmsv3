import * as THREE from 'three';
import { supabase } from '@/integrations/supabase/client';
import { createRealisticCharacter, animateCharacter } from './RealisticCharacter';

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
  private broadcastInterval = 50;
  private onCombatEvent: ((event: CombatEvent) => void) | null = null;
  private onPlayerCountChange: ((count: number) => void) | null = null;

  // DB-backed sync for cross-domain visibility
  private lastDbWrite = 0;
  private dbWriteInterval = 300;
  private dbPollInterval = 1000;
  private dbPollTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPosition = { x: 0, y: 0, z: 0 };
  private lastRotation = 0;
  private lastState: 'idle' | 'walking' | 'running' | 'attacking' = 'idle';
  private lastHealth = 100;
  private lastWeapon = 'fists';

  constructor(playerId: string, playerName: string, scene: THREE.Scene) {
    this.playerId = playerId;
    this.playerName = playerName;
    this.scene = scene;
  }

  async initialize(): Promise<void> {
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

    // Presence channel
    this.presenceChannel = supabase.channel('cf-roleplay-presence');
    
    this.presenceChannel.on('presence', { event: 'sync' }, () => {
      const state = this.presenceChannel.presenceState();
      const allKeys = Object.keys(state);
      this.onPlayerCountChange?.(Math.max(allKeys.length, this.remotePlayers.size + 1));
      
      const presentIds = new Set<string>();
      allKeys.forEach(key => {
        const presences = state[key] as any[];
        presences.forEach(p => presentIds.add(p.id));
      });
      
      // Don't aggressively remove — DB poll will handle cross-domain players
    });

    this.presenceChannel.on('presence', { event: 'leave' }, ({ leftPresences }: any) => {
      // Only remove if also not in DB poll results (handled by stale check)
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

    // Start DB polling — this is the KEY for cross-domain visibility
    this.startDbPolling();
  }

  private startDbPolling(): void {
    const poll = async () => {
      try {
        const { data } = await supabase
          .from('game_characters')
          .select('id, name, position_x, position_y, health, equipped_weapon, is_online, last_seen_at')
          .eq('is_online', true)
          .neq('id', this.playerId);

        if (data) {
          const now = Date.now();
          for (const char of data) {
            const lastSeen = char.last_seen_at ? new Date(char.last_seen_at).getTime() : 0;
            // Skip records older than 20s
            if (now - lastSeen > 20000) continue;

            const existing = this.remotePlayers.get(char.id);
            // Always update from DB if no recent broadcast data (>1s threshold)
            if (!existing || (now - existing.lastUpdate > 1000)) {
              this.handlePlayerUpdate({
                id: char.id,
                name: char.name,
                position: { x: char.position_x || 0, y: 0, z: char.position_y || 0 },
                rotation: existing?.rotation || 0,
                health: char.health || 100,
                state: existing?.state || 'idle',
                equippedWeapon: char.equipped_weapon || 'fists',
                lastUpdate: lastSeen
              });
            }
          }

          // Remove players no longer in DB results
          const dbIds = new Set(data.map(c => c.id));
          this.remotePlayers.forEach((player, id) => {
            if (!dbIds.has(id) && Date.now() - player.lastUpdate > 10000) {
              this.removeRemotePlayer(id);
            }
          });

          const totalCount = Math.max(this.remotePlayers.size + 1, (data.length || 0) + 1);
          this.onPlayerCountChange?.(totalCount);
        }
      } catch (e) {
        console.warn('DB poll failed:', e);
      }

      this.dbPollTimer = setTimeout(poll, this.dbPollInterval);
    };

    // Initial poll immediately
    poll();
  }

  private writePositionToDb(): void {
    const now = Date.now();
    if (now - this.lastDbWrite < this.dbWriteInterval) return;
    this.lastDbWrite = now;

    supabase
      .from('game_characters')
      .update({
        position_x: Math.round(this.lastPosition.x * 10) / 10,
        position_y: Math.round(this.lastPosition.z * 10) / 10,
        health: this.lastHealth,
        equipped_weapon: this.lastWeapon,
        is_online: true,
        last_seen_at: new Date().toISOString()
      })
      .eq('id', this.playerId)
      .then();
  }

  setCombatEventHandler(handler: (event: CombatEvent) => void): void {
    this.onCombatEvent = handler;
  }

  setPlayerCountHandler(handler: (count: number) => void): void {
    this.onPlayerCountChange = handler;
  }

  broadcastPosition(position: THREE.Vector3, rotation: number, state: 'idle' | 'walking' | 'running' | 'attacking', health: number, weapon: string): void {
    this.lastPosition = { x: position.x, y: position.y, z: position.z };
    this.lastRotation = rotation;
    this.lastState = state;
    this.lastHealth = health;
    this.lastWeapon = weapon;

    this.writePositionToDb();

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
      // Update data but keep lastUpdate as max of existing and new
      data.lastUpdate = Math.max(data.lastUpdate, existing.lastUpdate);
      Object.assign(existing, data);
    } else {
      this.remotePlayers.set(data.id, data);
      this.createPlayerMesh(data);
      this.onPlayerCountChange?.(this.remotePlayers.size + 1);
    }
  }

  private createPlayerMesh(player: PlayerData): void {
    // Use the SAME realistic character model as the local player
    const group = createRealisticCharacter({
      name: player.name,
      isPlayer: false,
      // Random colors based on player id
      skinTone: this.getSkintoneFromId(player.id),
      shirtColor: this.getRandomPlayerColor(player.id),
      pantsColor: this.getDarkerColor(this.getRandomPlayerColor(player.id)),
      hairColor: this.getHairColorFromId(player.id),
    });

    // Store animation references
    group.userData.animState = player.state;
    group.userData.lastHealth = player.health;

    group.position.set(player.position.x, player.position.y, player.position.z);
    group.rotation.y = player.rotation;

    this.scene.add(group);
    this.playerMeshes.set(player.id, group);
  }

  private getSkintoneFromId(id: string): number {
    const tones = [0xf5d0c5, 0xd4a574, 0xc68642, 0x8d5524, 0x6b3a2a, 0xffe0bd];
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return tones[Math.abs(hash) % tones.length];
  }

  private getHairColorFromId(id: string): number {
    const colors = [0x1a1a1a, 0x3d2314, 0x654321, 0x8b6914, 0x2c1608, 0x4a3728];
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 3) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  private getRandomPlayerColor(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    const h = Math.abs(hash) % 360;
    return new THREE.Color(`hsl(${h}, 60%, 40%)`).getHex();
  }

  private getDarkerColor(color: number): number {
    const c = new THREE.Color(color);
    c.multiplyScalar(0.6);
    return c.getHex();
  }

  update(delta: number): void {
    const now = Date.now();

    this.remotePlayers.forEach((player, id) => {
      const mesh = this.playerMeshes.get(id);
      if (!mesh) return;

      // Remove inactive players (no update in 20 seconds)
      if (now - player.lastUpdate > 20000) {
        this.removeRemotePlayer(id);
        return;
      }

      // Smooth position interpolation
      const targetPos = new THREE.Vector3(player.position.x, player.position.y, player.position.z);
      mesh.position.lerp(targetPos, 0.12);

      // Smooth rotation interpolation
      let targetRot = player.rotation;
      let currentRot = mesh.rotation.y;
      let diff = targetRot - currentRot;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      mesh.rotation.y += diff * 0.12;

      // Animate using the same animation system as local player
      const isMoving = player.state === 'walking' || player.state === 'running';
      const isSprinting = player.state === 'running';
      animateCharacter(mesh, isMoving, isSprinting, delta);
    });
  }

  removeRemotePlayer(id: string): void {
    const mesh = this.playerMeshes.get(id);
    if (mesh) {
      this.scene.remove(mesh);
      mesh.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (obj.material instanceof THREE.Material) obj.material.dispose();
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
    if (this.dbPollTimer) {
      clearTimeout(this.dbPollTimer);
      this.dbPollTimer = null;
    }

    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'player-leave',
        payload: { id: this.playerId }
      });
      supabase.removeChannel(this.channel);
    }

    if (this.presenceChannel) {
      supabase.removeChannel(this.presenceChannel);
    }

    this.playerMeshes.forEach((mesh) => {
      this.scene.remove(mesh);
      mesh.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (obj.material instanceof THREE.Material) obj.material.dispose();
        }
      });
    });

    this.playerMeshes.clear();
    this.remotePlayers.clear();
  }
}
