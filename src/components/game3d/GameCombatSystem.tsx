import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Sword, Heart, Target, Shield, Skull } from 'lucide-react';

interface Weapon {
  id: string;
  name: string;
  damage: number;
  range: number;
  icon: string;
  ammoCapacity: number;
}

interface PlayerTarget {
  id: string;
  name: string;
  distance: number;
  health: number;
}

interface GameCombatSystemProps {
  characterId: string;
  characterName: string;
  currentHealth: number;
  currentJob: string;
  onHealthChange: (health: number) => void;
  onDeath: () => void;
  playerCash: number;
  onCashChange: (cash: number) => void;
}

const WEAPONS: Weapon[] = [
  { id: 'fists', name: 'Fists', damage: 5, range: 2, icon: '👊', ammoCapacity: 0 },
  { id: 'bat', name: 'Baseball Bat', damage: 15, range: 3, icon: '🏏', ammoCapacity: 0 },
  { id: 'knife', name: 'Knife', damage: 20, range: 2, icon: '🔪', ammoCapacity: 0 },
  { id: 'pistol', name: 'Pistol', damage: 25, range: 30, icon: '🔫', ammoCapacity: 12 },
  { id: 'smg', name: 'SMG', damage: 18, range: 25, icon: '🔫', ammoCapacity: 30 },
  { id: 'rifle', name: 'Rifle', damage: 35, range: 100, icon: '🎯', ammoCapacity: 30 },
];

