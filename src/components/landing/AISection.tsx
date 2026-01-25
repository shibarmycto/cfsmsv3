import { Bot, Brain, Sparkles, Phone, MessageSquare, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function AISection() {
  const navigate = useNavigate();

  return (
    <section className="container mx-auto px-6 py-20">
      <div className="glass-card glow-border p-8 md:p-12">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              <Brain className="w-4 h-4" />
              AI-Powered
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              🤖 Meet Your <span className="text-gradient">AI Virtual Twin</span>
            </h2>
            <p className="text-muted-foreground mb-6">
              Your personal AI companion that answers phone calls, holds natural conversations, 
              remembers past interactions, and adapts to each caller's personality. 
              Warm, calm, friendly, and emotionally intelligent.
            </p>
            
            <ul className="space-y-3 mb-6">
              {[
                { icon: Phone, text: 'Answers incoming calls naturally' },
                { icon: MessageSquare, text: 'Holds emotionally intelligent conversations' },
                { icon: Brain, text: 'Remembers callers and past interactions' },
                { icon: Sparkles, text: 'Adapts to personality and emotional state' },
              ].map((item) => (
                <li key={item.text} className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-4 h-4 text-primary" />
                  </div>
                  {item.text}
                </li>
              ))}
            </ul>

            <Button variant="hero" onClick={() => navigate('/ai-twin')}>
              <Bot className="w-4 h-4" />
              Create Your AI Twin
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent rounded-2xl blur-3xl" />
            <div className="relative glass-card p-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                AI Smart Agent Features
              </h3>
              <div className="space-y-3">
                {[
                  'Automated promotional campaigns',
                  'Intelligent engagement optimization',
                  'Targeted audience reach',
                  'Network growth acceleration',
                  'Real-time analytics & insights',
                ].map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    {feature}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
