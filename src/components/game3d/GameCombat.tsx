import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Heart } from 'lucide-react';
import { PlayerData, CombatEvent, RealtimeMultiplayer } from './RealtimeMultiplayer';
import { GameBuilding } from './UKWorld';
import * as THREE from 'three';

interface GameCombatProps {
  characterId: string;
  characterName: string;
  playerPosition: THREE.Vector3;
  playerRotation: number;
  health: number;
  armor: number;
  onHealthChange: (health: number) => void;
  onArmorChange: (armor: number) => void;
  multiplayer: RealtimeMultiplayer | null;
  equippedWeapon: string;
  nearbyBuilding?: GameBuilding | null;
  attackTrigger?: number;
  /** Crosshair offset from center, in pixels */
  aimOffset?: { x: number; y: number };
  /** Current ammo count */
  ammo: number;
  onAmmoChange: (ammo: number) => void;
  /** THREE.js camera for screen-space targeting */
  camera?: THREE.Camera | null;
}

interface DamageNumber {
  id: string;
  damage: number;
  x: number;
  y: number;
  timestamp: number;
  color: string;
}

interface BulletTracer {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  timestamp: number;
}

interface KillBanner {
  id: string;
  killerName: string;
  victimName: string;
  weapon: string;
  timestamp: number;
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
  armor,
  onHealthChange,
  onArmorChange,
  multiplayer,
  equippedWeapon = 'fists',
  nearbyBuilding,
  attackTrigger = 0,
  aimOffset = { x: 0, y: 0 },
  ammo,
  onAmmoChange,
  camera,
}: GameCombatProps) {
  const [isAttacking, setIsAttacking] = useState(false);
  const [nearbyPlayers, setNearbyPlayers] = useState<PlayerData[]>([]);
  const [damageNumbers, setDamageNumbers] = useState<DamageNumber[]>([]);
  const [showHitMarker, setShowHitMarker] = useState(false);
  const [screenFlash, setScreenFlash] = useState<string | null>(null);
  const [bulletTracers, setBulletTracers] = useState<BulletTracer[]>([]);
  const [killBanners, setKillBanners] = useState<KillBanner[]>([]);
  const lastAttackRef = useRef(0);
  const prevTriggerRef = useRef(0);

  const weapon = WEAPONS[equippedWeapon] || WEAPONS.fists;

  // Update nearby players - wider range to allow aiming at distant targets
  useEffect(() => {
    if (!multiplayer) return;
    const interval = setInterval(() => {
      setNearbyPlayers(multiplayer.getNearbyPlayers(playerPosition, weapon.range + 10));
    }, 100);
    return () => clearInterval(interval);
  }, [multiplayer, playerPosition, weapon.range]);

  // Listen for incoming combat - use ref to avoid stale closure
  const healthRef = useRef(health);
  healthRef.current = health;
  const armorRef = useRef(armor);
  armorRef.current = armor;
  const onHealthChangeRef = useRef(onHealthChange);
  onHealthChangeRef.current = onHealthChange;
  const onArmorChangeRef = useRef(onArmorChange);
  onArmorChangeRef.current = onArmorChange;

  useEffect(() => {
    if (!multiplayer) return;
    multiplayer.setCombatEventHandler((event: CombatEvent) => {
      if (event.targetId === characterId) {
        let dmg = event.damage;
        let currentArmor = armorRef.current;
        let currentHealth = healthRef.current;
        // Armor absorbs damage first
        if (currentArmor > 0) {
          const absorbed = Math.min(currentArmor, dmg);
          currentArmor -= absorbed;
          dmg -= absorbed;
          onArmorChangeRef.current(currentArmor);
          supabase.from('game_characters').update({ armor: currentArmor }).eq('id', characterId).then();
        }
        const newHealth = Math.max(0, currentHealth - dmg);
        onHealthChangeRef.current(newHealth);
        addDamageNumber(event.damage, currentArmor > 0 ? 'blue' : 'red');
        flashScreen('red');
        toast.error(`Hit by ${event.attackerName} for ${event.damage} damage!`);
        supabase.from('game_characters').update({ health: newHealth }).eq('id', characterId).then();
        if (event.isKill || newHealth <= 0) {
          addKillBanner(event.attackerName || 'Unknown', characterName, event.weaponType || 'fists');
          handleDeath();
        }
      }
    });
  }, [multiplayer, characterId, characterName]);

  // Cleanup damage numbers & tracers & kill banners
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setDamageNumbers(prev => prev.filter(d => now - d.timestamp < 1200));
      setBulletTracers(prev => prev.filter(b => now - b.timestamp < 300));
      setKillBanners(prev => prev.filter(k => now - k.timestamp < 4000));
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
    const cx = window.innerWidth / 2 + aimOffset.x;
    const cy = window.innerHeight / 2 + aimOffset.y;
    setDamageNumbers(prev => [...prev, {
      id: Math.random().toString(36), damage, color,
      x: cx + (Math.random() - 0.5) * 80,
      y: cy - 20,
      timestamp: Date.now()
    }]);
  };

  const addBulletTracer = () => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const endX = cx + aimOffset.x;
    const endY = cy + aimOffset.y;
    setBulletTracers(prev => [...prev, {
      id: Math.random().toString(36),
      startX: cx + (Math.random() - 0.5) * 10,
      startY: cy + 60,
      endX: endX + (Math.random() - 0.5) * 15,
      endY: endY + (Math.random() - 0.5) * 15,
      timestamp: Date.now()
    }]);
  };

  const addKillBanner = (killer: string, victim: string, weaponUsed: string) => {
    setKillBanners(prev => [...prev, {
      id: Math.random().toString(36),
      killerName: killer,
      victimName: victim,
      weapon: weaponUsed,
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

  // Screen-space hit test: project player world position to screen, check if crosshair is near
  const isPlayerUnderCrosshair = useCallback((player: PlayerData): boolean => {
    if (!camera) return false;
    const worldPos = new THREE.Vector3(player.position.x, 1.0, player.position.z);
    const screenPos = worldPos.clone().project(camera);
    // Convert to pixel coords
    const screenX = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;
    // Crosshair position
    const crossX = window.innerWidth / 2 + aimOffset.x;
    const crossY = window.innerHeight / 2 + aimOffset.y;
    const dx = screenX - crossX;
    const dy = screenY - crossY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Hit radius scales with distance - closer = easier to hit
    const worldDist = playerPosition.distanceTo(worldPos);
    const hitRadius = Math.max(40, 120 - worldDist * 2); // px
    return dist < hitRadius && screenPos.z > 0 && screenPos.z < 1;
  }, [camera, aimOffset, playerPosition]);

  // Fallback: old aim-direction method for melee / no camera
  const getAimDirection = useCallback(() => {
    const aimAngleX = (aimOffset.x / (window.innerWidth * 0.15));
    const baseAngle = playerRotation + aimAngleX * 1.5;
    return new THREE.Vector3(Math.sin(baseAngle), 0, Math.cos(baseAngle));
  }, [playerRotation, aimOffset]);

  const doAttack = useCallback(async () => {
    const now = Date.now();
    if (now - lastAttackRef.current < weapon.cooldown) return;

    // Check ammo for ranged weapons
    if (weapon.type === 'ranged') {
      if (ammo <= 0) {
        toast.error('No ammo! Buy ammo from the Store.');
        return;
      }
      onAmmoChange(ammo - 1);
      addBulletTracer();
    }

    lastAttackRef.current = now;
    setIsAttacking(true);

    // Find target player - prefer screen-space for ranged, fallback to direction for melee
    let hitTarget: PlayerData | undefined;
    if (nearbyPlayers.length > 0) {
      if (weapon.type === 'ranged' && camera) {
        // Screen-space: crosshair must be on the player
        for (const player of nearbyPlayers) {
          const worldDist = playerPosition.distanceTo(new THREE.Vector3(player.position.x, 0, player.position.z));
          if (worldDist <= weapon.range && isPlayerUnderCrosshair(player)) {
            hitTarget = player;
            break;
          }
        }
      } else {
        // Melee fallback: direction-based
        const aimDir = getAimDirection();
        let closestDist = weapon.range;
        const dotThreshold = 0.3;
        for (const player of nearbyPlayers) {
          const toPlayer = new THREE.Vector3(player.position.x - playerPosition.x, 0, player.position.z - playerPosition.z);
          const dist = toPlayer.length();
          toPlayer.normalize();
          if (dist <= weapon.range && aimDir.dot(toPlayer) > dotThreshold && dist < closestDist) {
            closestDist = dist;
            hitTarget = player;
          }
        }
      }
    }

    if (hitTarget) {
      const damage = Math.max(1, weapon.damage + Math.floor(Math.random() * 10) - 5);
      const isKill = hitTarget.health <= damage;
      setShowHitMarker(true);
      setTimeout(() => setShowHitMarker(false), 150);
      addDamageNumber(damage, 'yellow');
      flashScreen('white');
      multiplayer?.broadcastCombat(hitTarget.id, damage, equippedWeapon, isKill);
      await supabase.from('game_combat_logs').insert({
        attacker_id: characterId, victim_id: hitTarget.id,
        weapon_used: equippedWeapon, damage_dealt: damage, is_kill: isKill
      });
      if (isKill) {
        addKillBanner(characterName, hitTarget.name, equippedWeapon);
        toast.success(`☠️ Knocked out ${hitTarget.name}!`);
      }
    } else if (weapon.type === 'melee' && isNearBuildingWall()) {
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
  }, [characterId, characterName, equippedWeapon, multiplayer, nearbyPlayers, playerPosition, weapon, health, onHealthChange, isNearBuildingWall, ammo, onAmmoChange, getAimDirection, aimOffset, camera, isPlayerUnderCrosshair]);

  return (
    <>
      {/* Screen flash */}
      {screenFlash && (
        <div className="fixed inset-0 pointer-events-none z-50"
          style={{ backgroundColor: screenFlash === 'red' ? 'rgba(239,68,68,0.3)' : screenFlash === 'orange' ? 'rgba(251,146,60,0.25)' : 'rgba(255,255,255,0.15)' }} />
      )}

      {/* Hit marker (X) at crosshair position */}
      {showHitMarker && (
        <div className="fixed z-50 pointer-events-none"
          style={{ left: window.innerWidth / 2 + aimOffset.x, top: window.innerHeight / 2 + aimOffset.y, transform: 'translate(-50%, -50%)' }}>
          <div className="text-red-500 font-bold text-5xl" style={{ textShadow: '0 0 10px rgba(239,68,68,0.8)' }}>×</div>
        </div>
      )}

      {/* Muzzle flash on fire */}
      {isAttacking && weapon.type === 'ranged' && (
        <div className="fixed z-45 pointer-events-none"
          style={{ left: window.innerWidth / 2, top: window.innerHeight / 2 + 50, transform: 'translate(-50%, -50%)' }}>
          <div className="w-6 h-6 bg-yellow-400 rounded-full animate-ping opacity-80" style={{ boxShadow: '0 0 30px 10px rgba(250,204,21,0.6)' }} />
        </div>
      )}

      {/* Bullet tracers */}
      <svg className="fixed inset-0 w-full h-full pointer-events-none z-45" style={{ zIndex: 45 }}>
        {bulletTracers.map(bt => {
          const age = Date.now() - bt.timestamp;
          const progress = Math.min(1, age / 150);
          const opacity = Math.max(0, 1 - age / 300);
          const curX = bt.startX + (bt.endX - bt.startX) * progress;
          const curY = bt.startY + (bt.endY - bt.startY) * progress;
          return (
            <line key={bt.id}
              x1={bt.startX} y1={bt.startY}
              x2={curX} y2={curY}
              stroke={`rgba(255,200,50,${opacity})`}
              strokeWidth="2"
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {/* Kill banners - top of screen */}
      <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex flex-col gap-1 items-center">
        {killBanners.map(kb => {
          const age = Date.now() - kb.timestamp;
          const opacity = age > 3000 ? Math.max(0, 1 - (age - 3000) / 1000) : 1;
          const weaponIcon = WEAPONS[kb.weapon]?.icon || '💀';
          return (
            <div key={kb.id} className="flex items-center gap-2 bg-black/80 backdrop-blur-sm rounded-lg px-4 py-2 border border-red-500/50"
              style={{ opacity, transform: `translateY(${Math.min(0, -10 + age * 0.01)}px)` }}>
              <span className="text-red-400 font-bold text-sm">{kb.killerName}</span>
              <span className="text-gray-500 text-xs">[{weaponIcon} {kb.weapon}]</span>
              <span className="text-gray-400 text-sm">☠️</span>
              <span className="text-white font-bold text-sm">{kb.victimName}</span>
            </div>
          );
        })}
      </div>

      {/* Damage numbers */}
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

      {/* Low health warning */}
      {health <= 25 && health > 0 && (
        <div className="fixed inset-0 pointer-events-none z-30">
          <div className="absolute inset-0 border-[6px] border-red-500/60 animate-pulse rounded-sm" />
          <div className="absolute top-[20%] left-1/2 -translate-x-1/2 flex items-center gap-2 bg-red-900/60 px-4 py-2 rounded-xl">
            <Heart className="w-6 h-6 text-red-400 animate-pulse" />
            <span className="text-red-300 font-bold text-lg">LOW HEALTH</span>
          </div>
        </div>
      )}

      {/* Wasted screen */}
      {health <= 0 && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 pointer-events-none">
          <div className="text-center">
            <div className="text-red-500 text-5xl font-black mb-4">☠️ WASTED</div>
            <div className="text-gray-400 text-lg">Respawning at hospital...</div>
          </div>
        </div>
      )}

      {/* Nearby players indicator */}
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
