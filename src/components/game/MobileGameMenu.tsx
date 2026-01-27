import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Menu, X, Briefcase, Car, Users, Shield, MessageSquare, 
  DollarSign, Coins, BookOpen, Gamepad2
} from 'lucide-react';

interface MobileGameMenuProps {
  onShowJobs: () => void;
  onShowVehicles: () => void;
  onShowTaxi: () => void;
  onShowPlayers: () => void;
  onShowOrg: () => void;
  onShowChat: () => void;
  onShowBank: () => void;
  onShowExchange: () => void;
  onShowPolice: () => void;
  onShowRules: () => void;
  onShowHelp: () => void;
}

export default function MobileGameMenu({
  onShowJobs,
  onShowVehicles,
  onShowTaxi,
  onShowPlayers,
  onShowOrg,
  onShowChat,
  onShowBank,
  onShowExchange,
  onShowPolice,
  onShowRules,
  onShowHelp,
}: MobileGameMenuProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const menuItems = [
    { icon: Briefcase, label: 'Jobs', onClick: onShowJobs, color: 'bg-secondary' },
    { icon: Car, label: 'Vehicles', onClick: onShowVehicles, color: 'bg-secondary' },
    { icon: null, label: '🚕 Taxi', onClick: onShowTaxi, color: 'bg-secondary' },
    { icon: Users, label: 'Players', onClick: onShowPlayers, color: 'bg-secondary' },
    { icon: Shield, label: 'Org', onClick: onShowOrg, color: 'bg-secondary' },
    { icon: MessageSquare, label: 'Chat', onClick: onShowChat, color: 'bg-secondary' },
    { icon: DollarSign, label: 'Bank', onClick: onShowBank, color: 'bg-secondary' },
    { icon: Coins, label: 'Exchange', onClick: onShowExchange, color: 'bg-gradient-to-r from-yellow-600 to-amber-500' },
    { icon: Shield, label: 'Police', onClick: onShowPolice, color: 'bg-secondary' },
    { icon: BookOpen, label: 'Rules', onClick: onShowRules, color: 'bg-secondary/50' },
    { icon: Gamepad2, label: 'Help', onClick: onShowHelp, color: 'bg-secondary/50' },
  ];

  const handleItemClick = (onClick: () => void) => {
    onClick();
    setIsExpanded(false);
  };

  return (
    <>
      {/* Collapsed State - Menu Button */}
      {!isExpanded && (
        <Button
          size="icon"
          className="fixed bottom-20 left-4 z-50 w-14 h-14 rounded-full bg-primary shadow-lg"
          onClick={() => setIsExpanded(true)}
        >
          <Menu className="w-6 h-6" />
        </Button>
      )}

      {/* Expanded State - Full Menu */}
      {isExpanded && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsExpanded(false)}
          />
          
          {/* Menu Panel */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg rounded-t-3xl p-4 pb-8 animate-slide-in-right">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-foreground">Game Menu</h3>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsExpanded(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Grid of Menu Items */}
            <div className="grid grid-cols-4 gap-3">
              {menuItems.map((item, index) => (
                <button
                  key={index}
                  onClick={() => handleItemClick(item.onClick)}
                  className={`${item.color} flex flex-col items-center justify-center p-3 rounded-xl text-foreground hover:opacity-80 transition-all active:scale-95`}
                >
                  {item.icon ? (
                    <item.icon className="w-5 h-5 mb-1" />
                  ) : (
                    <span className="text-lg mb-1">{item.label.split(' ')[0]}</span>
                  )}
                  <span className="text-[10px] font-medium truncate w-full text-center">
                    {item.icon ? item.label : item.label.split(' ').slice(1).join(' ') || item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
