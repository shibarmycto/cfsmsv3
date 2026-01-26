import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Car, MapPin, DollarSign, Clock, User } from 'lucide-react';
import { toast } from 'sonner';

interface TaxiFare {
  id: string;
  driver_id: string;
  passenger_id: string;
  vehicle_id: string;
  pickup_x: number;
  pickup_y: number;
  dropoff_x: number | null;
  dropoff_y: number | null;
  fare_amount: number;
  status: string;
  created_at: string;
  passenger?: {
    name: string;
  };
}

interface TaxiJobMenuProps {
  character: {
    id: string;
    name: string;
    cash: number;
    current_job: string;
    position_x: number;
    position_y: number;
  };
  currentVehicle: {
    id: string;
    vehicle_type: string;
  } | null;
  onClose: () => void;
  onCharacterUpdate: () => void;
}

export default function TaxiJobMenu({ character, currentVehicle, onClose, onCharacterUpdate }: TaxiJobMenuProps) {
  const [activeFares, setActiveFares] = useState<TaxiFare[]>([]);
  const [myFare, setMyFare] = useState<TaxiFare | null>(null);
  const [isOnDuty, setIsOnDuty] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFares();
    const channel = supabase
      .channel('taxi-fares')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_taxi_fares' }, () => {
        fetchFares();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [character.id]);

  const fetchFares = async () => {
    const [requestedRes, myFareRes] = await Promise.all([
      supabase
        .from('game_taxi_fares')
        .select('*, passenger:passenger_id(name)')
        .eq('status', 'requested'),
      supabase
        .from('game_taxi_fares')
        .select('*, passenger:passenger_id(name)')
        .eq('driver_id', character.id)
        .in('status', ['accepted', 'in_progress'])
        .maybeSingle()
    ]);

    if (requestedRes.data) {
      setActiveFares(requestedRes.data.map(fare => ({
        ...fare,
        passenger: fare.passenger ? { name: (fare.passenger as any).name } : undefined
      })));
    }
    if (myFareRes.data) {
      setMyFare({
        ...myFareRes.data,
        passenger: myFareRes.data.passenger ? { name: (myFareRes.data.passenger as any).name } : undefined
      });
    } else {
      setMyFare(null);
    }
    setLoading(false);
  };

  const requestTaxi = async () => {
    const { error } = await supabase.from('game_taxi_fares').insert({
      driver_id: character.id, // Will be updated when a driver accepts
      passenger_id: character.id,
      vehicle_id: '00000000-0000-0000-0000-000000000000', // Placeholder
      pickup_x: character.position_x,
      pickup_y: character.position_y,
      status: 'requested'
    });

    if (error) {
      toast.error('Failed to request taxi');
      return;
    }

    toast.success('Taxi requested! A driver will pick you up soon.');
    fetchFares();
  };

  const acceptFare = async (fare: TaxiFare) => {
    if (!currentVehicle || currentVehicle.vehicle_type !== 'taxi') {
      toast.error('You need to be driving a taxi!');
      return;
    }

    const { error } = await supabase
      .from('game_taxi_fares')
      .update({ 
        driver_id: character.id, 
        vehicle_id: currentVehicle.id,
        status: 'accepted' 
      })
      .eq('id', fare.id);

    if (error) {
      toast.error('Failed to accept fare');
      return;
    }

    toast.success(`Fare accepted! Pick up ${fare.passenger?.name || 'passenger'} at the marked location.`);
    fetchFares();
  };

  const startTrip = async () => {
    if (!myFare) return;

    const { error } = await supabase
      .from('game_taxi_fares')
      .update({ status: 'in_progress' })
      .eq('id', myFare.id);

    if (error) {
      toast.error('Failed to start trip');
      return;
    }

    toast.success('Trip started! Take the passenger to their destination.');
    fetchFares();
  };

  const completeTrip = async () => {
    if (!myFare) return;

    // Calculate fare based on distance
    const distance = Math.sqrt(
      Math.pow((character.position_x - myFare.pickup_x), 2) + 
      Math.pow((character.position_y - myFare.pickup_y), 2)
    );
    const fareAmount = Math.max(50, Math.floor(distance * 0.5));

    const { error: fareError } = await supabase
      .from('game_taxi_fares')
      .update({ 
        status: 'completed',
        dropoff_x: character.position_x,
        dropoff_y: character.position_y,
        fare_amount: fareAmount,
        completed_at: new Date().toISOString()
      })
      .eq('id', myFare.id);

    if (fareError) {
      toast.error('Failed to complete trip');
      return;
    }

    // Pay the driver
    const { error: payError } = await supabase
      .from('game_characters')
      .update({ cash: character.cash + fareAmount })
      .eq('id', character.id);

    if (payError) {
      toast.error('Failed to process payment');
      return;
    }

    toast.success(`Trip completed! You earned $${fareAmount}`);
    onCharacterUpdate();
    fetchFares();
  };

  const cancelFare = async (fareId: string) => {
    const { error } = await supabase
      .from('game_taxi_fares')
      .update({ status: 'cancelled' })
      .eq('id', fareId);

    if (error) {
      toast.error('Failed to cancel');
      return;
    }

    toast.success('Fare cancelled');
    fetchFares();
  };

  const isTaxiDriver = currentVehicle?.vehicle_type === 'taxi';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="w-5 h-5 text-yellow-500" /> Taxi Service
          </DialogTitle>
        </DialogHeader>

        {isTaxiDriver ? (
          <div className="space-y-4">
            <div className="p-3 bg-yellow-500/20 rounded-lg text-center">
              <p className="font-semibold">🚕 You're on taxi duty!</p>
              <p className="text-sm text-muted-foreground">Accept fares below to earn money</p>
            </div>

            {myFare ? (
              <div className="p-4 border rounded-lg bg-card">
                <h4 className="font-semibold mb-2">Current Fare</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>Passenger: {myFare.passenger?.name || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>Pickup: ({Math.round(myFare.pickup_x)}, {Math.round(myFare.pickup_y)})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>Status: {myFare.status}</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  {myFare.status === 'accepted' && (
                    <Button size="sm" onClick={startTrip}>
                      Passenger Picked Up
                    </Button>
                  )}
                  {myFare.status === 'in_progress' && (
                    <Button size="sm" onClick={completeTrip}>
                      <DollarSign className="w-4 h-4 mr-1" /> Complete Trip
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => cancelFare(myFare.id)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <h4 className="font-semibold">Available Fares</h4>
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : activeFares.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No fares available</p>
                ) : (
                  activeFares.map(fare => (
                    <div key={fare.id} className="p-3 border rounded-lg flex items-center justify-between">
                      <div>
                        <p className="font-medium">{fare.passenger?.name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">
                          Location: ({Math.round(fare.pickup_x)}, {Math.round(fare.pickup_y)})
                        </p>
                      </div>
                      <Button size="sm" onClick={() => acceptFare(fare)}>
                        Accept
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Need a ride? Request a taxi and a driver will pick you up!
            </p>
            
            <div className="p-4 bg-secondary rounded-lg">
              <h4 className="font-semibold mb-2">Your Location</h4>
              <p className="text-sm">
                <MapPin className="w-4 h-4 inline mr-1" />
                ({Math.round(character.position_x)}, {Math.round(character.position_y)})
              </p>
            </div>

            <Button className="w-full" onClick={requestTaxi}>
              <Car className="w-4 h-4 mr-2" /> Request Taxi
            </Button>

            <div className="text-center text-xs text-muted-foreground">
              Want to be a taxi driver? Buy a taxi from the dealership!
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
