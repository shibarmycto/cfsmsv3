import { Button } from '@/components/ui/button';
import { X, Gamepad2, Keyboard, Car, DollarSign, Shield, Skull, Users, MessageSquare } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface HowToPlayMenuProps {
  onClose: () => void;
}

const GUIDES = [
  {
    title: 'Movement & Controls',
    icon: Keyboard,
    color: 'text-blue-500',
    content: [
      'WASD or Arrow Keys - Move your character',
      'T - Open chat',
      'V - Push-to-talk (walkie-talkie)',
      'F - Enter/Exit vehicles',
      'Click on buildings - Interact with locations',
      'Click on players - Open interaction menu'
    ]
  },
  {
    title: 'Getting Started',
    icon: Gamepad2,
    color: 'text-primary',
    content: [
      '1. Create your character with a unique name and appearance',
      '2. You start with $500 cash - use it wisely!',
      '3. Visit the Employment Office to get a job',
      '4. Earn money through jobs or other activities',
      '5. Buy vehicles, properties, and build your empire'
    ]
  },
  {
    title: 'Jobs & Economy',
    icon: DollarSign,
    color: 'text-success',
    content: [
      'Taxi Driver - Drive passengers for fare money',
      'Mechanic - Repair and modify vehicles',
      'Police Officer - Arrest criminals and keep peace (requires application)',
      'Medic - Help injured players recover',
      'Criminal - High risk, high reward lifestyle',
      'Exchange CF Credits for in-game money at the Exchange'
    ]
  },
  {
    title: 'Vehicles',
    icon: Car,
    color: 'text-orange-500',
    content: [
      'Buy vehicles from the Dealership',
      'W/S - Accelerate/Brake when driving',
      'A/D - Steer left/right',
      'F - Exit vehicle',
      'Lock/unlock vehicles from the Garage menu',
      'Fuel decreases as you drive - refuel at gas stations'
    ]
  },
  {
    title: 'Crime & Police',
    icon: Skull,
    color: 'text-destructive',
    content: [
      'Click on players to knock them out or rob them',
      'Crimes increase your Wanted Level (max 5 stars)',
      'Police can arrest wanted players',
      'Arrested? You pay a fine based on wanted level',
      'Wanted level slowly decreases over time',
      'Apply to be a Police Officer through the menu'
    ]
  },
  {
    title: 'Organizations',
    icon: Users,
    color: 'text-purple-500',
    content: [
      'Create or join organizations (gangs, businesses, etc.)',
      'Costs $5,000 to create an organization',
      'Recruit members and build your group',
      'Leaders can promote members to officers',
      'Organizations can have a treasury and earn reputation'
    ]
  },
  {
    title: 'Communication',
    icon: MessageSquare,
    color: 'text-cyan-500',
    content: [
      'World Chat - Talk to everyone on the server',
      'Private Messages - DM specific players',
      'Walkie-Talkie - Hold V to voice chat (coming soon)',
      'Organization chat for group communication'
    ]
  }
];

export default function HowToPlayMenu({ onClose }: HowToPlayMenuProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-2xl max-h-[85vh] animate-scale-in">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Gamepad2 className="w-6 h-6 text-primary" />
            How to Play CF Roleplay
          </h2>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <ScrollArea className="h-[calc(85vh-120px)]">
          <div className="space-y-6 pr-4">
            {GUIDES.map((guide) => {
              const Icon = guide.icon;
              return (
                <div key={guide.title} className="bg-secondary/30 rounded-lg p-4">
                  <h3 className={`font-bold flex items-center gap-2 mb-3 ${guide.color}`}>
                    <Icon className="w-5 h-5" />
                    {guide.title}
                  </h3>
                  <ul className="space-y-2">
                    {guide.content.map((item, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary/50 mt-1">→</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}

            <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
              <p className="text-sm text-primary font-medium">
                💡 Pro Tip: Read the Rules before playing to avoid bans!
              </p>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
