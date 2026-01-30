import { useState } from 'react';
import { 
  X, ShoppingCart, DollarSign, ArrowLeftRight, Briefcase,
  Heart, Pizza, Coffee, Beer, Car, Key, Shield, Home, Banknote, Wallet
} from 'lucide-react';
import { GameBuilding } from './UKWorld';
import { toast } from 'sonner';

interface ShopInteriorProps {
  building: GameBuilding;
  characterId: string;
  stats: {
    cash: number;
    bank: number;
    health: number;
    hunger: number;
    energy: number;
  };
  onExit: () => void;
  onPurchase: (item: string, cost: number) => void;
  onDeposit: (amount: number) => void;
  onWithdraw: (amount: number) => void;
}

interface ShopItem {
  id: string;
  name: string;
  price: number;
  icon: React.ElementType;
  description: string;
  effect?: string;
}

const SHOP_INVENTORY: Record<string, ShopItem[]> = {
  shop: [
    { id: 'burger', name: 'Burger', price: 15, icon: Pizza, description: 'Restores hunger', effect: '+30 Hunger' },
    { id: 'coffee', name: 'Coffee', price: 5, icon: Coffee, description: 'Boosts energy', effect: '+20 Energy' },
    { id: 'beer', name: 'Beer', price: 8, icon: Beer, description: 'Relaxing drink', effect: '+10 Energy' },
    { id: 'medkit', name: 'First Aid Kit', price: 50, icon: Heart, description: 'Heals injuries', effect: '+50 Health' },
    { id: 'energy_drink', name: 'Energy Drink', price: 10, icon: Coffee, description: 'Major energy boost', effect: '+40 Energy' },
    { id: 'snacks', name: 'Snacks', price: 8, icon: Pizza, description: 'Light meal', effect: '+15 Hunger' },
  ],
  pub: [
    { id: 'beer', name: 'Pint of Beer', price: 6, icon: Beer, description: 'Classic brew', effect: '+5 Energy' },
    { id: 'whiskey', name: 'Whiskey', price: 12, icon: Beer, description: 'Strong spirit', effect: '+10 Energy' },
    { id: 'fish_chips', name: 'Fish & Chips', price: 18, icon: Pizza, description: 'British classic', effect: '+40 Hunger' },
    { id: 'pie', name: 'Steak Pie', price: 14, icon: Pizza, description: 'Hearty meal', effect: '+35 Hunger' },
  ],
  garage: [
    { id: 'repair', name: 'Vehicle Repair', price: 200, icon: Car, description: 'Fix vehicle damage', effect: 'Repairs vehicle' },
    { id: 'fuel', name: 'Full Tank', price: 50, icon: Car, description: 'Refuel vehicle', effect: 'Full fuel' },
    { id: 'respray', name: 'Respray', price: 500, icon: Car, description: 'Change vehicle color', effect: 'New color' },
  ],
  hospital: [
    { id: 'treatment', name: 'Medical Treatment', price: 100, icon: Heart, description: 'Full health restore', effect: '+100 Health' },
    { id: 'bandage', name: 'Bandages', price: 25, icon: Heart, description: 'Minor healing', effect: '+25 Health' },
    { id: 'painkillers', name: 'Painkillers', price: 15, icon: Heart, description: 'Quick relief', effect: '+15 Health' },
  ],
  police: [
    { id: 'fine', name: 'Pay Fine', price: 250, icon: Shield, description: 'Clear wanted level', effect: '-1 Wanted Star' },
  ],
  dealership: [
    { id: 'compact', name: 'Compact Car', price: 5000, icon: Car, description: 'Affordable city car', effect: 'New vehicle' },
    { id: 'sedan', name: 'Sedan', price: 15000, icon: Car, description: 'Family saloon', effect: 'New vehicle' },
    { id: 'sports', name: 'Sports Car', price: 50000, icon: Car, description: 'High performance', effect: 'New vehicle' },
    { id: 'suv', name: 'SUV', price: 35000, icon: Car, description: 'All-terrain vehicle', effect: 'New vehicle' },
  ],
  apartment: [
    { id: 'rent', name: 'Pay Rent', price: 500, icon: Home, description: 'Monthly rent', effect: 'Keep apartment' },
    { id: 'upgrade', name: 'Upgrade Apt', price: 5000, icon: Key, description: 'Better furnishings', effect: 'Improved home' },
  ],
  job: [
    { id: 'taxi', name: 'Taxi Driver', price: 0, icon: Car, description: 'Earn by driving passengers', effect: 'Start job' },
    { id: 'delivery', name: 'Delivery Driver', price: 0, icon: Briefcase, description: 'Deliver packages', effect: 'Start job' },
    { id: 'security', name: 'Security Guard', price: 0, icon: Shield, description: 'Protect locations', effect: 'Start job' },
  ],
};

