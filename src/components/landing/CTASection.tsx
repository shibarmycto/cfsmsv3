import { Button } from '@/components/ui/button';
import { ArrowRight, Zap, Pickaxe, MessageSquare } from 'lucide-react';

interface CTASectionProps {
  onGetStarted: () => void;
}

export default function CTASection({ onGetStarted }: CTASectionProps) {
  return (
    <section className="container mx-auto px-6 py-20">
      <div className="glass-card glow-border p-8 md:p-12 text-center max-w-4xl mx-auto relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />
        
        <div className="relative">
          <div className="flex justify-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Pickaxe className="w-6 h-6 text-primary" />
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-primary" />
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Zap className="w-6 h-6 text-primary" />
            </div>
          </div>

          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Join <span className="text-gradient">CF Blockchain</span>?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Start mining, connect with the community, and earn real crypto rewards. 
            Early users get exclusive access to participation rewards.
          </p>
          
          <Button variant="hero" size="xl" onClick={onGetStarted}>
            Get Started Now
            <ArrowRight className="w-5 h-5" />
          </Button>
          
          <p className="mt-6 text-sm text-muted-foreground">
            🌍 CF Blockchain — Powered by CFGPT AI
          </p>
        </div>
      </div>
    </section>
  );
}
