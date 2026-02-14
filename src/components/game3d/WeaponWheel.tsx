import { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { WEAPONS } from './GameCombat';

interface WeaponWheelProps {
  isOpen: boolean;
  onClose: () => void;
  equippedWeapon: string;
  ownedWeapons: string[];
  onSelectWeapon: (weaponId: string) => void;
}

const WEAPON_DISPLAY: Record<string, { name: string; icon: string; color: string }> = {
  fists: { name: 'Fists', icon: '👊', color: '#9ca3af' },
  knife: { name: 'Knife', icon: '🔪', color: '#a78bfa' },
  bat: { name: 'Baseball Bat', icon: '🏏', color: '#f59e0b' },
  pistol: { name: 'Pistol', icon: '🔫', color: '#3b82f6' },
  rifle: { name: 'Assault Rifle', icon: '🎯', color: '#ef4444' },
};

export default function WeaponWheel({ isOpen, onClose, equippedWeapon, ownedWeapons, onSelectWeapon }: WeaponWheelProps) {
  if (!isOpen) return null;

  const weapons = ['fists', ...ownedWeapons.filter(w => w !== 'fists')];
  const angleStep = (Math.PI * 2) / Math.max(weapons.length, 1);
  const radius = 90;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-[280px] h-[280px]">
        {/* Center circle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-gray-900/90 border-2 border-white/30 flex items-center justify-center z-10">
          <span className="text-2xl">{WEAPON_DISPLAY[equippedWeapon]?.icon || '👊'}</span>
        </div>

        {/* Weapon slots */}
        {weapons.map((weaponId, i) => {
          const angle = -Math.PI / 2 + angleStep * i;
          const x = Math.cos(angle) * radius + 140 - 32;
          const y = Math.sin(angle) * radius + 140 - 32;
          const display = WEAPON_DISPLAY[weaponId] || { name: weaponId, icon: '❓', color: '#666' };
          const isEquipped = weaponId === equippedWeapon;
          const weapon = WEAPONS[weaponId];

          return (
            <button
              key={weaponId}
              onClick={() => { onSelectWeapon(weaponId); onClose(); }}
              className={`absolute w-16 h-16 rounded-full flex flex-col items-center justify-center transition-all active:scale-90
                ${isEquipped 
                  ? 'bg-yellow-500/30 border-2 border-yellow-400 shadow-lg shadow-yellow-500/40' 
                  : 'bg-gray-800/80 border-2 border-white/20 hover:border-white/50'}`}
              style={{ left: x, top: y }}
            >
              <span className="text-xl">{display.icon}</span>
              <span className="text-[8px] text-white/70 font-bold mt-0.5">{display.name}</span>
            </button>
          );
        })}

        {/* Label */}
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-white/60 text-xs font-medium">
          TAP TO EQUIP
        </div>
      </div>
    </div>
  );
}
