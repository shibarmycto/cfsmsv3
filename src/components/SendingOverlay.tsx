import { MessageSquare } from 'lucide-react';

interface SendingOverlayProps {
  recipientCount: number;
}

export default function SendingOverlay({ recipientCount }: SendingOverlayProps) {
  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center z-50 touch-none">
      <div className="text-center space-y-6 px-4">
        {/* Simple Animated Logo */}
        <div className="relative w-20 h-20 mx-auto">
          {/* Spinning border */}
          <div 
            className="absolute inset-0 rounded-2xl border-2 border-primary/40 animate-spin" 
            style={{ animationDuration: '2s' }} 
          />
          
          {/* Logo background */}
          <div className="absolute inset-2 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
            <MessageSquare className="w-8 h-8 text-primary" />
          </div>
        </div>

        {/* Brand text */}
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl font-bold text-primary">CF</span>
            <span className="text-2xl font-bold text-muted-foreground">SMS</span>
          </div>
          <p className="text-muted-foreground text-sm">
            Sending messages...
          </p>
        </div>

        {/* Simple Progress indicator */}
        <div className="space-y-2 max-w-[200px] mx-auto">
          <div className="h-1 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full"
              style={{
                width: '30%',
                animation: 'simple-progress 1.5s ease-in-out infinite',
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Delivering to <span className="text-primary font-semibold">{recipientCount}</span> recipient{recipientCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes simple-progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
