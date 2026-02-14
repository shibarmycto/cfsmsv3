import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Crosshair, Heart } from 'lucide-react';
import { PlayerData, CombatEvent, RealtimeMultiplayer } from './RealtimeMultiplayer';
import { GameBuilding } from './UKWorld';
import * as THREE from 'three';

interface GameCombatProps {
  characterId: string;
  characterName: string;
  playerPosition: THREE.Vector3;
  playerRotation: number;
  health: number;
  onHealthChange: (health: number) => void;
  multiplayer: RealtimeMultiplayer | null;
  equippedWeapon: string;
  nearbyBuilding?: GameBuilding | null;
  /** Increment this number to trigger an attack from parent */
  attackTrigger?: number;
}

interface DamageNumber {
  id: string;
  damage: number;
  x: number;
  y: number;
  timestamp: number;
  color: string;
}

export const WEAPONS: Record<string, { damage: number; range: number; cooldown: number; type: string; icon: string; ammo: number }> = {
  fists: { damage: 5, range: 2, cooldown: 500, type: 'melee', icon: '👊', ammo: Infinity },
  knife: { damage: 15, range: 2.5, cooldown: 400, type: 'melee', icon: '🔪', ammo: Infinity },
  bat: { damage: 20, range: 3, cooldown: 600, type: 'melee', icon: '🏏', ammo: Infinity },
  pistol: { damage: 25, range: 30, cooldown: 350, type: 'ranged', icon: '🔫', ammo: 30 },
  rifle: { damage: 35, range: 50, cooldown: 200, type: 'ranged', icon: '🔫', ammo: 30 },
};

