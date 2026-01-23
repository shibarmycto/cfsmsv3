import { MessageSquare } from 'lucide-react';

interface SendingOverlayProps {
  recipientCount: number;
}

export default function SendingOverlay({ recipientCount }: SendingOverlayProps) {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-50">
      <div className="text-center space-y-8">
        {/* Animated Logo */}
        <div className="relative">
          {/* Outer glow rings */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full border-2 border-primary/30 animate-ping" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-40 h-40 rounded-full border border-primary/20 animate-pulse" />
          </div>
          
          {/* Main logo container */}
          <div className="relative w-24 h-24 mx-auto">
            {/* Spinning border */}
            <div className="absolute inset-0 rounded-2xl border-2 border-transparent border-t-primary border-r-primary animate-spin" 
                 style={{ animationDuration: '1.5s' }} />
            
            {/* Logo background */}
            <div className="absolute inset-1 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 backdrop-blur-sm border border-primary/30 flex items-center justify-center">
              <MessageSquare className="w-10 h-10 text-primary animate-pulse" />
            </div>
          </div>
        </div>

        {/* Brand text */}
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <span className="text-3xl font-bold text-gradient">CF</span>
            <span className="text-3xl font-bold text-muted-foreground">SMS</span>
          </div>
          <p className="text-muted-foreground animate-pulse">
            Sending messages...
          </p>
        </div>

        {/* Progress indicator */}
        <div className="space-y-3 max-w-xs mx-auto">
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary via-primary/80 to-primary rounded-full animate-pulse"
              style={{
                width: '100%',
                animation: 'loading-progress 2s ease-in-out infinite',
              }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Delivering to <span className="text-primary font-semibold">{recipientCount}</span> recipient{recipientCount !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-primary/30 rounded-full"
              style={{
                left: `${20 + i * 12}%`,
                animation: `float-up ${2 + i * 0.3}s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes loading-progress {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        
        @keyframes float-up {
          0%, 100% {
            transform: translateY(100vh) scale(0);
            opacity: 0;
          }
          10% {
            opacity: 1;
            transform: translateY(90vh) scale(1);
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-10vh) scale(0.5);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
