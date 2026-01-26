interface VehicleSpriteProps {
  vehicle: {
    id: string;
    vehicle_type: string;
    name: string;
    color: string;
    position_x: number;
    position_y: number;
    rotation: number;
    driver_id: string | null;
    is_for_sale: boolean;
  };
  isPlayerDriving: boolean;
}

export default function VehicleSprite({ vehicle, isPlayerDriving }: VehicleSpriteProps) {
  const getVehicleSize = () => {
    switch (vehicle.vehicle_type) {
      case 'bicycle': return { width: 20, height: 35 };
      case 'motorcycle': return { width: 22, height: 40 };
      case 'sedan': return { width: 30, height: 50 };
      case 'sports_car': return { width: 28, height: 48 };
      case 'suv': return { width: 34, height: 55 };
      case 'truck': return { width: 38, height: 65 };
      case 'taxi': return { width: 30, height: 50 };
      case 'police_car': return { width: 32, height: 52 };
      case 'ambulance': return { width: 35, height: 60 };
      default: return { width: 30, height: 50 };
    }
  };

  const size = getVehicleSize();

  const renderVehicle = () => {
    switch (vehicle.vehicle_type) {
      case 'bicycle':
        return (
          <svg width={size.width} height={size.height} viewBox="0 0 20 35">
            <circle cx="10" cy="28" r="6" fill="none" stroke={vehicle.color} strokeWidth="2" />
            <circle cx="10" cy="8" r="6" fill="none" stroke={vehicle.color} strokeWidth="2" />
            <line x1="10" y1="8" x2="10" y2="28" stroke={vehicle.color} strokeWidth="2" />
            <line x1="6" y1="18" x2="14" y2="18" stroke={vehicle.color} strokeWidth="2" />
          </svg>
        );
      case 'motorcycle':
        return (
          <svg width={size.width} height={size.height} viewBox="0 0 22 40">
            <ellipse cx="11" cy="32" rx="6" ry="6" fill="#1a1a1a" />
            <ellipse cx="11" cy="8" rx="6" ry="6" fill="#1a1a1a" />
            <rect x="8" y="8" width="6" height="24" rx="2" fill={vehicle.color} />
            <rect x="5" y="14" width="12" height="6" rx="1" fill={vehicle.color} />
          </svg>
        );
      case 'taxi':
        return (
          <svg width={size.width} height={size.height} viewBox="0 0 30 50">
            <rect x="2" y="5" width="26" height="40" rx="4" fill="#fbbf24" />
            <rect x="5" y="10" width="20" height="12" rx="2" fill="#87ceeb" />
            <rect x="5" y="28" width="20" height="12" rx="2" fill="#87ceeb" />
            <rect x="8" y="0" width="14" height="6" rx="2" fill="#1a1a1a" />
            <text x="15" y="4" fontSize="4" fill="#fbbf24" textAnchor="middle">TAXI</text>
            <circle cx="6" cy="46" r="4" fill="#1a1a1a" />
            <circle cx="24" cy="46" r="4" fill="#1a1a1a" />
            <circle cx="6" cy="4" r="4" fill="#1a1a1a" />
            <circle cx="24" cy="4" r="4" fill="#1a1a1a" />
          </svg>
        );
      case 'police_car':
        return (
          <svg width={size.width} height={size.height} viewBox="0 0 32 52">
            <rect x="2" y="5" width="28" height="42" rx="4" fill="#1a1a1a" />
            <rect x="4" y="8" width="24" height="6" fill="#ffffff" />
            <rect x="4" y="38" width="24" height="6" fill="#ffffff" />
            <rect x="10" y="0" width="12" height="4" rx="1" fill="#ef4444" />
            <rect x="10" y="0" width="6" height="4" fill="#3b82f6" />
            <circle cx="7" cy="48" r="4" fill="#1a1a1a" />
            <circle cx="25" cy="48" r="4" fill="#1a1a1a" />
          </svg>
        );
      case 'ambulance':
        return (
          <svg width={size.width} height={size.height} viewBox="0 0 35 60">
            <rect x="2" y="5" width="31" height="50" rx="4" fill="#ffffff" />
            <rect x="12" y="20" width="11" height="3" fill="#ef4444" />
            <rect x="16" y="16" width="3" height="11" fill="#ef4444" />
            <rect x="5" y="8" width="25" height="10" rx="2" fill="#87ceeb" />
            <circle cx="8" cy="52" r="5" fill="#1a1a1a" />
            <circle cx="27" cy="52" r="5" fill="#1a1a1a" />
          </svg>
        );
      case 'sports_car':
        return (
          <svg width={size.width} height={size.height} viewBox="0 0 28 48">
            <rect x="2" y="8" width="24" height="32" rx="6" fill={vehicle.color} />
            <rect x="4" y="12" width="20" height="10" rx="2" fill="#1a1a1a" />
            <rect x="4" y="28" width="20" height="8" rx="2" fill="#1a1a1a" />
            <circle cx="5" cy="44" r="4" fill="#1a1a1a" />
            <circle cx="23" cy="44" r="4" fill="#1a1a1a" />
            <circle cx="5" cy="6" r="4" fill="#1a1a1a" />
            <circle cx="23" cy="6" r="4" fill="#1a1a1a" />
          </svg>
        );
      case 'suv':
        return (
          <svg width={size.width} height={size.height} viewBox="0 0 34 55">
            <rect x="2" y="5" width="30" height="45" rx="4" fill={vehicle.color} />
            <rect x="5" y="10" width="24" height="14" rx="2" fill="#87ceeb" />
            <rect x="5" y="30" width="24" height="14" rx="2" fill="#87ceeb" />
            <circle cx="7" cy="52" r="5" fill="#1a1a1a" />
            <circle cx="27" cy="52" r="5" fill="#1a1a1a" />
            <circle cx="7" cy="5" r="5" fill="#1a1a1a" />
            <circle cx="27" cy="5" r="5" fill="#1a1a1a" />
          </svg>
        );
      case 'truck':
        return (
          <svg width={size.width} height={size.height} viewBox="0 0 38 65">
            <rect x="4" y="25" width="30" height="35" rx="2" fill="#64748b" />
            <rect x="2" y="5" width="34" height="22" rx="4" fill={vehicle.color} />
            <rect x="6" y="10" width="26" height="12" rx="2" fill="#87ceeb" />
            <circle cx="8" cy="62" r="5" fill="#1a1a1a" />
            <circle cx="30" cy="62" r="5" fill="#1a1a1a" />
            <circle cx="8" cy="5" r="5" fill="#1a1a1a" />
            <circle cx="30" cy="5" r="5" fill="#1a1a1a" />
          </svg>
        );
      default: // sedan
        return (
          <svg width={size.width} height={size.height} viewBox="0 0 30 50">
            <rect x="2" y="5" width="26" height="40" rx="4" fill={vehicle.color} />
            <rect x="5" y="10" width="20" height="12" rx="2" fill="#87ceeb" />
            <rect x="5" y="28" width="20" height="12" rx="2" fill="#87ceeb" />
            <circle cx="6" cy="46" r="4" fill="#1a1a1a" />
            <circle cx="24" cy="46" r="4" fill="#1a1a1a" />
            <circle cx="6" cy="4" r="4" fill="#1a1a1a" />
            <circle cx="24" cy="4" r="4" fill="#1a1a1a" />
          </svg>
        );
    }
  };

  return (
    <div
      className="absolute transition-all duration-75"
      style={{
        left: vehicle.position_x - size.width / 2,
        top: vehicle.position_y - size.height / 2,
        zIndex: Math.floor(vehicle.position_y) - 1,
        transform: `rotate(${vehicle.rotation}deg)`,
      }}
    >
      {/* Vehicle name tag */}
      {vehicle.is_for_sale && (
        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap text-[10px] px-2 py-0.5 rounded bg-green-500 text-white font-bold">
          ${vehicle.name} - FOR SALE
        </div>
      )}
      
      {isPlayerDriving && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
        </div>
      )}
      
      {renderVehicle()}
    </div>
  );
}
