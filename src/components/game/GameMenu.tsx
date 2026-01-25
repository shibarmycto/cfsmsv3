import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Briefcase, Users, Home, DollarSign, UserPlus, Shield, Skull, Car, Wrench, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';

interface GameMenuProps {
  menuType: string;
  character: any;
  properties: any[];
  otherPlayers: any[];
  onClose: () => void;
  onCharacterUpdate: () => void;
}

type JobType = 'police' | 'medic' | 'taxi_driver' | 'mechanic' | 'criminal';

const JOB_INFO: Record<JobType, { icon: typeof Shield; salary: number; description: string; color: string }> = {
  police: { icon: Shield, salary: 150, description: 'Catch criminals and keep the city safe', color: 'text-blue-500' },
  medic: { icon: Stethoscope, salary: 120, description: 'Save lives and help injured players', color: 'text-green-500' },
  taxi_driver: { icon: Car, salary: 80, description: 'Drive passengers around the city', color: 'text-yellow-500' },
  mechanic: { icon: Wrench, salary: 100, description: 'Repair and modify vehicles', color: 'text-orange-500' },
  criminal: { icon: Skull, salary: 0, description: 'Live on the edge (risky but rewarding)', color: 'text-red-500' },
};

export default function GameMenu({ menuType, character, properties, otherPlayers, onClose, onCharacterUpdate }: GameMenuProps) {
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const handleJobChange = async (job: string) => {
    try {
      const { error } = await supabase
        .from('game_characters')
        .update({ current_job: job as any, job_experience: 0 })
        .eq('id', character.id);

      if (error) throw error;
      
      toast.success(`You are now a ${job.replace('_', ' ')}!`);
      onCharacterUpdate();
      onClose();
    } catch (error) {
      toast.error('Failed to change job');
    }
  };

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (amount > character.cash) {
      toast.error('Not enough cash');
      return;
    }

    try {
      const { error } = await supabase
        .from('game_characters')
        .update({
          cash: character.cash - amount,
          bank_balance: character.bank_balance + amount,
        })
        .eq('id', character.id);

      if (error) throw error;
      
      toast.success(`Deposited $${amount.toLocaleString()}`);
      setDepositAmount('');
      onCharacterUpdate();
    } catch (error) {
      toast.error('Failed to deposit');
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (amount > character.bank_balance) {
      toast.error('Not enough in bank');
      return;
    }

    try {
      const { error } = await supabase
        .from('game_characters')
        .update({
          cash: character.cash + amount,
          bank_balance: character.bank_balance - amount,
        })
        .eq('id', character.id);

      if (error) throw error;
      
      toast.success(`Withdrew $${amount.toLocaleString()}`);
      setWithdrawAmount('');
      onCharacterUpdate();
    } catch (error) {
      toast.error('Failed to withdraw');
    }
  };

  const handleBuyProperty = async (property: any) => {
    if (character.bank_balance < property.price) {
      toast.error('Not enough money in bank');
      return;
    }

    try {
      // Deduct money
      const { error: moneyError } = await supabase
        .from('game_characters')
        .update({ bank_balance: character.bank_balance - property.price })
        .eq('id', character.id);

      if (moneyError) throw moneyError;

      // Transfer ownership
      const { error: propError } = await supabase
        .from('game_properties')
        .update({ owner_id: character.id, is_for_sale: false })
        .eq('id', property.id);

      if (propError) throw propError;

      toast.success(`You bought ${property.name}!`);
      onCharacterUpdate();
      onClose();
    } catch (error) {
      toast.error('Failed to buy property');
    }
  };

  const renderContent = () => {
    // Property menu
    if (menuType.startsWith('property-')) {
      const propertyId = menuType.replace('property-', '');
      const property = properties.find(p => p.id === propertyId);
      
      if (!property) return null;

      const isOwner = property.owner_id === character.id;

      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Home className="w-8 h-8 text-primary" />
            <div>
              <h3 className="font-bold text-lg">{property.name}</h3>
              <p className="text-sm text-muted-foreground capitalize">
                {property.property_type.replace('_', ' ')}
              </p>
            </div>
          </div>

          {property.is_for_sale ? (
            <div className="space-y-3">
              <p className="text-2xl font-bold text-green-500">${property.price.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">
                Your bank balance: ${character.bank_balance.toLocaleString()}
              </p>
              <Button 
                className="w-full" 
                onClick={() => handleBuyProperty(property)}
                disabled={character.bank_balance < property.price}
              >
                {character.bank_balance < property.price ? 'Not Enough Money' : 'Buy Property'}
              </Button>
            </div>
          ) : isOwner ? (
            <div className="text-center py-4">
              <p className="text-primary font-medium">You own this property!</p>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">This property is not for sale</p>
          )}
        </div>
      );
    }

    // Jobs menu
    if (menuType === 'jobs') {
      return (
        <div className="space-y-3">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Briefcase className="w-5 h-5" /> Employment Office
          </h3>
          <p className="text-sm text-muted-foreground">
            Current job: <span className="text-primary capitalize">{character.current_job.replace('_', ' ')}</span>
          </p>
          
          <div className="space-y-2 mt-4">
            {Object.entries(JOB_INFO).map(([job, info]) => {
              const Icon = info.icon;
              const isCurrent = character.current_job === job;
              
              return (
                <div 
                  key={job}
                  className={`p-3 rounded-lg border ${isCurrent ? 'border-primary bg-primary/10' : 'border-border'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${info.color}`} />
                      <div>
                        <p className="font-medium capitalize">{job.replace('_', ' ')}</p>
                        <p className="text-xs text-muted-foreground">{info.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {info.salary > 0 && (
                        <p className="text-sm text-green-500">${info.salary}/shift</p>
                      )}
                      {!isCurrent && (
                        <Button size="sm" variant="outline" onClick={() => handleJobChange(job)}>
                          Apply
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Players menu
    if (menuType === 'players') {
      return (
        <div className="space-y-3">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Users className="w-5 h-5" /> Online Players ({otherPlayers.length + 1})
          </h3>
          
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {/* Current player */}
            <div className="p-2 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-between">
              <div>
                <p className="font-medium">{character.name} (You)</p>
                <p className="text-xs text-muted-foreground capitalize">{character.current_job.replace('_', ' ')}</p>
              </div>
            </div>
            
            {otherPlayers.map(player => (
              <div key={player.id} className="p-2 rounded-lg border border-border flex items-center justify-between">
                <div>
                  <p className="font-medium">{player.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{player.current_job.replace('_', ' ')}</p>
                </div>
                <Button size="sm" variant="ghost">
                  <UserPlus className="w-4 h-4" />
                </Button>
              </div>
            ))}
            
            {otherPlayers.length === 0 && (
              <p className="text-center text-muted-foreground py-4">No other players online</p>
            )}
          </div>
        </div>
      );
    }

    // Bank menu
    if (menuType === 'bank') {
      return (
        <div className="space-y-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <DollarSign className="w-5 h-5" /> Bank of CF
          </h3>
          
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-secondary/50 rounded-lg p-3">
              <p className="text-2xl font-bold text-green-500">${character.cash.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Cash on Hand</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3">
              <p className="text-2xl font-bold text-blue-500">${character.bank_balance.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Bank Balance</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm mb-1">Deposit Cash</p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="Amount..."
                />
                <Button onClick={handleDeposit}>Deposit</Button>
              </div>
            </div>
            
            <div>
              <p className="text-sm mb-1">Withdraw</p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Amount..."
                />
                <Button variant="outline" onClick={handleWithdraw}>Withdraw</Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto animate-scale-in">
        <div className="flex justify-between items-start mb-4">
          <div />
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        {renderContent()}
      </div>
    </div>
  );
}
