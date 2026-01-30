import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Sword, Shield, Heart, Skull, Target } from 'lucide-react';

interface Weapon {
  id: string;
  name: string;
  weapon_type: string;
  damage: number;
  range: number;
  price: number;
  ammo_capacity: number;
  icon: string;
}

interface InventoryItem {
  id: string;
  weapon_id: string;
  ammo: number;
  is_equipped: boolean;
  weapon?: Weapon;
}

interface CombatSystemProps {
  characterId: string;
  characterName: string;
  currentHealth: number;
  currentJob: string;
  onHealthChange: (health: number) => void;
  onKill: (victimName: string) => void;
  nearbyPlayers: { id: string; name: string; distance: number }[];
}

export default function CombatSystem({
  characterId,
  characterName,
  currentHealth,
  currentJob,
  onHealthChange,
  onKill,
  nearbyPlayers
}: CombatSystemProps) {
  const [weapons, setWeapons] = useState<Weapon[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [equippedWeapon, setEquippedWeapon] = useState<Weapon | null>(null);
  const [isAttacking, setIsAttacking] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [attackCooldown, setAttackCooldown] = useState(false);

  // Load weapons and inventory
  useEffect(() => {
    loadWeapons();
    loadInventory();
  }, [characterId]);

  const loadWeapons = async () => {
    const { data } = await supabase.from('game_weapons').select('*');
    if (data) setWeapons(data);
  };

  const loadInventory = async () => {
    const { data } = await supabase
      .from('game_player_inventory')
      .select('*, weapon:game_weapons(*)')
      .eq('character_id', characterId);
    
    if (data) {
      setInventory(data as any);
      const equipped = data.find((item: any) => item.is_equipped);
      if (equipped?.weapon) {
        setEquippedWeapon(equipped.weapon);
      }
    }
  };

  const equipWeapon = async (inventoryItem: InventoryItem) => {
    // Unequip all first
    await supabase
      .from('game_player_inventory')
      .update({ is_equipped: false })
      .eq('character_id', characterId);

    // Equip selected
    await supabase
      .from('game_player_inventory')
      .update({ is_equipped: true })
      .eq('id', inventoryItem.id);

    if (inventoryItem.weapon) {
      setEquippedWeapon(inventoryItem.weapon);
      toast.success(`Equipped ${inventoryItem.weapon.name}`);
    }
    
    await supabase
      .from('game_characters')
      .update({ equipped_weapon: inventoryItem.weapon?.name || 'fists' })
      .eq('id', characterId);

    loadInventory();
  };

  const attack = useCallback(async (targetId: string, targetName: string) => {
    if (attackCooldown || !equippedWeapon) return;

    setIsAttacking(true);
    setAttackCooldown(true);

    const damage = equippedWeapon.damage + Math.floor(Math.random() * 10);

    // Log combat
    await supabase.from('game_combat_logs').insert({
      attacker_id: characterId,
      victim_id: targetId,
      weapon_used: equippedWeapon.name,
      damage_dealt: damage,
      is_kill: false
    });

    // Apply damage to target (in a real game, this would be server-side)
    const { data: target } = await supabase
      .from('game_characters')
      .select('health, name')
      .eq('id', targetId)
      .single();

    if (target) {
      const newHealth = Math.max(0, target.health - damage);
      const isKill = newHealth <= 0;

      await supabase
        .from('game_characters')
        .update({ 
          health: isKill ? 100 : newHealth,
          is_knocked_out: isKill,
          knocked_out_by: isKill ? characterId : null,
          knocked_out_until: isKill ? new Date(Date.now() + 30000).toISOString() : null
        })
        .eq('id', targetId);

      if (isKill) {
        // Update combat log
        await supabase.from('game_combat_logs').insert({
          attacker_id: characterId,
          victim_id: targetId,
          weapon_used: equippedWeapon.name,
          damage_dealt: damage,
          is_kill: true
        });

        // Get current stats and increment
        const { data: currentStats } = await supabase
          .from('game_characters')
          .select('kills, wanted_level')
          .eq('id', characterId)
          .single();

        if (currentStats) {
          // Update kill count
          await supabase.from('game_characters').update({
            kills: (currentStats.kills || 0) + 1
          }).eq('id', characterId);

          // Add wanted level for civilians
          if (currentJob !== 'police') {
            await supabase.from('game_characters').update({
              wanted_level: Math.min(5, (currentStats.wanted_level || 0) + 1)
            }).eq('id', characterId);
          }
        }

        onKill(targetName);
        toast.success(`You knocked out ${targetName}!`);
      } else {
        toast.info(`Hit ${targetName} for ${damage} damage!`);
      }
    }

    setTimeout(() => setIsAttacking(false), 300);
    setTimeout(() => setAttackCooldown(false), 1000); // 1 second cooldown
  }, [characterId, equippedWeapon, currentJob, attackCooldown, onKill]);

  // Police arrest function
  const arrestPlayer = useCallback(async (targetId: string, targetName: string) => {
    if (currentJob !== 'police') {
      toast.error('Only police can arrest players!');
      return;
    }

    const { data: target } = await supabase
      .from('game_characters')
      .select('wanted_level, is_knocked_out')
      .eq('id', targetId)
      .single();

    if (!target) return;

    if (target.wanted_level === 0) {
      toast.error('Player has no wanted level!');
      return;
    }

    if (!target.is_knocked_out) {
      toast.error('You must knock out the player first!');
      return;
    }

    // Arrest the player
    const jailDuration = target.wanted_level * 4; // 4 mins per star, max 20 mins
    const jailUntil = new Date(Date.now() + jailDuration * 60000);

    await supabase.from('game_characters').update({
      is_in_jail: true,
      jail_until: jailUntil.toISOString(),
      jail_reason: `Arrested by ${characterName}`,
      wanted_level: 0,
      is_knocked_out: false,
      knocked_out_by: null,
      knocked_out_until: null
    }).eq('id', targetId);

    // Log the arrest
    await supabase.from('game_jail_logs').insert({
      character_id: targetId,
      arrested_by: characterId,
      reason: `Arrested for wanted level ${target.wanted_level}`,
      jail_duration_minutes: jailDuration
    });

    toast.success(`Arrested ${targetName} for ${jailDuration} minutes!`);
  }, [characterId, characterName, currentJob]);

  return (
    <>
      {/* Combat HUD overlay */}
      <div className="fixed bottom-28 left-4 z-25 pointer-events-auto">
        {/* Equipped weapon */}
        <button
          onClick={() => setShowInventory(!showInventory)}
          className="flex items-center gap-2 bg-black/80 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/10"
        >
          <span className="text-2xl">{equippedWeapon?.icon || '👊'}</span>
          <div className="text-left">
            <div className="text-white text-sm font-bold">{equippedWeapon?.name || 'Fists'}</div>
            <div className="text-gray-400 text-xs">
              {equippedWeapon ? `${equippedWeapon.damage} DMG` : '5 DMG'}
            </div>
          </div>
        </button>
      </div>

      {/* Attack indicator */}
      {isAttacking && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none">
          <div className="animate-ping">
            <Target className="w-12 h-12 text-red-500" />
          </div>
        </div>
      )}

      {/* Nearby players for targeting */}
      {nearbyPlayers.length > 0 && (
        <div className="fixed bottom-40 right-4 z-25 pointer-events-auto">
          <div className="bg-black/80 backdrop-blur-sm rounded-xl p-3 border border-white/10 max-w-[200px]">
            <div className="text-gray-400 text-xs mb-2 flex items-center gap-1">
              <Target className="w-3 h-3" /> NEARBY PLAYERS
            </div>
            {nearbyPlayers.slice(0, 5).map(player => (
              <div
                key={player.id}
                className="flex items-center justify-between py-1 border-b border-white/5 last:border-0"
              >
                <span className="text-white text-sm truncate">{player.name}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => attack(player.id, player.name)}
                    disabled={attackCooldown}
                    className="p-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/40 disabled:opacity-50"
                  >
                    <Sword className="w-3 h-3" />
                  </button>
                  {currentJob === 'police' && (
                    <button
                      onClick={() => arrestPlayer(player.id, player.name)}
                      className="p-1.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/40"
                    >
                      <Shield className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weapon inventory modal */}
      {showInventory && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-white/10">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Sword className="w-5 h-5 text-red-400" />
                Weapons
              </h2>
              <button
                onClick={() => setShowInventory(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {inventory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Skull className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No weapons in inventory</p>
                <p className="text-sm">Visit a gun shop to purchase weapons</p>
              </div>
            ) : (
              <div className="space-y-2">
                {inventory.map(item => (
                  <button
                    key={item.id}
                    onClick={() => equipWeapon(item)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                      item.is_equipped
                        ? 'bg-cyan-500/20 border border-cyan-500/50'
                        : 'bg-gray-800/50 border border-white/5 hover:border-white/20'
                    }`}
                  >
                    <span className="text-3xl">{item.weapon?.icon || '🔫'}</span>
                    <div className="text-left flex-1">
                      <div className="text-white font-bold">{item.weapon?.name}</div>
                      <div className="text-gray-400 text-xs">
                        {item.weapon?.damage} DMG • {item.weapon?.range}m Range
                      </div>
                    </div>
                    {item.is_equipped && (
                      <span className="text-cyan-400 text-xs font-bold">EQUIPPED</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
