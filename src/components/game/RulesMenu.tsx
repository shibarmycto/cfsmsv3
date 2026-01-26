import { Button } from '@/components/ui/button';
import { X, BookOpen, AlertTriangle, Ban, MessageSquareWarning, Users, Car } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface RulesMenuProps {
  onClose: () => void;
}

const GAME_RULES = [
  {
    category: 'General Conduct',
    icon: Users,
    color: 'text-blue-500',
    rules: [
      'Respect all players regardless of their background',
      'No harassment, bullying, or targeting specific players',
      'Keep conversations appropriate for all ages',
      'Do not exploit bugs or glitches - report them instead',
      'English is the primary language in public chat'
    ]
  },
  {
    category: 'Zero Tolerance',
    icon: Ban,
    color: 'text-destructive',
    rules: [
      'Racism, sexism, or any form of discrimination = Permanent Ban',
      'Sexual content or inappropriate behavior = Permanent Ban',
      'Real-world threats or doxxing = Permanent Ban',
      'Hacking, cheating, or exploiting = Permanent Ban',
      'Impersonating staff members = Permanent Ban'
    ]
  },
  {
    category: 'Roleplay Rules',
    icon: MessageSquareWarning,
    color: 'text-yellow-500',
    rules: [
      'Stay in character during roleplay scenarios',
      'No "Random Death Match" (RDM) - killing without RP reason',
      'No "Vehicle Death Match" (VDM) - using vehicles to kill randomly',
      'Allow victims time to respond during robberies',
      'No combat logging (disconnecting during RP situations)',
      'Respect "New Life Rule" - forget events leading to your death'
    ]
  },
  {
    category: 'Crime & Police',
    icon: AlertTriangle,
    color: 'text-orange-500',
    rules: [
      'Maximum robbery amount: $500 per victim',
      'Wait 10 minutes between robbing the same player',
      'Police must identify themselves before arrests',
      'Criminals can flee but must roleplay the chase',
      'No cop-baiting (intentionally provoking police)',
      'Police cannot abuse their power for personal gain'
    ]
  },
  {
    category: 'Vehicles',
    icon: Car,
    color: 'text-primary',
    rules: [
      'Drive on the right side of the road',
      'No ramming other vehicles without RP reason',
      'Emergency vehicles have right of way',
      'No storing vehicles in unrealistic locations',
      'Report stolen vehicles to police (RP)'
    ]
  }
];

export default function RulesMenu({ onClose }: RulesMenuProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-2xl max-h-[85vh] animate-scale-in">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            CF Roleplay Rules
          </h2>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <ScrollArea className="h-[calc(85vh-120px)]">
          <div className="space-y-6 pr-4">
            {GAME_RULES.map((category) => {
              const Icon = category.icon;
              return (
                <div key={category.category} className="space-y-2">
                  <h3 className={`font-bold flex items-center gap-2 ${category.color}`}>
                    <Icon className="w-5 h-5" />
                    {category.category}
                  </h3>
                  <ul className="space-y-1 ml-7">
                    {category.rules.map((rule, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-muted-foreground/50">•</span>
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}

            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mt-6">
              <p className="text-sm text-destructive font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Breaking rules may result in warnings, temporary bans, or permanent bans.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                All bans are logged and reviewed by administrators. Appeals can be submitted through the forum.
              </p>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
