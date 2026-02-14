import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Car, X, Gauge, Fuel } from 'lucide-react';
import * as THREE from 'three';

interface VehicleSystemProps {
  characterId: string;
  playerPosition: THREE.Vector3;
  playerRotation: number;
  isInVehicle: boolean;
  onEnterVehicle: (vehicle: OwnedVehicle) => void;
  onExitVehicle: () => void;
  onPositionUpdate: (pos: THREE.Vector3, rot: number) => void;
}

export interface OwnedVehicle {
  id: string;
  name: string;
  icon: string;
  speed: number;
  acceleration: number;
  handling: number;
  color: string;
}

const VEHICLE_STATS: Record<string, { speed: number; acceleration: number; handling: number; icon: string }> = {
  'car-1': { speed: 80, acceleration: 6, handling: 7, icon: '🚗' },
  'car-2': { speed: 120, acceleration: 8, handling: 8, icon: '🏎️' },
  'car-3': { speed: 100, acceleration: 7, handling: 6, icon: '🚘' },
  'car-4': { speed: 110, acceleration: 9, handling: 7, icon: '🚙' },
  'bike-1': { speed: 140, acceleration: 10, handling: 9, icon: '🏍️' },
  'boat-1': { speed: 90, acceleration: 5, handling: 4, icon: '🚤' },
};

export default function VehicleSystem({
  characterId,
  playerPosition,
  playerRotation,
  isInVehicle,
  onEnterVehicle,
  onExitVehicle,
  onPositionUpdate,
}: VehicleSystemProps) {
  const [ownedVehicles, setOwnedVehicles] = useState<OwnedVehicle[]>([]);
  const [showGarage, setShowGarage] = useState(false);
  const [currentVehicle, setCurrentVehicle] = useState<OwnedVehicle | null>(null);
  const [vehicleSpeed, setVehicleSpeed] = useState(0);
  const [fuel, setFuel] = useState(100);

  useEffect(() => {
    const raw = localStorage.getItem(`cf_vehicles_${characterId}`);
    if (raw) {
      try { setOwnedVehicles(JSON.parse(raw)); } catch {}
    }
  }, [characterId]);

  const spawnVehicle = useCallback((vehicle: OwnedVehicle) => {
    setCurrentVehicle(vehicle);
    onEnterVehicle(vehicle);
    setShowGarage(false);
    setFuel(100);
    toast.success(`${vehicle.name} spawned!`);
  }, [onEnterVehicle]);

  const exitVehicle = useCallback(() => {
    setCurrentVehicle(null);
    setVehicleSpeed(0);
    onExitVehicle();
  }, [onExitVehicle]);

  if (!isInVehicle && !showGarage) return null;

  if (showGarage && !isInVehicle) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowGarage(false)} />
        <div className="relative bg-gray-900/95 rounded-2xl p-6 max-w-md w-[90%] border border-white/10">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-white font-bold text-lg flex items-center gap-2"><Car className="w-5 h-5 text-cyan-400" /> My Garage</h2>
            <button onClick={() => setShowGarage(false)}><X className="w-5 h-5 text-gray-400" /></button>
          </div>
          {ownedVehicles.length === 0 ? (
            <div className="text-gray-400 text-center py-8">
              <Car className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No vehicles owned yet.</p>
              <p className="text-sm mt-1">Visit the Store to buy your first car!</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {ownedVehicles.map(v => (
                <button key={v.id} onClick={() => spawnVehicle(v)}
                  className="w-full flex items-center gap-3 p-3 bg-gray-800/60 rounded-xl border border-white/10 hover:border-cyan-500/50 transition-all active:scale-95">
                  <span className="text-3xl">{v.icon}</span>
                  <div className="flex-1 text-left">
                    <div className="text-white font-bold text-sm">{v.name}</div>
                    <div className="text-gray-400 text-xs">Speed: {v.speed} • Handling: {v.handling}</div>
                  </div>
                  <span className="text-cyan-400 text-xs font-bold">SPAWN</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isInVehicle && currentVehicle) {
    return (
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 pointer-events-auto">
        <div className="bg-black/80 backdrop-blur-sm rounded-xl px-4 py-2 border border-cyan-500/30 flex items-center gap-4">
          <span className="text-2xl">{currentVehicle.icon}</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Gauge className="w-4 h-4 text-cyan-400" />
              <span className="text-white font-bold text-sm">{Math.round(vehicleSpeed)} MPH</span>
            </div>
            <div className="flex items-center gap-1">
              <Fuel className="w-4 h-4 text-yellow-400" />
              <div className="w-12 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: `${fuel}%` }} />
              </div>
            </div>
          </div>
          <button onClick={exitVehicle} className="ml-2 px-3 py-1 bg-red-600/80 rounded-lg text-white text-xs font-bold active:scale-90">
            EXIT
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export function addVehicleToInventory(characterId: string, vehicleId: string, vehicleName: string) {
  const stats = VEHICLE_STATS[vehicleId] || { speed: 70, acceleration: 5, handling: 5, icon: '🚗' };
  const raw = localStorage.getItem(`cf_vehicles_${characterId}`);
  const vehicles: OwnedVehicle[] = raw ? JSON.parse(raw) : [];
  if (vehicles.some(v => v.id === vehicleId)) return;
  vehicles.push({
    id: vehicleId, name: vehicleName, icon: stats.icon,
    speed: stats.speed, acceleration: stats.acceleration, handling: stats.handling, color: '#ffffff',
  });
  localStorage.setItem(`cf_vehicles_${characterId}`, JSON.stringify(vehicles));
}

export function addWeaponToInventory(characterId: string, weaponId: string) {
  const raw = localStorage.getItem(`cf_weapons_${characterId}`);
  const weapons: string[] = raw ? JSON.parse(raw) : [];
  if (!weapons.includes(weaponId)) {
    weapons.push(weaponId);
    localStorage.setItem(`cf_weapons_${characterId}`, JSON.stringify(weapons));
  }
}

export const SHOP_TO_WEAPON: Record<string, string> = {
  'weapon-1': 'bat',
  'weapon-2': 'knife',
  'weapon-3': 'pistol',
  'weapon-5': 'rifle',
};
