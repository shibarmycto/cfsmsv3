import { useState } from 'react';
import { 
  X, Settings, Bug, Bell, Briefcase, Users, Shield, Star, Gift, 
  User, Car, UserPlus, Warehouse, Clock, Trophy, ChevronRight,
  Skull, Building2, Ticket
} from 'lucide-react';

interface GameSideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  gameTime: string;
  onlinePlayers: number;
  onMenuAction: (action: string) => void;
}

interface MenuItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  bgImage?: string;
}

export default function GameSideMenu({
  isOpen,
  onClose,
  gameTime,
  onlinePlayers,
  onMenuAction,
}: GameSideMenuProps) {
  if (!isOpen) return null;

  const menuItems: MenuItem[] = [
    { id: 'business', icon: <Building2 className="w-6 h-6" />, label: 'BUSINESS' },
    { id: 'gangs', icon: <Skull className="w-6 h-6" />, label: 'GANGS', badge: 7 },
    { id: 'factions', icon: <Users className="w-6 h-6" />, label: 'FACTIONS' },
    { id: 'jobs', icon: <Briefcase className="w-6 h-6" />, label: 'JOBS' },
    { id: 'events', icon: <Star className="w-6 h-6" />, label: 'EVENTS', badge: 1 },
    { id: 'profile', icon: <User className="w-6 h-6" />, label: 'PROFILE', badge: 1 },
    { id: 'tasks', icon: <Ticket className="w-6 h-6" />, label: 'TASKS', badge: 1 },
    { id: 'luck', icon: <Trophy className="w-6 h-6" />, label: 'TRY YOUR LUCK', badge: 4 },
    { id: 'garage', icon: <Car className="w-6 h-6" />, label: 'GARAGE' },
    { id: 'parking', icon: <Warehouse className="w-6 h-6" />, label: 'PARKING' },
    { id: 'friends', icon: <UserPlus className="w-6 h-6" />, label: 'FRIENDS', badge: 1 },
    { id: 'armory', icon: <Shield className="w-6 h-6" />, label: 'ARMORY' },
  ];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Side Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-80 bg-gray-900/95 backdrop-blur-md z-50 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-white font-bold">
              <Clock className="w-4 h-4 text-gray-400" />
              GAME TIME: {gameTime}
            </div>
            <div className="text-sm text-gray-400">
              Online <span className="text-green-400 font-bold">{onlinePlayers}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-gray-400 hover:text-white">
              <Bell className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-400 hover:text-white">
              <Bug className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-400 hover:text-white">
              <Settings className="w-5 h-5" />
            </button>
            <button 
              onClick={onClose}
              className="p-2 text-red-400 hover:text-red-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Menu Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-3 gap-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onMenuAction(item.id)}
                className="relative aspect-square bg-gray-800/50 hover:bg-gray-700/50 rounded-xl border border-white/10 flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
              >
                {/* Badge */}
                {item.badge && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                    {item.badge}
                  </span>
                )}
                
                {/* Icon */}
                <div className="text-white/80">
                  {item.icon}
                </div>
                
                {/* Label */}
                <span className="text-[10px] text-white/70 font-medium text-center leading-tight">
                  {item.label}
                </span>
              </button>
            ))}
          </div>

          {/* Friend Code Section */}
          <div className="mt-4 bg-gradient-to-r from-green-600/30 to-emerald-600/30 rounded-xl p-4 border border-green-500/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-white font-bold">Friend Code</span>
              <ChevronRight className="w-5 h-5 text-green-400 ml-auto" />
            </div>
          </div>

          {/* Event Banner */}
          <div className="mt-3 bg-gradient-to-r from-blue-600/30 to-purple-600/30 rounded-xl p-4 border border-blue-500/30">
            <div className="flex items-center gap-3">
              <div className="text-yellow-400 text-xl">⏰</div>
              <div className="flex-1">
                <div className="text-xs text-yellow-400 font-bold">
                  EVENT ENDS IN: <span className="text-white">20 h 46 min</span>
                </div>
                <div className="text-white font-bold">CITY OF GOLD</div>
                <div className="text-xs text-gray-400">Limited case...</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/10">
          <button 
            onClick={() => onMenuAction('main-menu')}
            className="w-full py-3 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl border border-white/10 flex items-center justify-center gap-2 text-white font-medium transition-all"
          >
            <span className="text-lg">🎮</span>
            Return to Main Menu
          </button>
        </div>
      </div>
    </>
  );
}
