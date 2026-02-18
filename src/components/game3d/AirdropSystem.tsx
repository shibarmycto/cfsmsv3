import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Gift, MapPin, X, Coins } from 'lucide-react';
import { gameSounds } from './GameSoundSystem';

interface AirdropVoucher {
  id: string;
  amount_sol: number;
  description: string;
  position_x: number;
  position_z: number;
  is_active: boolean;
  claimed_by: string | null;
  created_at: string;
}

interface AirdropSystemProps {
  characterId: string;
  playerX: number;
  playerZ: number;
  solanaBalance: number | null;
  walletAddress: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AirdropMarker({ distance }: { distance: number }) {
  if (distance > 100) return null;
  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none animate-pulse">
      <div className="bg-purple-600/80 backdrop-blur-sm rounded-xl px-4 py-2 border border-purple-400/50 flex items-center gap-2">
        <Gift className="w-5 h-5 text-yellow-300" />
        <span className="text-white font-bold text-sm">
          AIRDROP {Math.round(distance)}m nearby
        </span>
        <Coins className="w-4 h-4 text-yellow-400" />
      </div>
    </div>
  );
}

export default function AirdropSystem({
  characterId,
  playerX,
  playerZ,
  solanaBalance,
  walletAddress,
  isOpen,
  onClose
}: AirdropSystemProps) {
  const [airdrops, setAirdrops] = useState<AirdropVoucher[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);

  const fetchAirdrops = useCallback(async () => {
    const { data } = await supabase
      .from('game_airdrops' as any)
      .select('*')
      .eq('is_active', true)
      .is('claimed_by', null)
      .order('created_at', { ascending: false });
    
    if (data) setAirdrops(data as any as AirdropVoucher[]);
  }, []);

  useEffect(() => {
    if (isOpen) fetchAirdrops();
  }, [isOpen, fetchAirdrops]);

  useEffect(() => {
    const interval = setInterval(fetchAirdrops, 5000);
    return () => clearInterval(interval);
  }, [fetchAirdrops]);

  const claimAirdrop = async (airdrop: AirdropVoucher) => {
    const dx = playerX - airdrop.position_x;
    const dz = playerZ - airdrop.position_z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    
    if (dist > 15) {
      toast.error(`Too far! Get within 15m (currently ${Math.round(dist)}m away)`);
      return;
    }
    if (!walletAddress) {
      toast.error('Connect your Solana wallet to claim airdrops!');
      return;
    }

    setClaiming(airdrop.id);
    
    const { error } = await supabase
      .from('game_airdrops' as any)
      .update({ 
        claimed_by: characterId, 
        is_active: false,
        claimed_at: new Date().toISOString()
      } as any)
      .eq('id', airdrop.id)
      .is('claimed_by', null);

    if (error) {
      toast.error('Already claimed by someone else!');
    } else {
      gameSounds.playAirdropCollect();
      toast.success(`🎉 Claimed ${airdrop.amount_sol} SOL airdrop!`);
      setAirdrops(prev => prev.filter(a => a.id !== airdrop.id));
    }
    setClaiming(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-[95%] max-w-lg bg-gray-900/95 backdrop-blur-md rounded-2xl border border-purple-500/30 overflow-hidden">
        <div className="p-4 border-b border-white/10 bg-gradient-to-r from-purple-600/20 to-pink-600/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Gift className="w-6 h-6 text-purple-400" />
              <div>
                <h2 className="text-lg font-bold text-white">SOL Airdrop Market</h2>
                <p className="text-xs text-gray-400">Hunt airdrops on the map to earn SOL</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          
          <div className="mt-3 p-3 bg-black/30 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Your SOL Balance</span>
              <span className="text-green-400 font-bold">
                {solanaBalance !== null ? `${solanaBalance.toFixed(4)} SOL` : 'Not connected'}
              </span>
            </div>
            {walletAddress && (
              <div className="text-xs text-gray-500 mt-1 truncate">
                Wallet: {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
          {airdrops.length === 0 ? (
            <div className="text-center py-8">
              <Gift className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No active airdrops</p>
              <p className="text-gray-500 text-sm mt-1">Admin will drop SOL vouchers soon!</p>
            </div>
          ) : (
            airdrops.map(airdrop => {
              const dx = playerX - airdrop.position_x;
              const dz = playerZ - airdrop.position_z;
              const dist = Math.sqrt(dx * dx + dz * dz);
              const canClaim = dist <= 15;

              return (
                <div 
                  key={airdrop.id}
                  className={`p-4 rounded-xl border transition-all ${
                    canClaim 
                      ? 'bg-purple-500/20 border-purple-400/50' 
                      : 'bg-gray-800/50 border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        canClaim ? 'bg-purple-500 animate-pulse' : 'bg-gray-700'
                      }`}>
                        <Coins className="w-5 h-5 text-yellow-300" />
                      </div>
                      <div>
                        <div className="text-white font-bold">{airdrop.amount_sol} SOL</div>
                        <div className="text-xs text-gray-400">{airdrop.description || 'Airdrop voucher'}</div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <MapPin className="w-3 h-3" />
                        {Math.round(dist)}m away
                      </div>
                      <button
                        onClick={() => claimAirdrop(airdrop)}
                        disabled={!canClaim || claiming === airdrop.id || !walletAddress}
                        className={`mt-1 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          canClaim && walletAddress
                            ? 'bg-purple-500 text-white hover:bg-purple-400'
                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {claiming === airdrop.id ? 'Claiming...' : canClaim ? 'CLAIM' : 'TOO FAR'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
