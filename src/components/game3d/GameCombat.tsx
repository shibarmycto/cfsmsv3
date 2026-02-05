import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Crosshair, Sword, Target, Skull, Shield, Heart } from 'lucide-react';
import { PlayerData, CombatEvent, RealtimeMultiplayer } from './RealtimeMultiplayer';
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
}

interface DamageNumber {
  id: string;
  damage: number;
  x: number;
  y: number;
  timestamp: number;
}

const WEAPONS = {
  fists: { damage: 5, range: 2, cooldown: 500, type: 'melee' },
  knife: { damage: 15, range: 2.5, cooldown: 400, type: 'melee' },
  bat: { damage: 20, range: 3, cooldown: 600, type: 'melee' },
  pistol: { damage: 25, range: 30, cooldown: 350, type: 'ranged' },
  rifle: { damage: 35, range: 50, cooldown: 200, type: 'ranged' },
};

export default function GameCombat({
  characterId,
  characterName,
  playerPosition,
  playerRotation,
  health,
  onHealthChange,
  multiplayer,
  equippedWeapon = 'fists'
}: GameCombatProps) {
  const [isAttacking, setIsAttacking] = useState(false);
  const [attackCooldown, setAttackCooldown] = useState(false);
  const [nearbyPlayers, setNearbyPlayers] = useState<PlayerData[]>([]);
  const [damageNumbers, setDamageNumbers] = useState<DamageNumber[]>([]);
  const [showHitMarker, setShowHitMarker] = useState(false);
  const lastAttackRef = useRef(0);

  // Get weapon stats
  const weapon = WEAPONS[equippedWeapon as keyof typeof WEAPONS] || WEAPONS.fists;

  // Update nearby players
  useEffect(() => {
    if (!multiplayer) return;
    
    const interval = setInterval(() => {
      const nearby = multiplayer.getNearbyPlayers(playerPosition, weapon.range + 5);
      setNearbyPlayers(nearby);
    }, 100);

    return () => clearInterval(interval);
  }, [multiplayer, playerPosition, weapon.range]);

  // Listen for incoming combat events
  useEffect(() => {
    if (!multiplayer) return;

    multiplayer.setCombatEventHandler((event: CombatEvent) => {
      if (event.targetId === characterId) {
        // We got hit!
        const newHealth = Math.max(0, health - event.damage);
        onHealthChange(newHealth);
        
        // Show damage number
        addDamageNumber(event.damage);
        
        // Flash screen red
        showDamageFlash();

        if (event.isKill) {
          toast.error(`You were knocked out by ${event.attackerName}!`);
          handleDeath();
        } else {
          toast.info(`Hit by ${event.attackerName} for ${event.damage} damage!`);
        }
      }
    });
  }, [multiplayer, characterId, health, onHealthChange]);

  // Clean up old damage numbers
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setDamageNumbers(prev => prev.filter(d => now - d.timestamp < 1000));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const addDamageNumber = (damage: number) => {
    const id = Math.random().toString(36);
    const offsetX = (Math.random() - 0.5) * 100;
    setDamageNumbers(prev => [...prev, {
      id,
      damage,
      x: window.innerWidth / 2 + offsetX,
      y: window.innerHeight / 2,
      timestamp: Date.now()
    }]);
  };

  const showDamageFlash = () => {
    const flash = document.createElement('div');
    flash.className = 'fixed inset-0 bg-red-500/30 pointer-events-none z-50 animate-pulse';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 200);
  };

  const handleDeath = async () => {
    // Set knocked out status
    await supabase.from('game_characters').update({
      is_knocked_out: true,
      knocked_out_until: new Date(Date.now() + 30000).toISOString(),
      deaths: supabase.rpc ? undefined : 0 // Increment handled by trigger
    }).eq('id', characterId);

    // Respawn after 5 seconds
    setTimeout(async () => {
      await supabase.from('game_characters').update({
        health: 100,
        is_knocked_out: false,
        knocked_out_until: null,
        position_x: 0,
        position_y: 0
      }).eq('id', characterId);
      onHealthChange(100);
      toast.success('You have respawned at the hospital!');
    }, 5000);
  };

  const attack = useCallback(async (target?: PlayerData) => {
    const now = Date.now();
    if (now - lastAttackRef.current < weapon.cooldown) return;
    lastAttackRef.current = now;

    setIsAttacking(true);
    setAttackCooldown(true);

    // Determine target
    let hitTarget = target;
    if (!hitTarget && nearbyPlayers.length > 0) {
      // Auto-aim to closest player in front
      const forward = new THREE.Vector3(
        Math.sin(playerRotation),
        0,
        Math.cos(playerRotation)
      );

      let closestDist = weapon.range;
      nearbyPlayers.forEach(player => {
        const toPlayer = new THREE.Vector3(
          player.position.x - playerPosition.x,
          0,
          player.position.z - playerPosition.z
        );
        const dist = toPlayer.length();
        
        // Check if player is in front (dot product > 0)
        toPlayer.normalize();
        const dot = forward.dot(toPlayer);
        
        if (dist <= weapon.range && dot > 0.5 && dist < closestDist) {
          closestDist = dist;
          hitTarget = player;
        }
      });
    }

    if (hitTarget) {
      // Calculate damage with variance
      const baseDamage = weapon.damage;
      const variance = Math.floor(Math.random() * 10) - 5;
      const damage = Math.max(1, baseDamage + variance);
      
      const isKill = hitTarget.health <= damage;

      // Show hit marker
      setShowHitMarker(true);
      setTimeout(() => setShowHitMarker(false), 100);

      // Broadcast combat event
      multiplayer?.broadcastCombat(hitTarget.id, damage, equippedWeapon, isKill);

      // Log combat to database
      await supabase.from('game_combat_logs').insert({
        attacker_id: characterId,
        victim_id: hitTarget.id,
        weapon_used: equippedWeapon,
        damage_dealt: damage,
        is_kill: isKill
      });

      if (isKill) {
        // Update our kill count
        await supabase.from('game_characters').update({
          kills: supabase.rpc ? undefined : 0
        }).eq('id', characterId);
        
        toast.success(`Knocked out ${hitTarget.name}!`);
      } else {
        toast.info(`Hit ${hitTarget.name} for ${damage}!`);
      }
    } else {
      // Miss - no target in range
      if (nearbyPlayers.length === 0) {
        // Silent miss - no one around
      }
    }

    setTimeout(() => setIsAttacking(false), 200);
    setTimeout(() => setAttackCooldown(false), weapon.cooldown);
  }, [characterId, equippedWeapon, multiplayer, nearbyPlayers, playerPosition, playerRotation, weapon]);

  // Get weapon icon
  const getWeaponIcon = () => {
    switch (equippedWeapon) {
      case 'knife': return '🔪';
      case 'bat': return '🏏';
      case 'pistol': return '🔫';
      case 'rifle': return '🔫';
      default: return '👊';
    }
  };

  return (
    <>
      {/* Attack button overlay - mobile */}
      <button
        onTouchStart={(e) => { e.preventDefault(); attack(); }}
        onClick={() => attack()}
        disabled={attackCooldown}
        className={`fixed bottom-8 right-8 w-20 h-20 rounded-full border-4 flex items-center justify-center z-40 pointer-events-auto transition-all ${
          attackCooldown
            ? 'bg-gray-600/50 border-gray-500'
            : isAttacking
              ? 'bg-red-600 border-red-400 scale-90'
              : 'bg-red-500/60 border-red-400/80 active:scale-90 active:bg-red-600'
        }`}
      >
        <span className="text-4xl">{getWeaponIcon()}</span>
      </button>

      {/* Weapon info */}
      <div className="fixed bottom-32 right-8 z-40 pointer-events-none">
        <div className="bg-black/70 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{getWeaponIcon()}</span>
            <div className="text-left">
              <div className="text-white text-sm font-bold capitalize">{equippedWeapon}</div>
              <div className="text-gray-400 text-xs">
                {weapon.damage} DMG • {weapon.range}m
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hit marker */}
      {showHitMarker && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
          <div className="text-red-500 font-bold text-4xl animate-ping">×</div>
        </div>
      )}

      {/* Attack animation indicator */}
      {isAttacking && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
          <Crosshair className="w-16 h-16 text-red-500 animate-pulse" />
        </div>
      )}

      {/* Damage numbers floating up */}
      {damageNumbers.map(dn => (
        <div
          key={dn.id}
          className="fixed z-50 pointer-events-none font-bold text-2xl text-red-500 animate-bounce"
          style={{
            left: dn.x,
            top: dn.y - (Date.now() - dn.timestamp) * 0.1,
            opacity: 1 - (Date.now() - dn.timestamp) / 1000,
            transform: 'translateX(-50%)'
          }}
        >
          -{dn.damage}
        </div>
      ))}

      {/* Nearby players indicator */}
      {nearbyPlayers.length > 0 && (
        <div className="fixed bottom-32 left-8 z-40 pointer-events-none">
          <div className="bg-black/70 backdrop-blur-sm rounded-xl p-3 border border-white/10 max-w-[180px]">
            <div className="text-gray-400 text-xs mb-2 flex items-center gap-1">
              <Target className="w-3 h-3" /> {nearbyPlayers.length} NEARBY
            </div>
            <div className="space-y-1">
              {nearbyPlayers.slice(0, 4).map(player => (
                <div key={player.id} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${player.health > 50 ? 'bg-green-500' : player.health > 25 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                  <span className="text-white text-sm truncate flex-1">{player.name}</span>
                  <span className="text-gray-400 text-xs">{player.health}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Health warning */}
      {health <= 25 && (
        <div className="fixed inset-0 pointer-events-none z-30">
          <div className="absolute inset-0 border-4 border-red-500/50 animate-pulse" />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 text-red-500 font-bold text-xl flex items-center gap-2">
            <Heart className="w-6 h-6 animate-pulse" />
            LOW HEALTH
          </div>
        </div>
      )}
    </>
  );
}