export default function GameCombatSystem({
  characterId,
  characterName,
  currentHealth,
  currentJob,
  onHealthChange,
  onDeath,
  playerCash,
  onCashChange,
}: GameCombatSystemProps) {
  const [equippedWeapon, setEquippedWeapon] = useState<Weapon>(WEAPONS[0]);
  const [ownedWeapons, setOwnedWeapons] = useState<string[]>(['fists']);
  const [ammo, setAmmo] = useState<Record<string, number>>({});
  const [isAttacking, setIsAttacking] = useState(false);
  const [attackCooldown, setAttackCooldown] = useState(false);
  const [showWeaponWheel, setShowWeaponWheel] = useState(false);
  const [nearbyPlayers, setNearbyPlayers] = useState<PlayerTarget[]>([]);

  // Load inventory on mount
  useEffect(() => {
    loadInventory();
  }, [characterId]);

  const loadInventory = async () => {
    const { data } = await supabase
      .from('game_player_inventory')
      .select('*, weapon:game_weapons(*)')
      .eq('character_id', characterId);
    
    if (data && data.length > 0) {
      const weaponIds = data.map((item: any) => item.weapon?.name?.toLowerCase().replace(' ', '_') || item.weapon_id);
      setOwnedWeapons(['fists', ...weaponIds]);
      
      const ammoMap: Record<string, number> = {};
      data.forEach((item: any) => {
        if (item.weapon) {
          ammoMap[item.weapon.name.toLowerCase().replace(' ', '_')] = item.ammo || 0;
        }
      });
      setAmmo(ammoMap);
    }
  };

  // Subscribe to nearby players for combat
  useEffect(() => {
    const channel = supabase.channel('player-positions')
      .on('broadcast', { event: 'position' }, ({ payload }) => {
        if (payload.characterId !== characterId) {
          setNearbyPlayers(prev => {
            const filtered = prev.filter(p => p.id !== payload.characterId);
            if (payload.distance < 50) {
              return [...filtered, {
                id: payload.characterId,
                name: payload.name,
                distance: payload.distance,
                health: payload.health || 100,
              }];
            }
            return filtered;
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [characterId]);

  const attack = useCallback(async (targetId?: string) => {
    if (attackCooldown) return;
    
    setIsAttacking(true);
    setAttackCooldown(true);

    // Check ammo for ranged weapons
    if (equippedWeapon.ammoCapacity > 0) {
      const currentAmmo = ammo[equippedWeapon.id] || 0;
      if (currentAmmo <= 0) {
        toast.error('No ammo! Buy more at a gun shop.');
        setIsAttacking(false);
        setAttackCooldown(false);
        return;
      }
      setAmmo(prev => ({ ...prev, [equippedWeapon.id]: currentAmmo - 1 }));
    }

    const damage = equippedWeapon.damage + Math.floor(Math.random() * 10);

    // If we have a target, apply damage
    if (targetId) {
      try {
        const { data: target } = await supabase
          .from('game_characters')
          .select('id, name, health, cash, is_knocked_out')
          .eq('id', targetId)
          .single();

        if (target && !target.is_knocked_out) {
          const newHealth = Math.max(0, target.health - damage);
          const isKill = newHealth <= 0;

          // Update target health
          await supabase.from('game_characters').update({
            health: isKill ? 100 : newHealth,
            is_knocked_out: isKill,
            knocked_out_by: isKill ? characterId : null,
            knocked_out_until: isKill ? new Date(Date.now() + 30000).toISOString() : null,
          }).eq('id', targetId);

          // Log combat
          await supabase.from('game_combat_logs').insert({
            attacker_id: characterId,
            victim_id: targetId,
            weapon_used: equippedWeapon.name,
            damage_dealt: damage,
            is_kill: isKill,
          });

          if (isKill) {
            // Steal some cash from the victim
            const stolenCash = Math.floor((target.cash || 0) * 0.1);
            if (stolenCash > 0) {
              await supabase.from('game_characters').update({
                cash: (target.cash || 0) - stolenCash,
              }).eq('id', targetId);

              onCashChange(playerCash + stolenCash);
              await supabase.from('game_characters').update({
                cash: playerCash + stolenCash,
              }).eq('id', characterId);

              toast.success(`Knocked out ${target.name}! Stole $${stolenCash}`);
            } else {
              toast.success(`Knocked out ${target.name}!`);
            }

            // Update kill count and wanted level for non-police
            if (currentJob !== 'police') {
              const { data: stats } = await supabase
                .from('game_characters')
                .select('kills, wanted_level')
                .eq('id', characterId)
                .single();

              if (stats) {
                await supabase.from('game_characters').update({
                  kills: (stats.kills || 0) + 1,
                  wanted_level: Math.min(5, (stats.wanted_level || 0) + 1),
                }).eq('id', characterId);
              }
            }
          } else {
            toast.info(`Hit ${target.name} for ${damage} damage!`);
          }
        }
      } catch (error) {
        console.error('Attack error:', error);
      }
    } else {
      // No target - just show attack animation
      toast.info(`Swinging ${equippedWeapon.name}...`);
    }

    setTimeout(() => setIsAttacking(false), 300);
    setTimeout(() => setAttackCooldown(false), equippedWeapon.ammoCapacity > 0 ? 500 : 800);
  }, [equippedWeapon, attackCooldown, ammo, characterId, characterName, currentJob, playerCash, onCashChange]);

  const selectWeapon = (weaponId: string) => {
    const weapon = WEAPONS.find(w => w.id === weaponId);
    if (weapon && ownedWeapons.includes(weaponId)) {
      setEquippedWeapon(weapon);
      setShowWeaponWheel(false);
      toast.success(`Equipped ${weapon.name}`);
    }
  };

  const respawnAtHospital = async () => {
    onHealthChange(100);
    await supabase.from('game_characters').update({
      health: 100,
      is_knocked_out: false,
      knocked_out_by: null,
      knocked_out_until: null,
      position_x: 100,
      position_y: 100,
    }).eq('id', characterId);
    toast.success('Respawned at hospital');
  };

  return {
    equippedWeapon,
    ownedWeapons,
    ammo,
    isAttacking,
    attackCooldown,
    showWeaponWheel,
    setShowWeaponWheel,
    nearbyPlayers,
    attack,
    selectWeapon,
    respawnAtHospital,
    loadInventory,
  };
}

// Combat HUD Component
export function CombatHUD({
  equippedWeapon,
  ammo,
  health,
  isAttacking,
  onAttack,
  onOpenWeapons,
  nearbyPlayers,
}: {
  equippedWeapon: Weapon;
  ammo: Record<string, number>;
  health: number;
  isAttacking: boolean;
  onAttack: (targetId?: string) => void;
  onOpenWeapons: () => void;
  nearbyPlayers: PlayerTarget[];
}) {
  return (
    <>
      {/* Health indicator on damage */}
      {health < 30 && (
        <div className="fixed inset-0 pointer-events-none z-20 border-8 border-red-500/50 animate-pulse" />
      )}

      {/* Attack crosshair */}
      {isAttacking && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none">
          <div className="animate-ping">
            <Target className="w-16 h-16 text-red-500" />
          </div>
        </div>
      )}

      {/* Nearby players targeting */}
      {nearbyPlayers.length > 0 && (
        <div className="fixed bottom-32 right-4 z-30 pointer-events-auto">
          <div className="bg-black/80 backdrop-blur-sm rounded-xl p-3 border border-white/10 max-w-[200px]">
            <div className="text-gray-400 text-xs mb-2 flex items-center gap-1">
              <Target className="w-3 h-3" /> TARGETS ({nearbyPlayers.length})
            </div>
            {nearbyPlayers.slice(0, 5).map(player => (
              <button
                key={player.id}
                onClick={() => onAttack(player.id)}
                className="w-full flex items-center justify-between py-2 px-2 border-b border-white/5 last:border-0 hover:bg-white/10 rounded transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Heart className="w-3 h-3 text-red-400" />
                  <span className="text-white text-sm truncate">{player.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 text-xs">{Math.round(player.distance)}m</span>
                  <Sword className="w-3 h-3 text-red-400" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Equipped weapon display */}
      <button
        onClick={onOpenWeapons}
        className="fixed bottom-4 left-4 z-30 pointer-events-auto flex items-center gap-2 bg-black/80 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10 hover:border-cyan-500/50 transition-all"
      >
        <span className="text-3xl">{equippedWeapon.icon}</span>
        <div className="text-left">
          <div className="text-white text-sm font-bold">{equippedWeapon.name}</div>
          <div className="text-gray-400 text-xs">
            {equippedWeapon.ammoCapacity > 0 
              ? `${ammo[equippedWeapon.id] || 0}/${equippedWeapon.ammoCapacity}`
              : `${equippedWeapon.damage} DMG`
            }
          </div>
        </div>
      </button>
    </>
  );
}

// Weapon Selection Wheel
export function WeaponWheel({
  isOpen,
  onClose,
  weapons,
  ownedWeapons,
  equippedWeapon,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  weapons: Weapon[];
  ownedWeapons: string[];
  equippedWeapon: Weapon;
  onSelect: (weaponId: string) => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-white/10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-400" />
            Weapons
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {weapons.map(weapon => {
            const owned = ownedWeapons.includes(weapon.id);
            const equipped = equippedWeapon.id === weapon.id;
            
            return (
              <button
                key={weapon.id}
                onClick={() => owned && onSelect(weapon.id)}
                disabled={!owned}
                className={`p-4 rounded-xl transition-all ${
                  equipped
                    ? 'bg-cyan-500/20 border-2 border-cyan-500'
                    : owned
                    ? 'bg-gray-800/50 border border-white/10 hover:border-cyan-500/50'
                    : 'bg-gray-800/20 border border-white/5 opacity-50'
                }`}
              >
                <span className="text-3xl">{weapon.icon}</span>
                <div className="mt-2 text-white font-medium text-sm">{weapon.name}</div>
                <div className="text-gray-400 text-xs">{weapon.damage} DMG</div>
                {!owned && (
                  <div className="text-red-400 text-xs mt-1">🔒 Locked</div>
                )}
                {equipped && (
                  <div className="text-cyan-400 text-xs mt-1 font-bold">EQUIPPED</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