export default function ShopInterior({
  building,
  stats,
  onExit,
  onPurchase,
  onDeposit,
  onWithdraw
}: ShopInteriorProps) {
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [bankMode, setBankMode] = useState<'deposit' | 'withdraw' | null>(null);
  const [bankAmount, setBankAmount] = useState('');

  const items = SHOP_INVENTORY[building.type] || [];
  const isBank = building.type === 'bank';

  const handlePurchase = (item: ShopItem) => {
    if (stats.cash < item.price) {
      toast.error('Not enough cash!');
      return;
    }
    onPurchase(item.name, item.price);
    setSelectedItem(null);
  };

  const handleBankAction = () => {
    const amount = parseInt(bankAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    if (bankMode === 'deposit') {
      if (amount > stats.cash) {
        toast.error('Not enough cash!');
        return;
      }
      onDeposit(amount);
    } else if (bankMode === 'withdraw') {
      if (amount > stats.bank) {
        toast.error('Insufficient funds in bank!');
        return;
      }
      onWithdraw(amount);
    }

    setBankAmount('');
    setBankMode(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center">
            <ShoppingCart className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{building.name}</h1>
            <p className="text-sm text-gray-500 capitalize">{building.type}</p>
          </div>
        </div>
        <button
          onClick={onExit}
          className="p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-all"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Balance Display */}
      <div className="flex gap-4 p-4 bg-black/30">
        <div className="flex items-center gap-2 bg-green-500/10 px-4 py-2 rounded-lg border border-green-500/20">
          <DollarSign className="w-5 h-5 text-green-400" />
          <span className="text-green-400 font-bold">${stats.cash.toLocaleString()}</span>
          <span className="text-gray-500 text-sm">Cash</span>
        </div>
        <div className="flex items-center gap-2 bg-blue-500/10 px-4 py-2 rounded-lg border border-blue-500/20">
          <Wallet className="w-5 h-5 text-blue-400" />
          <span className="text-blue-400 font-bold">${stats.bank.toLocaleString()}</span>
          <span className="text-gray-500 text-sm">Bank</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 overflow-y-auto max-h-[calc(100vh-180px)]">
        {isBank ? (
          // Bank Interface
          <div className="max-w-md mx-auto space-y-4">
            <div className="bg-gray-800/50 rounded-xl p-6 border border-white/10">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Banknote className="w-5 h-5 text-green-400" />
                Banking Services
              </h2>

              {!bankMode ? (
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setBankMode('deposit')}
                    className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-all"
                  >
                    <ArrowLeftRight className="w-8 h-8 mx-auto mb-2" />
                    <span className="font-medium">Deposit</span>
                  </button>
                  <button
                    onClick={() => setBankMode('withdraw')}
                    className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all"
                  >
                    <ArrowLeftRight className="w-8 h-8 mx-auto mb-2 rotate-180" />
                    <span className="font-medium">Withdraw</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-gray-400 text-sm mb-2 block">
                      {bankMode === 'deposit' ? 'Deposit Amount' : 'Withdraw Amount'}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={bankAmount}
                        onChange={e => setBankAmount(e.target.value)}
                        placeholder="Enter amount..."
                        className="flex-1 bg-gray-900 text-white rounded-lg px-4 py-3 border border-white/10 focus:border-cyan-500/50 outline-none"
                      />
                    </div>
                    <div className="flex gap-2 mt-2">
                      {[100, 500, 1000, 5000].map(amount => (
                        <button
                          key={amount}
                          onClick={() => setBankAmount(String(amount))}
                          className="flex-1 py-2 rounded-lg bg-gray-700/50 text-gray-300 text-sm hover:bg-gray-700 transition-all"
                        >
                          ${amount}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setBankMode(null)}
                      className="flex-1 py-3 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBankAction}
                      className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                        bankMode === 'deposit'
                          ? 'bg-green-600 text-white hover:bg-green-500'
                          : 'bg-blue-600 text-white hover:bg-blue-500'
                      }`}
                    >
                      {bankMode === 'deposit' ? 'Deposit' : 'Withdraw'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Shop Items Grid
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="bg-gray-800/50 rounded-xl p-4 border border-white/10 hover:border-cyan-500/30 hover:bg-gray-800 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-3">
                  <item.icon className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="font-bold text-white text-sm mb-1">{item.name}</h3>
                <p className="text-gray-500 text-xs mb-2">{item.description}</p>
                <div className="flex justify-between items-center">
                  <span className="text-green-400 font-bold">${item.price}</span>
                  {item.effect && (
                    <span className="text-cyan-400 text-xs">{item.effect}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Purchase Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-sm w-full border border-white/10">
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4">
                <selectedItem.icon className="w-10 h-10 text-cyan-400" />
              </div>
              <h2 className="text-xl font-bold text-white">{selectedItem.name}</h2>
              <p className="text-gray-400 text-sm mt-1">{selectedItem.description}</p>
              {selectedItem.effect && (
                <p className="text-cyan-400 text-sm mt-2">{selectedItem.effect}</p>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 mb-6 p-3 bg-gray-800/50 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-400" />
              <span className="text-2xl font-bold text-green-400">${selectedItem.price}</span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedItem(null)}
                className="flex-1 py-3 rounded-xl bg-gray-700 text-gray-300 hover:bg-gray-600 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handlePurchase(selectedItem)}
                disabled={stats.cash < selectedItem.price}
                className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                  stats.cash >= selectedItem.price
                    ? 'bg-green-600 text-white hover:bg-green-500'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                {stats.cash >= selectedItem.price ? 'Purchase' : 'Not Enough Cash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
