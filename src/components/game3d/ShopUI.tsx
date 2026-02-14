import { useState } from 'react';
import { X, ShoppingCart, Car, Shirt, Utensils, Home, Shield, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ShopItem {
  id: string;
  name: string;
  price: number;
  category: 'vehicles' | 'weapons' | 'clothing' | 'food' | 'properties';
  description: string;
  icon: string;
  owned?: boolean;
}

interface ShopUIProps {
  isOpen: boolean;
  onClose: () => void;
  playerCash: number;
  onPurchase: (item: ShopItem) => void;
}

const shopItems: ShopItem[] = [
  // Vehicles
  { id: 'car-1', name: 'Honda Civic', price: 25000, category: 'vehicles', description: 'Reliable sedan', icon: '🚗' },
  { id: 'car-2', name: 'BMW M3', price: 75000, category: 'vehicles', description: 'Sports sedan', icon: '🏎️' },
  { id: 'car-3', name: 'Mercedes S-Class', price: 120000, category: 'vehicles', description: 'Luxury sedan', icon: '🚘' },
  { id: 'car-4', name: 'Lamborghini Urus', price: 250000, category: 'vehicles', description: 'Luxury SUV', icon: '🚙' },
  { id: 'bike-1', name: 'Yamaha R1', price: 18000, category: 'vehicles', description: 'Sport bike', icon: '🏍️' },
  { id: 'boat-1', name: 'Speed Boat', price: 85000, category: 'vehicles', description: 'Fast water craft', icon: '🚤' },
  
  // Weapons
  { id: 'weapon-1', name: 'Baseball Bat', price: 150, category: 'weapons', description: 'Melee weapon', icon: '🏏' },
  { id: 'weapon-2', name: 'Knife', price: 250, category: 'weapons', description: 'Silent melee', icon: '🔪' },
  { id: 'weapon-3', name: 'Pistol', price: 2500, category: 'weapons', description: '9mm handgun', icon: '🔫' },
  { id: 'weapon-4', name: 'SMG', price: 8500, category: 'weapons', description: 'Submachine gun', icon: '💥' },
  { id: 'weapon-5', name: 'Rifle', price: 15000, category: 'weapons', description: 'Assault rifle', icon: '🎯' },
  { id: 'weapon-6', name: 'Body Armor', price: 5000, category: 'weapons', description: '+50 armor', icon: '🛡️' },
  
  // Clothing
  { id: 'cloth-1', name: 'Business Suit', price: 1200, category: 'clothing', description: 'Professional look', icon: '👔' },
  { id: 'cloth-2', name: 'Streetwear Set', price: 800, category: 'clothing', description: 'Urban style', icon: '👕' },
  { id: 'cloth-3', name: 'Designer Watch', price: 5000, category: 'clothing', description: 'Luxury accessory', icon: '⌚' },
  { id: 'cloth-4', name: 'Sunglasses', price: 350, category: 'clothing', description: 'Cool shades', icon: '🕶️' },
  { id: 'cloth-5', name: 'Cap', price: 150, category: 'clothing', description: 'Baseball cap', icon: '🧢' },
  
  // Food & Supplies
  { id: 'food-1', name: 'Burger', price: 15, category: 'food', description: '+20 hunger', icon: '🍔' },
  { id: 'food-2', name: 'Pizza', price: 20, category: 'food', description: '+30 hunger', icon: '🍕' },
  { id: 'food-3', name: 'Energy Drink', price: 8, category: 'food', description: '+25 energy', icon: '🥤' },
  { id: 'food-4', name: 'Coffee', price: 5, category: 'food', description: '+15 energy', icon: '☕' },
  { id: 'food-5', name: 'First Aid Kit', price: 100, category: 'food', description: '+50 health', icon: '🩹' },
  { id: 'ammo-1', name: 'Pistol Ammo (30)', price: 100, category: 'food', description: '+30 bullets', icon: '🔫' },
  { id: 'ammo-2', name: 'Rifle Ammo (30)', price: 200, category: 'food', description: '+30 bullets', icon: '🎯' },
  { id: 'ammo-3', name: 'Ammo Crate (90)', price: 500, category: 'food', description: '+90 bullets', icon: '📦' },
  
  // Properties
  { id: 'prop-1', name: 'Small Apartment', price: 150000, category: 'properties', description: 'Starter home', icon: '🏠' },
  { id: 'prop-2', name: 'Modern House', price: 450000, category: 'properties', description: 'Family home', icon: '🏡' },
  { id: 'prop-3', name: 'Luxury Penthouse', price: 1200000, category: 'properties', description: 'Top floor living', icon: '🏢' },
  { id: 'prop-4', name: 'Warehouse', price: 350000, category: 'properties', description: 'Storage space', icon: '🏭' },
];

const categories = [
  { id: 'vehicles', label: 'Vehicles', icon: <Car className="w-5 h-5" /> },
  { id: 'weapons', label: 'Weapons', icon: <Shield className="w-5 h-5" /> },
  { id: 'clothing', label: 'Clothing', icon: <Shirt className="w-5 h-5" /> },
  { id: 'food', label: 'Food', icon: <Utensils className="w-5 h-5" /> },
  { id: 'properties', label: 'Properties', icon: <Home className="w-5 h-5" /> },
];

export default function ShopUI({ isOpen, onClose, playerCash, onPurchase }: ShopUIProps) {
  const [activeCategory, setActiveCategory] = useState<string>('vehicles');
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);

  if (!isOpen) return null;

  const filteredItems = shopItems.filter(item => item.category === activeCategory);

  const handlePurchase = () => {
    if (selectedItem && playerCash >= selectedItem.price) {
      onPurchase(selectedItem);
      setSelectedItem(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Shop Panel */}
      <div className="relative w-[95%] max-w-4xl h-[85%] max-h-[600px] bg-gray-900/95 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-yellow-600/20 to-orange-600/20">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-6 h-6 text-yellow-400" />
            <h2 className="text-xl font-bold text-white">CF STORE</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-3 py-1.5">
              <span className="text-green-400 font-bold">${playerCash.toLocaleString()}</span>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 p-3 border-b border-white/10 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeCategory === cat.id
                  ? 'bg-yellow-500 text-black'
                  : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
              }`}
            >
              {cat.icon}
              {cat.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Items Grid */}
          <ScrollArea className="flex-1 p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`relative p-4 rounded-xl border transition-all ${
                    selectedItem?.id === item.id
                      ? 'bg-yellow-500/20 border-yellow-500'
                      : 'bg-gray-800/50 border-white/10 hover:border-white/30'
                  }`}
                >
                  {item.owned && (
                    <span className="absolute top-2 right-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                      OWNED
                    </span>
                  )}
                  <div className="text-4xl mb-2">{item.icon}</div>
                  <div className="text-white font-medium text-sm truncate">{item.name}</div>
                  <div className="text-green-400 font-bold text-sm">${item.price.toLocaleString()}</div>
                </button>
              ))}
            </div>
          </ScrollArea>

          {/* Item Details */}
          {selectedItem && (
            <div className="w-64 border-l border-white/10 p-4 flex flex-col">
              <div className="text-center mb-4">
                <div className="text-6xl mb-3">{selectedItem.icon}</div>
                <h3 className="text-lg font-bold text-white">{selectedItem.name}</h3>
                <p className="text-sm text-gray-400 mt-1">{selectedItem.description}</p>
              </div>

              <div className="flex-1" />

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Price</span>
                  <span className="text-green-400 font-bold">${selectedItem.price.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Your Balance</span>
                  <span className={`font-bold ${playerCash >= selectedItem.price ? 'text-green-400' : 'text-red-400'}`}>
                    ${playerCash.toLocaleString()}
                  </span>
                </div>
                <Button
                  onClick={handlePurchase}
                  disabled={playerCash < selectedItem.price || selectedItem.owned}
                  className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold disabled:opacity-50"
                >
                  {selectedItem.owned ? 'OWNED' : playerCash >= selectedItem.price ? 'BUY NOW' : 'NOT ENOUGH CASH'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
