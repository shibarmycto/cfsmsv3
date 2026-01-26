import { useState, useEffect } from 'react';
import { X, ShoppingCart, Briefcase, DollarSign, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ShopItem {
  id: string;
  name: string;
  price: number;
  type: 'weapon' | 'tool' | 'consumable' | 'clothing';
  description: string;
}

interface ShopUIProps {
  isOpen: boolean;
  buildingName: string;
  buildingType: string;
  onClose: () => void;
  onPurchase?: (item: ShopItem) => void;
  onStartJob?: (jobName: string, reward: number) => void;
  playerCash: number;
  playerHealth: number;
}

export default function ShopUI({
  isOpen,
  buildingName,
  buildingType,
  onClose,
  onPurchase,
  onStartJob,
  playerCash,
  playerHealth,
}: ShopUIProps) {
  const [activeTab, setActiveTab] = useState<'shop' | 'jobs' | 'services'>('shop');

  const shopItems: ShopItem[] = [
    { id: '1', name: 'Medkit', price: 500, type: 'consumable', description: 'Restore 50 health' },
    { id: '2', name: 'Food', price: 100, type: 'consumable', description: 'Restore hunger' },
    { id: '3', name: 'Coffee', price: 50, type: 'consumable', description: 'Restore energy' },
    { id: '4', name: 'Backpack', price: 1000, type: 'tool', description: 'Increase inventory' },
  ];

  const jobs = [
    { id: 'job1', name: 'Package Delivery', reward: 500, duration: '60s' },
    { id: 'job2', name: 'Security Guard', reward: 750, duration: '2m' },
    { id: 'job3', name: 'Shop Assistant', reward: 400, duration: '45s' },
  ];

  const services = [
    { id: 'service1', name: 'Medical Checkup', price: 200, effect: 'Heal 25 HP' },
    { id: 'service2', name: 'Full Treatment', price: 500, effect: 'Full Health' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-900 border-2 border-cyan-500 rounded-lg w-full max-w-2xl max-h-96 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-900 to-blue-900 p-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">{buildingName}</h2>
          <button onClick={onClose} className="text-gray-300 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-cyan-500/30">
          <button
            onClick={() => setActiveTab('shop')}
            className={`flex-1 py-3 px-4 font-bold transition-colors ${
              activeTab === 'shop'
                ? 'bg-cyan-600 text-white border-b-2 border-cyan-400'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            <ShoppingCart className="inline mr-2 w-5 h-5" />
            Shop
          </button>
          {buildingType === 'job_center' && (
            <button
              onClick={() => setActiveTab('jobs')}
              className={`flex-1 py-3 px-4 font-bold transition-colors ${
                activeTab === 'jobs'
                  ? 'bg-cyan-600 text-white border-b-2 border-cyan-400'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              <Briefcase className="inline mr-2 w-5 h-5" />
              Jobs
            </button>
          )}
          {buildingType === 'hospital' && (
            <button
              onClick={() => setActiveTab('services')}
              className={`flex-1 py-3 px-4 font-bold transition-colors ${
                activeTab === 'services'
                  ? 'bg-cyan-600 text-white border-b-2 border-cyan-400'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              <Heart className="inline mr-2 w-5 h-5" />
              Services
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-800">
          {activeTab === 'shop' && (
            <div className="space-y-3">
              {shopItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-gray-700 border border-gray-600 rounded-lg p-4 hover:border-cyan-500 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-white font-bold">{item.name}</h3>
                      <p className="text-gray-400 text-sm">{item.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-green-400 font-bold">${item.price}</div>
                      <Button
                        onClick={() => onPurchase?.(item)}
                        disabled={playerCash < item.price}
                        className="mt-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600"
                        size="sm"
                      >
                        Buy
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'jobs' && (
            <div className="space-y-3">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="bg-gray-700 border border-gray-600 rounded-lg p-4 hover:border-green-500 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-white font-bold">{job.name}</h3>
                      <p className="text-gray-400 text-sm">Duration: {job.duration}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-green-400 font-bold">+${job.reward}</div>
                      <Button
                        onClick={() => onStartJob?.(job.name, job.reward)}
                        className="mt-2 bg-green-600 hover:bg-green-700"
                        size="sm"
                      >
                        Start
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'services' && (
            <div className="space-y-3">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="bg-gray-700 border border-gray-600 rounded-lg p-4 hover:border-red-500 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-white font-bold">{service.name}</h3>
                      <p className="text-gray-400 text-sm">{service.effect}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-green-400 font-bold">${service.price}</div>
                      <Button
                        onClick={() => onPurchase?.({
                          id: service.id,
                          name: service.name,
                          price: service.price,
                          type: 'consumable',
                          description: service.effect,
                        })}
                        disabled={playerCash < service.price}
                        className="mt-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600"
                        size="sm"
                      >
                        Use
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-900 border-t border-cyan-500/30 p-4 flex justify-between items-center">
          <div className="flex gap-4 text-sm">
            <div className="text-green-400">
              <DollarSign className="inline w-4 h-4 mr-1" />
              Cash: ${playerCash}
            </div>
            <div className="text-red-400">
              <Heart className="inline w-4 h-4 mr-1" />
              Health: {playerHealth}%
            </div>
          </div>
          <Button onClick={onClose} variant="outline" className="text-white border-white hover:bg-white/10">
            Close [ESC]
          </Button>
        </div>
      </div>
    </div>
  );
}