export default function GameCombat({
  characterId,
  characterName,
  playerPosition,
  playerRotation,
  health,
  onHealthChange,
  multiplayer,
  equippedWeapon = 'fists',
  nearbyBuilding,
  attackTrigger = 0,
}: GameCombatProps) {
  const [isAttacking, setIsAttacking] = useState(false);
  const [nearbyPlayers, setNearbyPlayers] = useState<PlayerData[]>([]);
  const [damageNumbers, setDamageNumbers] = useState<DamageNumber[]>([]);
  const [showHitMarker, setShowHitMarker] = useState(false);
  const [screenFlash, setScreenFlash] = useState<string | null>(null);
  const lastAttackRef = useRef(0);
  const prevTriggerRef = useRef(0);

  const weapon = WEAPONS[equippedWeapon] || WEAPONS.fists;

  // Update nearby players
  useEffect(() => {
    if (!multiplayer) return;
    const interval = setInterval(() => {
      setNearbyPlayers(multiplayer.getNearbyPlayers(playerPosition, weapon.range + 5));
    }, 100);
    return () => clearInterval(interval);
  }, [multiplayer, playerPosition, weapon.range]);

  // Listen for incoming combat
  useEffect(() => {
    if (!multiplayer) return;
    multiplayer.setCombatEventHandler((event: CombatEvent) => {
      if (event.targetId === characterId) {
        const newHealth = Math.max(0, health - event.damage);
        onHealthChange(newHealth);
        addDamageNumber(event.damage, 'red');
        flashScreen('red');
        if (event.isKill) {
          toast.error(`Knocked out by ${event.attackerName}!`);
          handleDeath();
        }
      }
    });
  }, [multiplayer, characterId, health, onHealthChange]);

  // Cleanup damage numbers
  useEffect(() => {
    const interval = setInterval(() => {
      setDamageNumbers(prev => prev.filter(d => Date.now() - d.timestamp < 1200));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Trigger attack from parent via attackTrigger prop
  useEffect(() => {
    if (attackTrigger > 0 && attackTrigger !== prevTriggerRef.current) {
      prevTriggerRef.current = attackTrigger;
      doAttack();
    }
  }, [attackTrigger]);

  const addDamageNumber = (damage: number, color: string) => {
    setDamageNumbers(prev => [...prev, {
      id: Math.random().toString(36), damage, color,
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 120,
      y: window.innerHeight / 2 - 40,
      timestamp: Date.now()
    }]);
  };

  const flashScreen = (color: string) => {
    setScreenFlash(color);
    setTimeout(() => setScreenFlash(null), 200);
  };

  const handleDeath = async () => {
    await supabase.from('game_characters').update({
      is_knocked_out: true,
      knocked_out_until: new Date(Date.now() + 30000).toISOString(),
    }).eq('id', characterId);
    setTimeout(async () => {
      await supabase.from('game_characters').update({
        health: 100, is_knocked_out: false, knocked_out_until: null, position_x: 0, position_y: 0
      }).eq('id', characterId);
      onHealthChange(100);
      toast.success('Respawned at the hospital!');
    }, 5000);
  };

  const isNearBuildingWall = useCallback((): boolean => {
    if (!nearbyBuilding) return false;
    const dx = playerPosition.x - nearbyBuilding.position.x;
    const dz = playerPosition.z - nearbyBuilding.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const buildingRadius = Math.max(nearbyBuilding.size.x, nearbyBuilding.size.z) * 0.5 + 1.5;
    return dist < buildingRadius;
  }, [nearbyBuilding, playerPosition]);

  const doAttack = useCallback(async () => {
    const now = Date.now();
    if (now - lastAttackRef.current < weapon.cooldown) return;
    lastAttackRef.current = now;
    setIsAttacking(true);

    // Find target player
    let hitTarget: PlayerData | undefined;
    if (nearbyPlayers.length > 0) {
      const forward = new THREE.Vector3(Math.sin(playerRotation), 0, Math.cos(playerRotation));
      let closestDist = weapon.range;
      for (const player of nearbyPlayers) {
        const toPlayer = new THREE.Vector3(player.position.x - playerPosition.x, 0, player.position.z - playerPosition.z);
        const dist = toPlayer.length();
        toPlayer.normalize();
        if (dist <= weapon.range && forward.dot(toPlayer) > 0.4 && dist < closestDist) {
          closestDist = dist;
          hitTarget = player;
        }
      }
    }

    if (hitTarget) {
      const damage = Math.max(1, weapon.damage + Math.floor(Math.random() * 10) - 5);
      const isKill = hitTarget.health <= damage;
      setShowHitMarker(true);
      setTimeout(() => setShowHitMarker(false), 150);
      addDamageNumber(damage, 'yellow');
      multiplayer?.broadcastCombat(hitTarget.id, damage, equippedWeapon, isKill);
      await supabase.from('game_combat_logs').insert({
        attacker_id: characterId, victim_id: hitTarget.id,
        weapon_used: equippedWeapon, damage_dealt: damage, is_kill: isKill
      });
      if (isKill) toast.success(`Knocked out ${hitTarget.name}!`);
    } else if (weapon.type === 'melee' && isNearBuildingWall()) {
      // Punch wall = self damage
      const selfDamage = Math.floor(weapon.damage * 0.6);
      const newHealth = Math.max(0, health - selfDamage);
      onHealthChange(newHealth);
      addDamageNumber(selfDamage, 'orange');
      flashScreen('orange');
      toast.warning(`Ouch! You hit a wall! -${selfDamage} HP`);
      if (newHealth <= 0) handleDeath();
      await supabase.from('game_characters').update({ health: newHealth }).eq('id', characterId);
    } else if (weapon.type === 'ranged') {
      flashScreen('white');
    }

    setTimeout(() => setIsAttacking(false), 200);
  }, [characterId, equippedWeapon, multiplayer, nearbyPlayers, playerPosition, playerRotation, weapon, health, onHealthChange, isNearBuildingWall]);

  return (
    <>
      {screenFlash && (
        <div className="fixed inset-0 pointer-events-none z-50"
          style={{ backgroundColor: screenFlash === 'red' ? 'rgba(239,68,68,0.3)' : screenFlash === 'orange' ? 'rgba(251,146,60,0.25)' : 'rgba(255,255,255,0.15)' }} />
      )}

      {showHitMarker && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
          <div className="text-red-500 font-bold text-5xl">×</div>
        </div>
      )}

      {isAttacking && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
          <Crosshair className="w-12 h-12 text-red-500 animate-ping" />
        </div>
      )}

      {damageNumbers.map(dn => {
        const age = Date.now() - dn.timestamp;
        return (
          <div key={dn.id} className="fixed z-50 pointer-events-none font-black text-3xl drop-shadow-lg"
            style={{
              left: dn.x, top: dn.y - age * 0.12,
              opacity: Math.max(0, 1 - age / 1200),
              transform: 'translateX(-50%)',
              color: dn.color === 'red' ? '#ef4444' : dn.color === 'orange' ? '#fb923c' : '#facc15',
              textShadow: '0 2px 8px rgba(0,0,0,0.8)',
            }}>
            -{dn.damage}
          </div>
        );
      })}

      {health <= 25 && health > 0 && (
        <div className="fixed inset-0 pointer-events-none z-30">
          <div className="absolute inset-0 border-[6px] border-red-500/60 animate-pulse rounded-sm" />
          <div className="absolute top-[20%] left-1/2 -translate-x-1/2 flex items-center gap-2 bg-red-900/60 px-4 py-2 rounded-xl">
            <Heart className="w-6 h-6 text-red-400 animate-pulse" />
            <span className="text-red-300 font-bold text-lg">LOW HEALTH</span>
          </div>
        </div>
      )}

      {health <= 0 && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 pointer-events-none">
          <div className="text-center">
            <div className="text-red-500 text-5xl font-black mb-4">☠️ WASTED</div>
            <div className="text-gray-400 text-lg">Respawning at hospital...</div>
          </div>
        </div>
      )}

      {nearbyPlayers.length > 0 && (
        <div className="fixed bottom-32 left-3 z-40 pointer-events-none">
          <div className="bg-black/70 backdrop-blur-sm rounded-xl p-2 border border-white/10 max-w-[160px]">
            <div className="text-gray-400 text-[10px] mb-1">🎯 {nearbyPlayers.length} NEARBY</div>
            {nearbyPlayers.slice(0, 3).map(player => (
              <div key={player.id} className="flex items-center gap-1.5 text-[10px]">
                <div className={`w-1.5 h-1.5 rounded-full ${player.health > 50 ? 'bg-green-500' : player.health > 25 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                <span className="text-white truncate flex-1">{player.name}</span>
                <span className="text-gray-400">{player.health}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
