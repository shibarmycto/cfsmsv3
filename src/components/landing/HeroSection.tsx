import { Button } from '@/components/ui/button';
import { ArrowRight, Zap, Link2 } from 'lucide-react';

interface HeroSectionProps {
  onGetStarted: () => void;
  onViewPricing: () => void;
}

export default function HeroSection({ onGetStarted, onViewPricing }: HeroSectionProps) {
  return (
    <section className="container mx-auto px-6 py-20 text-center">
      <div className="max-w-5xl mx-auto animate-fade-in">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8">
          <Link2 className="w-4 h-4" />
          🚀 CFSMS Blockchain Network Now Live!
        </div>
        
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
          <span className="text-gradient">CF SMS Network</span>
          <br />
          <span className="text-2xl md:text-4xl lg:text-5xl text-muted-foreground font-medium">
            Where Social Meets Blockchain
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-3xl mx-auto">
          The revolutionary blockchain network built for everyone. Mine directly, send instant transfers, 
          earn real crypto rewards, and grow with our AI-powered ecosystem — all in one seamless platform.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
          {['Built-In Mining', 'Instant Transfers', 'AI-Powered', 'Social Finance', 'Real Crypto'].map((tag) => (
            <span key={tag} className="px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-sm font-medium">
              {tag}
            </span>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button variant="hero" size="xl" onClick={onGetStarted}>
            <Zap className="w-5 h-5" />
            Start Mining Now
            <ArrowRight className="w-5 h-5" />
          </Button>
          <Button variant="outline" size="xl" onClick={onViewPricing}>
            Explore Features
          </Button>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          ⛏️ Mining active until 2028 • No expensive hardware required
        </p>
      </div>
    </section>
  );
}
