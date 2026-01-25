import { Check } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface VerifiedBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

export default function VerifiedBadge({ size = 'md', showTooltip = true }: VerifiedBadgeProps) {
  const sizeClasses = {
    sm: {
      container: 'gap-0.5',
      tick: 'w-3.5 h-3.5',
      tickIcon: 'w-2 h-2',
      cf: 'text-[8px] px-1 py-0.5',
    },
    md: {
      container: 'gap-1',
      tick: 'w-4 h-4',
      tickIcon: 'w-2.5 h-2.5',
      cf: 'text-[9px] px-1.5 py-0.5',
    },
    lg: {
      container: 'gap-1.5',
      tick: 'w-5 h-5',
      tickIcon: 'w-3 h-3',
      cf: 'text-[10px] px-2 py-1',
    },
  };

  const classes = sizeClasses[size];

  const badge = (
    <div className={`inline-flex items-center ${classes.container}`}>
      {/* Blue Tick Badge */}
      <div 
        className={`${classes.tick} rounded-full bg-gradient-to-br from-cyan-400 via-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30`}
      >
        <Check className={`${classes.tickIcon} text-white stroke-[3]`} />
      </div>
      
      {/* CF Badge */}
      <div 
        className={`${classes.cf} rounded font-black bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20`}
      >
        CF
      </div>
    </div>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent className="bg-gradient-to-r from-cyan-500/10 to-blue-600/10 border-cyan-500/30">
          <p className="text-sm font-medium">
            <span className="text-cyan-400">Verified</span> CF Member
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
