import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Car, DollarSign, Fuel, Heart, Lock, Unlock, MapPin } from 'lucide-react';
import { toast } from 'sonner';

interface Vehicle {
  id: string;
  owner_id: string | null;
  vehicle_type: string;
  name: string;
  color: string;
  position_x: number;
  position_y: number;
  price: number;
  is_for_sale: boolean;
  fuel: number;
  health: number;
  is_locked: boolean;
  driver_id: string | null;
  max_speed: number;
}

interface VehicleMenuProps {
  character: {
    id: string;
    cash: number;
    bank_balance: number;
  };
  onClose: () => void;
  onCharacterUpdate: () => void;
  onEnterVehicle: (vehicle: Vehicle) => void;
}

const VEHICLE_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#ffffff', '#000000', '#64748b', '#78716c'
];

export default function VehicleMenu({ character, onClose, onCharacterUpdate, onEnterVehicle }: VehicleMenuProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [myVehicles, setMyVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVehicles();
  }, [character.id]);

  const fetchVehicles = async () => {
    const [forSaleRes, ownedRes] = await Promise.all([
      supabase.from('game_vehicles').select('*').eq('is_for_sale', true),
      supabase.from('game_vehicles').select('*').eq('owner_id', character.id)
    ]);
    
    if (forSaleRes.data) setVehicles(forSaleRes.data as Vehicle[]);
    if (ownedRes.data) setMyVehicles(ownedRes.data as Vehicle[]);
    setLoading(false);
  };

  const buyVehicle = async (vehicle: Vehicle) => {
    if (character.cash < vehicle.price) {
      toast.error('Not enough cash!');
      return;
    }

    const { error: updateCharError } = await supabase
      .from('game_characters')
      .update({ cash: character.cash - vehicle.price })
      .eq('id', character.id);

    if (updateCharError) {
      toast.error('Failed to process payment');
      return;
    }

    const { error: updateVehicleError } = await supabase
      .from('game_vehicles')
      .update({ 
        owner_id: character.id, 
        is_for_sale: false,
        position_x: character.id ? 550 : vehicle.position_x,
        position_y: character.id ? 400 : vehicle.position_y
      })
      .eq('id', vehicle.id);

    if (updateVehicleError) {
      toast.error('Failed to transfer ownership');
      return;
    }

    toast.success(`You bought a ${vehicle.name}!`);
    onCharacterUpdate();
    fetchVehicles();
  };

  const sellVehicle = async (vehicle: Vehicle) => {
    const sellPrice = Math.floor(vehicle.price * 0.6);
    
    const { error: updateCharError } = await supabase
      .from('game_characters')
      .update({ cash: character.cash + sellPrice })
      .eq('id', character.id);

    if (updateCharError) {
      toast.error('Failed to receive payment');
      return;
    }

    const { error: updateVehicleError } = await supabase
      .from('game_vehicles')
      .update({ 
        owner_id: null, 
        is_for_sale: true,
        position_x: 600 + Math.random() * 300,
        position_y: 200
      })
      .eq('id', vehicle.id);

    if (updateVehicleError) {
      toast.error('Failed to sell vehicle');
      return;
    }

    toast.success(`Sold ${vehicle.name} for $${sellPrice.toLocaleString()}!`);
    onCharacterUpdate();
    fetchVehicles();
  };

  const toggleLock = async (vehicle: Vehicle) => {
    const { error } = await supabase
      .from('game_vehicles')
      .update({ is_locked: !vehicle.is_locked })
      .eq('id', vehicle.id);

    if (error) {
      toast.error('Failed to toggle lock');
      return;
    }

    toast.success(vehicle.is_locked ? 'Vehicle unlocked!' : 'Vehicle locked!');
    fetchVehicles();
  };

  const enterVehicle = (vehicle: Vehicle) => {
    onEnterVehicle(vehicle);
    onClose();
  };

  const getVehicleIcon = (type: string) => {
    return <Car className="w-6 h-6" />;
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="w-5 h-5" /> Vehicle Dealership & Garage
          </DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground mb-4">
          Cash: <span className="text-green-500 font-bold">${character.cash.toLocaleString()}</span>
        </div>

        <Tabs defaultValue="dealership">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dealership">🏪 Dealership</TabsTrigger>
            <TabsTrigger value="garage">🏠 My Garage ({myVehicles.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="dealership" className="space-y-3 mt-4">
            {loading ? (
              <div className="text-center py-4">Loading vehicles...</div>
            ) : vehicles.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">No vehicles for sale</div>
            ) : (
              vehicles.map(vehicle => (
                <div key={vehicle.id} className="p-4 border rounded-lg flex items-center justify-between bg-card">
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-12 h-12 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: vehicle.color }}
                    >
                      {getVehicleIcon(vehicle.vehicle_type)}
                    </div>
                    <div>
                      <h4 className="font-semibold">{vehicle.name}</h4>
                      <p className="text-sm text-muted-foreground capitalize">
                        {vehicle.vehicle_type.replace('_', ' ')} • Max Speed: {vehicle.max_speed} mph
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-green-500">
                      ${vehicle.price.toLocaleString()}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => buyVehicle(vehicle)}
                      disabled={character.cash < vehicle.price}
                    >
                      Buy
                    </Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="garage" className="space-y-3 mt-4">
            {myVehicles.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                You don't own any vehicles yet
              </div>
            ) : (
              myVehicles.map(vehicle => (
                <div key={vehicle.id} className="p-4 border rounded-lg bg-card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-12 h-12 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: vehicle.color }}
                      >
                        {getVehicleIcon(vehicle.vehicle_type)}
                      </div>
                      <div>
                        <h4 className="font-semibold flex items-center gap-2">
                          {vehicle.name}
                          {vehicle.is_locked ? (
                            <Lock className="w-4 h-4 text-red-500" />
                          ) : (
                            <Unlock className="w-4 h-4 text-green-500" />
                          )}
                        </h4>
                        <p className="text-sm text-muted-foreground capitalize">
                          {vehicle.vehicle_type.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Fuel className="w-4 h-4" />
                      <div className="flex-1 bg-secondary rounded-full h-2">
                        <div 
                          className="bg-yellow-500 h-2 rounded-full" 
                          style={{ width: `${vehicle.fuel}%` }}
                        />
                      </div>
                      <span>{vehicle.fuel}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4" />
                      <div className="flex-1 bg-secondary rounded-full h-2">
                        <div 
                          className="bg-red-500 h-2 rounded-full" 
                          style={{ width: `${vehicle.health}%` }}
                        />
                      </div>
                      <span>{vehicle.health}%</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => toggleLock(vehicle)}>
                      {vehicle.is_locked ? <Unlock className="w-4 h-4 mr-1" /> : <Lock className="w-4 h-4 mr-1" />}
                      {vehicle.is_locked ? 'Unlock' : 'Lock'}
                    </Button>
                    <Button size="sm" onClick={() => enterVehicle(vehicle)} disabled={vehicle.driver_id !== null}>
                      <MapPin className="w-4 h-4 mr-1" /> Enter Vehicle
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => sellVehicle(vehicle)}>
                      <DollarSign className="w-4 h-4 mr-1" /> Sell (${Math.floor(vehicle.price * 0.6).toLocaleString()})
                    </Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
