import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { X, Skull, Search, AlertTriangle, Shield, HandMetal } from 'lucide-react';
import { toast } from 'sonner';

interface CrimeSystemProps {
  character: any;
  targetPlayer: any;
  onClose: () => void;
  onCharacterUpdate: () => void;
}

export default function CrimeSystem({ character, targetPlayer, onClose, onCharacterUpdate }: CrimeSystemProps) {
  const [isKnockingOut, setIsKnockingOut] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isArresting, setIsArresting] = useState(false);

  const handleKnockOut = async () => {
    if (character.current_job === 'police') {
      toast.error('Police officers cannot commit crimes!');
      return;
    }

    setIsKnockingOut(true);
    try {
      // 50% chance to knock out
      const success = Math.random() > 0.5;
      
      if (success) {
        const knockOutDuration = 30000; // 30 seconds
        const knockedOutUntil = new Date(Date.now() + knockOutDuration);

        await supabase
          .from('game_characters')
          .update({
            is_knocked_out: true,
            knocked_out_until: knockedOutUntil.toISOString(),
            knocked_out_by: character.id
          })
          .eq('id', targetPlayer.id);

        // Increase wanted level
        const newWantedLevel = Math.min((character.wanted_level || 0) + 1, 5);
        await supabase
          .from('game_characters')
          .update({ 
            wanted_level: newWantedLevel,
            total_crimes: (character.total_crimes || 0) + 1
          })
          .eq('id', character.id);

        // Log the crime
        await supabase.from('game_crime_logs').insert({
          criminal_id: character.id,
          victim_id: targetPlayer.id,
          crime_type: 'assault',
          wanted_level_added: 1,
          location_x: character.position_x,
          location_y: character.position_y
        });

        toast.success(`You knocked out ${targetPlayer.name}! Wanted level +1`);
        onCharacterUpdate();
      } else {
        toast.error('Attack failed! They dodged your attack.');
      }
    } catch (error) {
      toast.error('Failed to attack');
    }
    setIsKnockingOut(false);
  };

  const handleSearch = async () => {
    if (!targetPlayer.is_knocked_out) {
      toast.error('Target must be knocked out first!');
      return;
    }

    setIsSearching(true);
    try {
      const stolenCash = Math.min(targetPlayer.cash, Math.floor(Math.random() * 500) + 100);
      
      if (stolenCash > 0) {
        // Take cash from victim
        await supabase
          .from('game_characters')
          .update({ cash: targetPlayer.cash - stolenCash })
          .eq('id', targetPlayer.id);

        // Give cash to robber
        await supabase
          .from('game_characters')
          .update({ 
            cash: character.cash + stolenCash,
            wanted_level: Math.min((character.wanted_level || 0) + 2, 5),
            total_crimes: (character.total_crimes || 0) + 1
          })
          .eq('id', character.id);

        // Log the crime
        await supabase.from('game_crime_logs').insert({
          criminal_id: character.id,
          victim_id: targetPlayer.id,
          crime_type: 'robbery',
          amount_stolen: stolenCash,
          wanted_level_added: 2,
          location_x: character.position_x,
          location_y: character.position_y
        });

        toast.success(`You robbed $${stolenCash.toLocaleString()} from ${targetPlayer.name}! Wanted level +2`);
        onCharacterUpdate();
        onClose();
      } else {
        toast.error('They have no cash to steal!');
      }
    } catch (error) {
      toast.error('Failed to rob');
    }
    setIsSearching(false);
  };

  const handleArrest = async () => {
    if (character.current_job !== 'police') {
      toast.error('Only police officers can arrest!');
      return;
    }

    if ((targetPlayer.wanted_level || 0) < 1) {
      toast.error('This person is not wanted!');
      return;
    }

    setIsArresting(true);
    try {
      const fine = (targetPlayer.wanted_level || 1) * 200;
      const targetCash = targetPlayer.cash || 0;
      const actualFine = Math.min(fine, targetCash);

      // Reset criminal's wanted level and take fine
      await supabase
        .from('game_characters')
        .update({
          wanted_level: 0,
          cash: targetCash - actualFine,
          is_knocked_out: false,
          knocked_out_by: null,
          knocked_out_until: null
        })
        .eq('id', targetPlayer.id);

      // Reward officer
      const reward = Math.floor(actualFine * 0.5);
      await supabase
        .from('game_characters')
        .update({
          cash: character.cash + reward,
          job_experience: (character.job_experience || 0) + 10,
          arrests: (character.arrests || 0) + 1
        })
        .eq('id', character.id);

      // Log the arrest
      await supabase.from('game_crime_logs').insert({
        criminal_id: targetPlayer.id,
        victim_id: character.id,
        crime_type: 'arrest',
        amount_stolen: -actualFine,
        location_x: character.position_x,
        location_y: character.position_y
      });

      toast.success(`Arrested ${targetPlayer.name}! Fine: $${actualFine}, Your reward: $${reward}`);
      onCharacterUpdate();
      onClose();
    } catch (error) {
      toast.error('Failed to arrest');
    }
    setIsArresting(false);
  };

  const isPolice = character.current_job === 'police';
  const targetIsKnockedOut = targetPlayer.is_knocked_out;
  const targetWantedLevel = targetPlayer.wanted_level || 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md animate-scale-in">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            {isPolice ? (
              <>
                <Shield className="w-6 h-6 text-blue-500" />
                Police Actions
              </>
            ) : (
              <>
                <Skull className="w-6 h-6 text-destructive" />
                Criminal Actions
              </>
            )}
          </h2>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Target Info */}
        <div className="bg-secondary/50 rounded-lg p-4 mb-4">
          <p className="font-medium">{targetPlayer.name}</p>
          <div className="flex gap-4 text-sm text-muted-foreground mt-1">
            <span>Cash: ${(targetPlayer.cash || 0).toLocaleString()}</span>
            {targetWantedLevel > 0 && (
              <span className="text-destructive flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Wanted Lv.{targetWantedLevel}
              </span>
            )}
            {targetIsKnockedOut && (
              <span className="text-yellow-500">Knocked Out</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {isPolice ? (
            // Police actions
            <Button
              className="w-full"
              variant="default"
              onClick={handleArrest}
              disabled={isArresting || targetWantedLevel < 1}
            >
              <Shield className="w-4 h-4 mr-2" />
              {isArresting ? 'Arresting...' : `Arrest Criminal (Wanted Lv.${targetWantedLevel})`}
            </Button>
          ) : (
            // Criminal actions
            <>
              <Button
                className="w-full"
                variant="destructive"
                onClick={handleKnockOut}
                disabled={isKnockingOut || targetIsKnockedOut}
              >
                <HandMetal className="w-4 h-4 mr-2" />
                {isKnockingOut ? 'Attacking...' : targetIsKnockedOut ? 'Already Knocked Out' : 'Knock Out (50% chance)'}
              </Button>

              <Button
                className="w-full"
                variant="outline"
                onClick={handleSearch}
                disabled={isSearching || !targetIsKnockedOut}
              >
                <Search className="w-4 h-4 mr-2" />
                {isSearching ? 'Searching...' : 'Search & Rob'}
              </Button>
            </>
          )}
        </div>

        {/* Warnings */}
        <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {isPolice 
              ? 'Arresting criminals rewards you with a portion of their fine.'
              : 'Crimes increase your wanted level. Police can arrest you!'}
          </p>
        </div>
      </div>
    </div>
  );
}
