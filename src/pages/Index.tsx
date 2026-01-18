import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { 
  MessageSquare, 
  Zap, 
  Shield, 
  Globe, 
  Upload, 
  CreditCard,
  ArrowRight,
  Check
} from 'lucide-react';

export default function Index() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleGetStarted = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen hero-gradient">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-bold text-gradient">CFSMS</span>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <Button variant="hero" onClick={() => navigate('/dashboard')}>
                Dashboard
                <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate('/auth')}>
                  Login
                </Button>
                <Button variant="hero" onClick={() => navigate('/auth')}>
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 text-center">
        <div className="max-w-4xl mx-auto animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8">
            <Zap className="w-4 h-4" />
            CloudFlare-Powered SMS Platform
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Bulk SMS Made
            <span className="text-gradient"> Simple</span>
          </h1>
          
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Send thousands of messages instantly with our powerful bulk SMS platform. 
            Easy uploads, custom sender IDs, and competitive pricing.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button variant="hero" size="xl" onClick={handleGetStarted}>
              Start Sending Now
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Button variant="outline" size="xl" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>
              View Pricing
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-6 py-20">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: Upload,
              title: 'Easy Upload',
              description: 'Upload CSV or Excel files with your contacts. Our system handles the rest.',
            },
            {
              icon: Shield,
              title: 'Custom Sender ID',
              description: 'Request your own sender ID for brand recognition. Approval within 24 hours.',
            },
            {
              icon: Globe,
              title: 'Global Reach',
              description: 'Send to UK and USA numbers with dedicated routes and best delivery rates.',
            },
          ].map((feature, index) => (
            <div 
              key={feature.title} 
              className="stat-card animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="container mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
          <p className="text-muted-foreground">Pay only for what you use. No hidden fees.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* UK Pricing */}
          <div className="glass-card glow-border p-8 relative overflow-hidden animate-fade-in">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                  🇬🇧
                </div>
                <div>
                  <h3 className="text-xl font-bold">UK SMS</h3>
                  <p className="text-sm text-muted-foreground">United Kingdom</p>
                </div>
              </div>
              <div className="mb-6">
                <span className="text-5xl font-bold">£100</span>
                <span className="text-muted-foreground"> / 100 SMS</span>
              </div>
              <ul className="space-y-3 mb-8">
                {['High delivery rates', 'Custom sender ID', 'Real-time reporting', 'Bulk upload support'].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-muted-foreground">
                    <Check className="w-5 h-5 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button variant="hero" className="w-full" onClick={handleGetStarted}>
                Get Started
              </Button>
            </div>
          </div>

          {/* USA Pricing */}
          <div className="glass-card glow-border p-8 relative overflow-hidden animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                  🇺🇸
                </div>
                <div>
                  <h3 className="text-xl font-bold">USA SMS</h3>
                  <p className="text-sm text-muted-foreground">United States</p>
                </div>
              </div>
              <div className="mb-6">
                <span className="text-5xl font-bold">$100</span>
                <span className="text-muted-foreground"> / 100 SMS</span>
              </div>
              <ul className="space-y-3 mb-8">
                {['High delivery rates', 'Custom sender ID', 'Real-time reporting', 'Bulk upload support'].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-muted-foreground">
                    <Check className="w-5 h-5 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button variant="hero" className="w-full" onClick={handleGetStarted}>
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Payment Methods */}
      <section className="container mx-auto px-6 py-20">
        <div className="glass-card p-8 text-center">
          <CreditCard className="w-12 h-12 text-primary mx-auto mb-4" />
          <h3 className="text-2xl font-bold mb-4">Flexible Payment Options</h3>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Pay with cryptocurrency (Bitcoin, Ethereum, USDT) or PayPal. 
            Credits are added instantly after payment confirmation.
          </p>
          <div className="flex items-center justify-center gap-6 text-muted-foreground">
            <span className="px-4 py-2 rounded-lg bg-secondary">₿ Bitcoin</span>
            <span className="px-4 py-2 rounded-lg bg-secondary">Ξ Ethereum</span>
            <span className="px-4 py-2 rounded-lg bg-secondary">💲 USDT</span>
            <span className="px-4 py-2 rounded-lg bg-secondary">PayPal</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-12 border-t border-border">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold">CFSMS</span>
          </div>
          <p className="text-muted-foreground text-sm">
            © 2024 CFSMS. CloudFlare-Powered Bulk SMS Platform.
          </p>
        </div>
      </footer>
    </div>
  );
}
